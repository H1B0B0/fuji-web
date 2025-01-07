import { useAppState } from "../../state/store";
import { availableActions } from "./availableActions";
import { ParsedResponseSuccess, parseResponse } from "./parseResponse";
import { QueryResult } from "../vision-agent/determineNextAction";
import errorChecker from "../errorChecker";
import { fetchResponseFromModel, SupportedModels } from "../aiSdkUtils";
import { ToolOperation } from "../vision-agent/tools";
type Action = NonNullable<QueryResult>["action"];

const formattedActions = availableActions
  .map((action, i) => {
    const args = action.args
      .map((arg) => `${arg.name}: ${arg.type}`)
      .join(", ");
    return `${i + 1}. ${action.name}(${args}): ${action.description}`;
  })
  .join("\n");

const systemMessage = `
  You are a browser automation assistant with STRICT limitations.
  
  IMPORTANT - ACTION RESTRICTIONS:
  - You can ONLY use the following predefined actions - no exceptions:
  ${formattedActions}
  
  - ANY other action will be rejected
  - NO custom JavaScript execution is allowed
  - NO direct DOM manipulation is permitted
  - Actions outside this list will fail and do nothing
  - Each action must exactly match the format shown in examples
  
  You will be given:
  1. A task to perform
  2. The current state of the DOM
  3. Previous actions you have taken
  
  STRICT Rules:
  - Your answer must be valid JSON
  - JSON must include "thought" (string) and "action" object
  - Action MUST be one from the list above - no exceptions
  - Action format must exactly match the examples below
  - Invalid actions will be rejected and nothing will happen
  - When finished, use only "finish()" action
  
  Valid Examples (ONLY these action types are allowed):
  
  Example 1 - Click (only valid with proper uid):
  {
    "thought": "I am clicking the add to cart button",
    "action": {
      "name": "click",
      "args": {
        "uid": "223"
      }
    }
  }

Example 2 - Set Value:
{
  "thought": "I am typing 'fish food' into the search bar",
  "action": {
    "name": "setValue",
    "args": {
      "elementId": "123",
      "value": "fish food"
    }
  }
}

Example 3 - Set Value and Enter:
{
  "thought": "I am searching for 'Nelson Mandela' by typing and pressing enter",
  "action": {
    "name": "setValueAndEnter",
    "args": {
      "elementId": "129",
      "value": "Nelson Mandela"
    }
  }
}

Example 4 - Navigate:
{
  "thought": "I need to open Google Docs",
  "action": {
    "name": "navigate",
    "args": {
      "url": "https://docs.google.com/document/create"
    }
  }
}

Example 5 - Scroll:
{
  "thought": "I am scrolling down to see more results",
  "action": {
    "name": "scroll",
    "args": {
      "value": "down"
    }
  }
}

Example 6 - Wait:
{
  "thought": "I need to wait for the page to load",
  "action": {
    "name": "wait"
  }
}

Example 7 - Finish Successfully:
{
  "thought": "I have completed the task of searching and copying the information",
  "action": {
    "name": "finish"
  }
}

Example 8 - Fail Gracefully:
{
  "thought": "I could not find the search box on this page",
  "action": {
    "name": "fail"
  }
}
  
Example 9 - Navigate and Search:
{
  "thought": "I will search for information about Nelson Mandela on Wikipedia",
  "action": {
    "name": "navigate",
    "args": {
      "url": "https://www.wikipedia.org"
    }
  }
}

Example 10 - Scroll and Click:
{
  "thought": "I need to scroll down to find the 'References' section",
  "action": {
    "name": "scroll",
    "args": {
      "value": "down"
    }
  }
}

Example 11 - Complex Search:
{
  "thought": "I will type the search query and press enter to find results",
  "action": {
    "name": "setValueAndEnter",
    "args": {
      "elementId": "123",
      "value": "Nelson Mandela achievements"
    }
  }
}
Remember: ANY action not matching these exact formats will fail silently.
You MUST stick to ONLY these predefined actions - no exceptions.`;

export async function determineNextAction(
  taskInstructions: string,
  previousActions: Action[],
  simplifiedDOM: string,
  maxAttempts = 3,
  notifyError?: (error: string) => void,
): Promise<QueryResult> {
  const model = useAppState.getState().settings
    .selectedModel as SupportedModels;
  const prompt = formatPrompt(taskInstructions, previousActions, simplifiedDOM);

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const completion = await fetchResponseFromModel(model, {
        systemMessage,
        prompt,
        jsonMode: true,
      });

      const rawResponse = completion.rawResponse;

      try {
        const parsed = parseResponse(rawResponse);
        if ("error" in parsed) {
          throw new Error(parsed.error);
        }
        return {
          usage: completion.usage,
          prompt,
          rawResponse,
          action: visionActionAdapter(parsed),
        };
      } catch (e) {
        console.error("Failed to parse response", e);
      }
    } catch (error: any) {
      if (error instanceof Error) {
        const recoverable = errorChecker(error, notifyError);
        if (!recoverable) {
          throw error;
        }
      } else {
        console.error("Unexpected determineNextAction error:", error);
      }
    }
  }
  const errMsg = `Failed to complete query after ${maxAttempts} attempts. Please try again later.`;
  if (notifyError) {
    notifyError(errMsg);
  }
  throw new Error(errMsg);
}

function formatPrompt(
  taskInstructions: string,
  previousActions: Action[],
  pageContents?: string,
) {
  let previousActionsString = "";

  if (previousActions.length > 0) {
    const serializedActions = previousActions
      .map(
        (action) =>
          `Thought: ${action.thought}\nAction:${JSON.stringify(
            action.operation,
          )}`,
      )
      .join("\n\n");
    previousActionsString = `You have already taken the following actions: \n${serializedActions}\n\n`;
  }

  let result = `The user requests the following task:

${taskInstructions}

${previousActionsString}

Current time: ${new Date().toLocaleString()}
`;
  if (pageContents) {
    result += `
Current page contents:
${pageContents}`;
  }
  return result;
}

function extractNumericId(elementId: string): number {
  const numericMatches = elementId.match(/\d+/);
  if (numericMatches) {
    return parseInt(numericMatches[0], 10);
  }
  return elementId.length > 0 ? parseInt(elementId, 36) : 0;
}

// Make action compatible with vision agent
function visionActionAdapter(action: ParsedResponseSuccess): Action {
  console.log("Raw action input:", action);

  // Special handling for navigate action
  if (action.parsedAction.name === "navigate") {
    let url = "";

    // Handle array format
    if (Array.isArray(action.parsedAction.args)) {
      url = action.parsedAction.args[0];
    }
    // Handle object format
    else if (typeof action.parsedAction.args === "object") {
      url = action.parsedAction.args.url;
    }

    console.log("Navigate URL extracted:", url);

    return {
      thought: action.thought,
      operation: {
        name: "navigate",
        args: { url },
      },
    };
  }

  // Existing handling for other actions
  const args: Record<string, any> = { uid: "" };

  if (typeof action.parsedAction === "string") {
    try {
      const parsedActionObj = JSON.parse(action.parsedAction);
      if (parsedActionObj?.args?.elementId) {
        args.uid = String(extractNumericId(parsedActionObj.args.elementId));
        args.value = parsedActionObj.args.value || "";
      }
    } catch (e) {
      console.error("Failed to parse action string:", e);
    }
  } else if (action.parsedAction && typeof action.parsedAction === "object") {
    if (Array.isArray(action.parsedAction.args)) {
      const [id] = action.parsedAction.args;
      args.uid = String(extractNumericId(String(id)));
      args.value = action.parsedAction.args[1] || "";
    } else if (typeof action.parsedAction.args === "object") {
      if ("elementId" in action.parsedAction.args) {
        args.uid = String(
          extractNumericId(String(action.parsedAction.args.elementId)),
        );
        args.value =
          "value" in action.parsedAction.args
            ? action.parsedAction.args.value
            : "";
      }
    }
  }

  return {
    thought: action.thought,
    operation: {
      name: action.parsedAction.name,
      args,
      description: undefined,
    } as ToolOperation,
  };
}
