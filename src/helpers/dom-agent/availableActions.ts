const commonActions = [
  {
    name: "wait",
    description:
      "Wait for 3 seconds before the next action. Useful when the page is loading.",
    args: [],
  },
  {
    name: "finish",
    description: "Indicate the task is finished",
    args: [],
  },
  {
    name: "fail",
    description: "Indicate that you are unable to complete the task",
    args: [],
  },
] as const;

export const availableActions = [
  {
    name: "click",
    description: "Click on an element",
    args: [
      {
        name: "elementId",
        type: "string",
      },
    ],
  },
  {
    name: "setValue",
    description: "Focus on and sets the value of an input element",
    args: [
      {
        name: "elementId",
        type: "string",
      },
      {
        name: "value",
        type: "string",
      },
    ],
  },
  {
    name: "scroll",
    description:
      'Scroll the page to see the other parts. Use "up" or "down" to scroll 2/3 of height of the window. Use "top" or "bottom" to quickly scroll to the top or bottom of the page.',
    args: [
      {
        name: "direction",
        type: "string",
      },
    ],
  },
  {
    name: "navigate",
    description: "Navigate to a new page",
    args: [
      {
        name: "url",
        type: "string",
      },
    ],
  },
  {
    name: "setValueAndEnter",
    description:
      'Like "setValue", except then it presses ENTER. Use this tool can submit the form when there\'s no "submit" button.',
    args: [
      {
        name: "elementId",
        type: "string",
      },
      {
        name: "value",
        type: "string",
      },
    ],
  },
  ...commonActions,
] as const;

type AvailableAction = (typeof availableActions)[number];

type ArgsToObject<T extends ReadonlyArray<{ name: string; type: string }>> = {
  [K in T[number]["name"]]: Extract<
    T[number],
    { name: K }
  >["type"] extends "number"
    ? number
    : string;
};

export type ActionShape<
  T extends {
    name: string;
    args: ReadonlyArray<{ name: string; type: string }>;
  },
> = {
  name: T["name"];
  args: ArgsToObject<T["args"]>;
};

export type ActionPayload = {
  [K in AvailableAction["name"]]: ActionShape<
    Extract<AvailableAction, { name: K }>
  >;
}[AvailableAction["name"]];
