import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import { createRoot } from "react-dom/client";
import { act } from "react";
import App from "./App";
import { isAwake } from "./lib/session";

/**
 * HJ-721: the veil is stripped to unlit glass and a single block cursor —
 * no title, tagline, or hint — and waking hands off to Explorer rather than
 * a static finished view.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let container: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let windowRef: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let root: any;

const GLOBAL_KEYS = ["window", "document", "navigator", "HTMLElement", "getComputedStyle", "fetch", "sessionStorage"] as const;
let savedGlobals: Array<[string, unknown]> = [];

beforeEach(() => {
  const g = globalThis as Record<string, unknown>;
  savedGlobals = GLOBAL_KEYS.map((k) => [k, g[k]]);

  windowRef = new Window({ url: "http://localhost/" });
  globalThis.window = windowRef;
  globalThis.document = windowRef.document;
  globalThis.navigator = windowRef.navigator;
  globalThis.HTMLElement = windowRef.HTMLElement;
  globalThis.getComputedStyle = windowRef.getComputedStyle.bind(windowRef);
  globalThis.sessionStorage = windowRef.sessionStorage;
  // StarshipCard/StarshipPlayground fire /api/starship once awake; keep it
  // pending so renders stay deterministic without a network mock per test.
  (globalThis as Record<string, unknown>).fetch = () => new Promise(() => {});
  sessionStorage.clear();

  container = windowRef.document.createElement("div");
  windowRef.document.body.appendChild(container);
});

afterEach(async () => {
  // Unmount before tearing down globals so effects/timers scheduled by the
  // wake transition (Explorer mounting StarshipPlayground) settle within
  // this test's window rather than firing after the next test's globals
  // are in place. React's concurrent scheduler posts pending work via a
  // macrotask even past unmount, so give it a tick to flush first.
  if (root) {
    await act(async () => {
      root.unmount();
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    root = undefined;
  }
  windowRef.happyDOM.abort();
  const g = globalThis as Record<string, unknown>;
  for (const [key, value] of savedGlobals) {
    if (value === undefined) delete g[key];
    else g[key] = value;
  }
});

describe("veil: bare glass and a block cursor", () => {
  it("first paint has no title, tagline, or hint — just the wake button and its cursor", async () => {
    root = createRoot(container);
    await act(async () => {
      root.render(<App />);
    });

    const veil = container.querySelector(".veil");
    expect(veil).not.toBeNull();
    expect(veil.querySelector(".block-cursor")).not.toBeNull();
    expect(veil.textContent?.trim()).toBe("");
    expect(container.querySelector(".veil-title")).toBeNull();
    expect(container.querySelector(".veil-subtitle")).toBeNull();
    expect(container.querySelector(".veil-hint")).toBeNull();
    expect(container.querySelector(".category-tabs")).toBeNull();
  });

  it("clicking the veil wakes the display and hands off to the Explorer shell", async () => {
    root = createRoot(container);
    await act(async () => {
      root.render(<App />);
    });

    const veil = container.querySelector(".veil");
    await act(async () => {
      veil.click();
    });

    expect(container.querySelector(".veil")).toBeNull();
    expect(container.querySelector(".category-tabs")).not.toBeNull();
    expect(isAwake()).toBe(true);
  });

  it("pressing a key (not Tab) wakes the display", async () => {
    root = createRoot(container);
    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      windowRef.dispatchEvent(new windowRef.KeyboardEvent("keydown", { key: "Enter" }));
    });

    expect(container.querySelector(".veil")).toBeNull();
    expect(container.querySelector(".category-tabs")).not.toBeNull();
  });

  it("Tab alone does not wake the display", async () => {
    root = createRoot(container);
    await act(async () => {
      root.render(<App />);
    });

    await act(async () => {
      windowRef.dispatchEvent(new windowRef.KeyboardEvent("keydown", { key: "Tab" }));
    });

    expect(container.querySelector(".veil")).not.toBeNull();
  });

  it("a returning visitor within the session skips the veil entirely", async () => {
    const { setAwake } = await import("./lib/session");
    setAwake();

    root = createRoot(container);
    await act(async () => {
      root.render(<App />);
    });

    expect(container.querySelector(".veil")).toBeNull();
    expect(container.querySelector(".category-tabs")).not.toBeNull();
  });
});
