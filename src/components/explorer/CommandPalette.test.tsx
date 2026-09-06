import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { Window } from "happy-dom";
import { createRoot } from "react-dom/client";
import { act, createElement } from "react";
import CommandPalette from "./CommandPalette";

/**
 * HJ-725 component test: the palette against the real (generated) index —
 * fixture-only coverage of matching/ranking lives in
 * `src/lib/paletteSearch.test.ts`. This file exercises the UI contract: open
 * state, keyboard operability, and that selecting a hit navigates to the
 * demo that renders it.
 *
 * Two happy-dom/react-dom interop quirks show up here that don't in the
 * rest of the suite (nothing else types into or sends keys to a controlled
 * input):
 *  - react-dom's real-`input`-event feature detection runs once at module
 *    import time, before any test's `beforeEach` window exists, so it
 *    latches to "unsupported" for the whole process; a real `input` event
 *    dispatch never reaches `onChange`. `type()` below drives the change
 *    the same way the browser would have — through the `onChange` prop
 *    React itself attached to the node — sidestepping that dead code path
 *    entirely rather than fighting it.
 *  - react-dom's selection-tracking plugin resolves the DOM's actual
 *    activeElement on keydown/keyup for any text input; without a real
 *    focus event first, that lookup is empty and the plugin throws before
 *    `onKeyDown` ever runs. Every keyboard test below focuses the input
 *    first for exactly this reason.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let container: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let windowRef: any;

const GLOBAL_KEYS = [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLInputElement",
  "getComputedStyle",
] as const;
let savedGlobals: Array<[string, unknown]> = [];

beforeEach(() => {
  const g = globalThis as Record<string, unknown>;
  savedGlobals = GLOBAL_KEYS.map((k) => [k, g[k]]);

  windowRef = new Window({ url: "http://localhost/system" });
  globalThis.window = windowRef;
  globalThis.document = windowRef.document;
  globalThis.navigator = windowRef.navigator;
  globalThis.HTMLElement = windowRef.HTMLElement;
  (globalThis as Record<string, unknown>).HTMLInputElement = windowRef.HTMLInputElement;
  globalThis.getComputedStyle = windowRef.getComputedStyle.bind(windowRef);

  container = windowRef.document.createElement("div");
  windowRef.document.body.appendChild(container);
});

afterEach(() => {
  windowRef.happyDOM.abort();
  const g = globalThis as Record<string, unknown>;
  for (const [key, value] of savedGlobals) {
    if (value === undefined) delete g[key];
    else g[key] = value;
  }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reactOnChange(node: any): ((event: unknown) => void) | undefined {
  const key = Object.keys(node).find((k) => k.startsWith("__reactProps$"));
  return key ? node[key]?.onChange : undefined;
}

/** Sets the input's value and invokes the same onChange React itself wired up. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function type(input: any, value: string): void {
  input.value = value;
  reactOnChange(input)?.({ target: input, currentTarget: input });
}

/** Real focus + real keydown, in that order — see file header for why both steps matter. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pressKey(target: any, key: string): Promise<void> {
  await act(async () => {
    target.focus();
  });
  await act(async () => {
    target.dispatchEvent(new windowRef.KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

describe("CommandPalette: open state", () => {
  it("renders nothing when closed", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(CommandPalette, { open: false, onClose: () => {}, onNavigate: () => {} }));
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("renders an accessible dialog with a combobox input when open", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(CommandPalette, { open: true, onClose: () => {}, onNavigate: () => {} }));
    });
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    expect(container.querySelector('[role="combobox"]')).not.toBeNull();
  });
});

describe("CommandPalette: matches the showcase catalogue and real configuration", () => {
  it("shows a matching demo result for a catalogue word", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(CommandPalette, { open: true, onClose: () => {}, onNavigate: () => {} }));
    });
    const input = container.querySelector('[role="combobox"]');
    await act(async () => {
      type(input, "starship");
    });
    const options = Array.from<any>(container.querySelectorAll('[role="option"]'));
    expect(options.some((o) => o.textContent?.toLowerCase().includes("starship"))).toBe(true);
  });

  it("shows a matching configuration result for a real setting key", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(CommandPalette, { open: true, onClose: () => {}, onNavigate: () => {} }));
    });
    const input = container.querySelector('[role="combobox"]');
    await act(async () => {
      type(input, "add_newline");
    });
    const options = Array.from<any>(container.querySelectorAll('[role="option"]'));
    expect(options.some((o) => o.textContent?.includes("add_newline"))).toBe(true);
  });

  it("shows a status message, not an empty listbox, when nothing matches", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(CommandPalette, { open: true, onClose: () => {}, onNavigate: () => {} }));
    });
    const input = container.querySelector('[role="combobox"]');
    await act(async () => {
      type(input, "zzz-no-such-setting-zzz");
    });
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toContain("no matches");
  });
});

describe("CommandPalette: selecting a hit navigates to the demo that renders it", () => {
  it("navigates to the owning demo when a configuration hit is clicked", async () => {
    let navigated: unknown = null;
    const onNavigate = mock((destination: unknown) => {
      navigated = destination;
    });
    const onClose = mock(() => {});
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(CommandPalette, { open: true, onClose, onNavigate }));
    });
    const input = container.querySelector('[role="combobox"]');
    await act(async () => {
      type(input, "add_newline");
    });
    const option = container.querySelector('[role="option"]');
    await act(async () => {
      option!.dispatchEvent(new windowRef.MouseEvent("mousedown", { bubbles: true }));
    });
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(navigated).toMatchObject({ category: "shell", targetCard: "starship" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("navigates via Enter on the keyboard-selected result", async () => {
    let navigated: unknown = null;
    const onNavigate = mock((destination: unknown) => {
      navigated = destination;
    });
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(CommandPalette, { open: true, onClose: () => {}, onNavigate }));
    });
    const input = container.querySelector('[role="combobox"]');
    await act(async () => {
      type(input, "starship");
    });
    await pressKey(input, "Enter");
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect((navigated as { targetCard: string }).targetCard).toBe("starship");
  });
});

describe("CommandPalette: keyboard operability", () => {
  it("closes on Escape", async () => {
    const onClose = mock(() => {});
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(CommandPalette, { open: true, onClose, onNavigate: () => {} }));
    });
    const input = container.querySelector('[role="combobox"]');
    await pressKey(input, "Escape");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("moves aria-activedescendant with ArrowDown", async () => {
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(CommandPalette, { open: true, onClose: () => {}, onNavigate: () => {} }));
    });
    const input = container.querySelector('[role="combobox"]');
    await act(async () => {
      type(input, "e"); // broad enough to match several demo labels/blurbs
    });
    const before = input.getAttribute("aria-activedescendant");
    await pressKey(input, "ArrowDown");
    const after = input.getAttribute("aria-activedescendant");
    expect(before).not.toBeNull();
    expect(after).not.toBe(before);
  });
});
