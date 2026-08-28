export type ShellMode = "zsh" | "bash";
export type GitState = "none" | "rebase" | "merge";

export interface PromptState {
  branch: string;
  dirty: boolean;
  ahead: number;
  behind: number;
  detached: boolean;
  state: GitState;
  ssh: boolean;
  shell: ShellMode;
  status: number;
  durationMs: number;
  width: number;
  trueColor: boolean;
}

export const DEFAULT_PROMPT_STATE: PromptState = {
  branch: "main",
  dirty: false,
  ahead: 0,
  behind: 0,
  detached: false,
  state: "none",
  ssh: false,
  shell: "zsh",
  status: 0,
  durationMs: 0,
  width: 200,
  trueColor: false,
};

/**
 * Parses URLSearchParams / search string into a partial or complete PromptState.
 */
export function decodePromptState(
  search: string | URLSearchParams,
  fallback: PromptState = DEFAULT_PROMPT_STATE,
): PromptState {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const result: PromptState = { ...fallback };

  if (params.has("branch")) {
    result.branch = params.get("branch") || fallback.branch;
  }
  if (params.has("dirty")) {
    const v = params.get("dirty");
    result.dirty = v === "1" || v === "true";
  }
  if (params.has("ahead")) {
    const v = parseInt(params.get("ahead") ?? "", 10);
    if (!Number.isNaN(v) && v >= 0) result.ahead = v;
  }
  if (params.has("behind")) {
    const v = parseInt(params.get("behind") ?? "", 10);
    if (!Number.isNaN(v) && v >= 0) result.behind = v;
  }
  if (params.has("detached")) {
    const v = params.get("detached");
    result.detached = v === "1" || v === "true";
  }
  if (params.has("state")) {
    const v = params.get("state");
    if (v === "none" || v === "rebase" || v === "merge") {
      result.state = v;
    }
  }
  if (params.has("ssh")) {
    const v = params.get("ssh");
    result.ssh = v === "1" || v === "true";
  }
  if (params.has("shell")) {
    const v = params.get("shell");
    if (v === "zsh" || v === "bash") {
      result.shell = v;
    }
  }
  if (params.has("status")) {
    const v = parseInt(params.get("status") ?? "", 10);
    if (!Number.isNaN(v)) result.status = v === 0 ? 0 : 1;
  }
  if (params.has("durationMs") || params.has("duration")) {
    const raw = params.get("durationMs") ?? params.get("duration") ?? "";
    const v = parseInt(raw, 10);
    if (!Number.isNaN(v) && v >= 0) result.durationMs = v;
  }
  if (params.has("width")) {
    const v = parseInt(params.get("width") ?? "", 10);
    if (!Number.isNaN(v) && v >= 60 && v <= 200) result.width = v;
  }
  if (params.has("trueColor") || params.has("tc")) {
    const v = params.get("trueColor") ?? params.get("tc");
    result.trueColor = v === "1" || v === "true";
  }

  return result;
}

/**
 * Encodes PromptState into compact URL search string, omitting defaults.
 */
export function encodePromptState(
  state: PromptState,
  defaults: PromptState = DEFAULT_PROMPT_STATE,
): string {
  const params = new URLSearchParams();

  if (state.branch !== defaults.branch) params.set("branch", state.branch);
  if (state.dirty !== defaults.dirty) params.set("dirty", state.dirty ? "1" : "0");
  if (state.ahead !== defaults.ahead) params.set("ahead", String(state.ahead));
  if (state.behind !== defaults.behind) params.set("behind", String(state.behind));
  if (state.detached !== defaults.detached) params.set("detached", state.detached ? "1" : "0");
  if (state.state !== defaults.state) params.set("state", state.state);
  if (state.ssh !== defaults.ssh) params.set("ssh", state.ssh ? "1" : "0");
  if (state.shell !== defaults.shell) params.set("shell", state.shell);
  if (state.status !== defaults.status) params.set("status", String(state.status));
  if (state.durationMs !== defaults.durationMs) params.set("durationMs", String(state.durationMs));
  if (state.width !== defaults.width) params.set("width", String(state.width));
  if (state.trueColor !== defaults.trueColor) params.set("trueColor", state.trueColor ? "1" : "0");

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
