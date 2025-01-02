import { useAppState } from "../../state/store";
import { availableActions } from "./availableActions";
import { ParsedResponseSuccess, parseResponse } from "./parseResponse";
import { QueryResult } from "../vision-agent/determineNextAction";
import errorChecker from "../errorChecker";
import { fetchResponseFromModel } from "../aiSdkUtils";

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
You are a browser automation assistant. Respond with exactly ONE JSON object:

{
  "thought": "...",
  "action": "actionName(arguments)"
}

IMPORTANT: You can ONLY use the actions defined below and NOTHING else:
${formattedActions}

RULES:
1. EXACTLY one "action" per message.
2. No extra keys or text outside the JSON.
3. If finished, use: "finish('your summary')".

EXAMPLE:
1.
{
  "thought": "Click on an element",
  "action": "click({elementId: 'submitButton'})"
}

2.
{
  "thought": "Set value of an input element",
  "action": "setValue({elementId: 'usernameInput', value: 'exampleUser'})"
}

3.
{
  "thought": "Wait for the page to load",
  "action": "wait()"
}

4.
{
  "thought": "Finish the task",
  "action": "finish('Task completed successfully')"
}

5.
{
  "thought": "Unable to complete the task",
  "action": "fail('Element not found')"
}
`;

export async function determineNextAction(
  taskInstructions: string,
  previousActions: Action[],
  simplifiedDOM: string,
  maxAttempts = 3,
  notifyError?: (error: string) => void,
): Promise<QueryResult> {
  const model = useAppState.getState().settings.selectedModel;
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
          // TODO: refactor dom agent so we don't need this
          action: visionActionAdapter(parsed),
        };
      } catch (e) {
        console.error("Failed to parse response", e);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error instanceof Error) {
        const recoverable = errorChecker(error, notifyError);
        console.log(error);
        if (!recoverable) {
          throw error;
        }
      } else {
        console.error("Unexpected determineNextAction error:");
        console.error(error);
      }
    }
  }
  const errMsg = `Failed to complete query after ${maxAttempts} attempts. Please try again later.`;
  if (notifyError) {
    notifyError(errMsg);
  }
  throw new Error(errMsg);
}

export function formatPrompt(
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

// make action compatible with vision agent
// TODO: refactor dom agent so we don't need this
function visionActionAdapter(action: ParsedResponseSuccess): Action {
  const args = { ...action.parsedAction.args, uid: "" };
  if ("elementId" in args) {
    args.uid = args.elementId;
  }
  return {
    thought: action.thought,
    operation: {
      name: action.parsedAction.name,
      args,
    } as Action["operation"],
  };
}
