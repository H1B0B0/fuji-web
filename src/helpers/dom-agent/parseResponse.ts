import { ActionPayload, availableActions } from "./availableActions";

export type ParsedResponseSuccess = {
  thought: string;
  action: string;
  parsedAction: ActionPayload;
};

export type ParsedResponse =
  | ParsedResponseSuccess
  | {
      error: string;
    };

// sometimes AI replies with a JSON wrapped in triple backticks
export function extractJsonFromMarkdown(input: string): string[] {
  // Create a regular expression to capture code wrapped in triple backticks
  const regex = /```(json)?\s*([\s\S]*?)\s*```/g;

  const results = [];
  let match;
  while ((match = regex.exec(input)) !== null) {
    // If 'json' is specified, add the content to the results array
    if (match[1] === "json") {
      results.push(match[2]);
    } else if (match[2].startsWith("{")) {
      results.push(match[2]);
    }
  }
  return results;
}

function parseFunctionCall(callString: string) {
  // First, match the function name and the arguments part
  const functionPattern = /(\w+)\(([\s\S]*)\)/;
  const matches = callString.match(functionPattern);

  if (!matches) {
    console.error("Input does not match a function call pattern.", callString);
    throw new Error("Input does not match a function call pattern.");
  }

  const [, name, argsPart] = matches;

  // Then, match the arguments inside the args part
  // This pattern looks for either strings (handling escaped quotes) or numbers as arguments
  const argsPattern = /(["'])(?:(?=(\\?))\2[\s\S])*?\1|\d+/g;
  const argsMatches = argsPart.match(argsPattern);

  // Process matched arguments to strip quotes and unescape characters
  const args = argsMatches
    ? argsMatches.map((arg: string) => {
        // Remove leading and trailing quotes if they exist and unescape characters
        if (
          (arg.startsWith(`"`) && arg.endsWith(`"`)) ||
          (arg.startsWith(`'`) && arg.endsWith(`'`))
        ) {
          arg = arg.slice(1, -1);
          return arg
            .replace(/\\'/g, `'`)
            .replace(/\\"/g, `"`)
            .replace(/\\\\/g, `\\`);
        }
        // Parse numbers directly
        return JSON.parse(arg);
      })
    : [];

  return { name, args };
}

export function parseResponse(text: string): ParsedResponse {
  let action;
  try {
    action = JSON.parse(text);
  } catch (_e) {
    try {
      action = JSON.parse(extractJsonFromMarkdown(text)[0]);
    } catch (_e) {
      throw new Error("Response does not contain valid JSON.");
    }
  }

  if (!action.thought) {
    return {
      error: "Invalid response: Thought not found in the model response.",
    };
  }

  // Handle both JSON object and function-call string formats
  const actionData =
    typeof action.action === "string"
      ? parseFunctionCall(action.action)
      : {
          name: action.action.name,
          args: Object.values(action.action.args),
        };

  const availableAction = availableActions.find(
    (a) => a.name === actionData.name,
  );

  if (!availableAction) {
    return {
      error: `Invalid action: "${actionData.name}" is not a valid action.`,
    };
  }

  const parsedAction = {
    name: availableAction.name,
    args: actionData.args,
  } as ActionPayload;

  return {
    thought: action.thought,
    action:
      typeof action.action === "string"
        ? action.action
        : JSON.stringify(action.action),
    parsedAction,
  };
}
