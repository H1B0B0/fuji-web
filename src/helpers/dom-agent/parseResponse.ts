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

function normalizeAction(action: any): { thought: string; action: string } {
  const thought = action.thought || "Performing action";

  // Case 1: Handle direct click with target_id
  if (action.action === "click" && action.target_id) {
    return {
      thought,
      action: `click(${action.target_id})`,
    };
  }

  // Case 2: Handle uid format
  if (typeof action.action === "string") {
    const uidMatch = action.action.match(/uid=(\d+)/);
    if (uidMatch) {
      return {
        thought,
        action: `click(${uidMatch[1]})`,
      };
    }
  }

  // Case 3: Already correct format
  return {
    thought,
    action: action.action,
  };
}

interface ParsedActionSuccess {
  name: string;
  args: Record<string, string>;
}

export function parseResponse(
  response: string,
): ParsedResponseSuccess | { error: string } {
  try {
    // Clean and parse JSON
    const parsed = JSON.parse(response.trim());

    if (!parsed.thought || typeof parsed.thought !== "string") {
      return { error: "Missing or invalid 'thought' field" };
    }

    // Vérifier si l'action est un objet avec name et args
    if (
      parsed.action &&
      typeof parsed.action === "object" &&
      parsed.action.name &&
      parsed.action.args
    ) {
      return {
        thought: parsed.thought,
        parsedAction: {
          name: parsed.action.name,
          args: parsed.action.args,
        },
      };
    }

    // Format alternatif où l'action est une chaîne de caractères
    const actionStr = parsed.action;
    if (!actionStr || typeof actionStr !== "string") {
      return { error: "Missing or invalid 'action' field" };
    }

    // Parse action string
    const match = actionStr.match(/^(\w+)\((.*)\)$/);
    if (!match) {
      return { error: "Invalid action format" };
    }

    const [_, name, argsStr] = match;

    try {
      let args: Record<string, string | number> = {};
      if (argsStr.trim()) {
        args = JSON.parse(`{${argsStr}}`);
      }

      const stringArgs: Record<string, string> = {};
      Object.entries(args).forEach(([key, value]) => {
        stringArgs[key] = String(value);
      });

      return {
        thought: parsed.thought,
        parsedAction: {
          name: name,
          args: stringArgs,
        },
      };
    } catch (e) {
      return { error: "Invalid arguments format" };
    }
  } catch (e) {
    console.error("Parse error:", e);
    return { error: "Invalid JSON response" };
  }
}
