export type DotsEffect = "read" | "navigate" | "write";

export interface DotsCommand {
  name: string;
  aliases: string[];
  description: string;
  effect: DotsEffect;
  handler: string;
  handlerSource: string;
}

export interface DotsCardPayload {
  source: "live" | "fallback";
  commands: DotsCommand[];
  warnings: string[];
}

export const DOTS_COMMAND_SPECS = [
  { name: "sync", effect: "write" },
  { name: "diff", effect: "read" },
  { name: "status", effect: "read" },
  { name: "absorb", effect: "write" },
  { name: "edit", effect: "write" },
  { name: "cd", effect: "navigate" },
  { name: "update", effect: "write" },
  { name: "push", effect: "write" },
  { name: "doctor", effect: "read" },
  { name: "help", effect: "read" },
] as const satisfies ReadonlyArray<{ name: string; effect: DotsEffect }>;

export const DOTS_COMMAND_NAMES = DOTS_COMMAND_SPECS.map((command) => command.name);

