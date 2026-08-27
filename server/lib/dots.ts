import {
  DOTS_COMMAND_SPECS,
  type DotsCommand,
  type DotsEffect,
} from "../../src/lib/dotsCli";

export interface ParsedDotsScript {
  commands: DotsCommand[];
  missing: string[];
}

interface DispatchEntry {
  aliases: string[];
  handler: string;
}

const FUNCTION_START_RE = /^([A-Za-z_][A-Za-z0-9_]*)\(\)\s*\{\s*$/;
const COMMAND_HELP_RE = /^\s+\$\{CYAN\}([^$]+)\$\{NC\}\s+(.+)$/;
const DISPATCH_RE = /^\s+([^)]*)\)\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+"\$@")?\s*;;\s*$/;

function functionSources(content: string): Map<string, string> {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const starts: Array<{ name: string; line: number }> = [];

  lines.forEach((line, index) => {
    const match = line.match(FUNCTION_START_RE);
    if (match) starts.push({ name: match[1], line: index });
  });

  const sources = new Map<string, string>();
  starts.forEach((start, index) => {
    const boundary = starts[index + 1]?.line ?? lines.length;
    let end = boundary - 1;
    while (end > start.line && lines[end].trim() !== "}") end--;
    if (lines[end]?.trim() === "}") {
      sources.set(start.name, lines.slice(start.line, end + 1).join("\n"));
    }
  });
  return sources;
}

function commandDescriptions(content: string): Map<string, string> {
  const descriptions = new Map<string, string>();
  for (const line of content.replace(/\r\n/g, "\n").split("\n")) {
    const match = line.match(COMMAND_HELP_RE);
    if (!match) continue;
    const names = match[1].split(",").map((name) => name.trim()).filter(Boolean);
    if (names[0]) descriptions.set(names[0], match[2].trim());
  }
  return descriptions;
}

function commandDispatch(content: string): Map<string, DispatchEntry> {
  const dispatch = new Map<string, DispatchEntry>();
  for (const line of content.replace(/\r\n/g, "\n").split("\n")) {
    const match = line.match(DISPATCH_RE);
    if (!match) continue;
    const names = match[1].split("|").map((name) => name.trim()).filter(Boolean);
    const name = names[0];
    if (!name || name === "*") continue;
    dispatch.set(name, { aliases: names.slice(1), handler: match[2] });
  }
  return dispatch;
}

/**
 * Parse the public command contract and exact handler bodies from the served
 * Bash source. This function is intentionally pure: it never invokes `dots`,
 * chezmoi, git, Ollama, or any other command named by the script.
 */
export function parseDotsScript(content: string): ParsedDotsScript {
  const descriptions = commandDescriptions(content);
  const dispatch = commandDispatch(content);
  const sources = functionSources(content);
  const commands: DotsCommand[] = [];
  const effectByName = new Map<string, DotsEffect>(
    DOTS_COMMAND_SPECS.map((spec) => [spec.name, spec.effect]),
  );

  for (const [name, description] of descriptions) {
    const route = dispatch.get(name);
    const handler = route?.handler;
    const handlerSource = handler ? sources.get(handler) : undefined;
    if (!route || !handler || !handlerSource) continue;
    commands.push({
      name,
      aliases: route.aliases,
      description,
      effect: effectByName.get(name) ?? "write",
      handler,
      handlerSource,
    });
  }

  const parsedNames = new Set(commands.map((command) => command.name));
  const missing = DOTS_COMMAND_SPECS
    .map((spec) => spec.name)
    .filter((name) => !parsedNames.has(name));

  return { commands, missing };
}
