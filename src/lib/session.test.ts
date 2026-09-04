import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import {
  isAwake,
  markDemoSeen,
  pagerModeOverride,
  seenDemos,
  setAwake,
  setPagerModeOverride,
} from "./session";

/**
 * HJ-717: session.ts owns every session-scoped persisted value. Covers the
 * real read/write path (via sessionStorage, available in happy-dom) and the
 * degraded path where storage throws (private mode / blocked storage).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let windowRef: any;

beforeEach(() => {
  windowRef = new Window({ url: "http://localhost/" });
  globalThis.sessionStorage = windowRef.sessionStorage;
  sessionStorage.clear();
});

afterEach(() => {
  windowRef.happyDOM.abort();
});

describe("awake flag", () => {
  it("defaults to not awake", () => {
    expect(isAwake()).toBe(false);
  });

  it("remembers awake once set", () => {
    setAwake();
    expect(isAwake()).toBe(true);
  });
});

describe("seen demos", () => {
  it("defaults to an empty set", () => {
    expect(seenDemos()).toEqual(new Set());
  });

  it("accumulates seen demo ids", () => {
    markDemoSeen("starship");
    markDemoSeen("dots");
    markDemoSeen("starship");
    expect(seenDemos()).toEqual(new Set(["starship", "dots"]));
  });

  it("ignores corrupt stored data", () => {
    sessionStorage.setItem("seen-demos", "not json");
    expect(seenDemos()).toEqual(new Set());
  });
});

describe("pager mode override", () => {
  it("defaults to null (no override)", () => {
    expect(pagerModeOverride()).toBeNull();
  });

  it("remembers an explicit mode", () => {
    setPagerModeOverride("paged");
    expect(pagerModeOverride()).toBe("paged");
  });

  it("can be cleared back to null", () => {
    setPagerModeOverride("native");
    setPagerModeOverride(null);
    expect(pagerModeOverride()).toBeNull();
  });

  it("ignores an unrecognised stored value", () => {
    sessionStorage.setItem("pager-mode", "sideways");
    expect(pagerModeOverride()).toBeNull();
  });
});

describe("degraded storage (private mode / blocked storage)", () => {
  function withThrowingSessionStorage<T>(fn: () => T): T {
    const original = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
    const throwing: Storage = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
      removeItem() {
        throw new Error("blocked");
      },
      clear() {
        throw new Error("blocked");
      },
      key() {
        throw new Error("blocked");
      },
      length: 0,
    };
    Object.defineProperty(globalThis, "sessionStorage", { value: throwing, configurable: true });
    try {
      return fn();
    } finally {
      if (original) {
        Object.defineProperty(globalThis, "sessionStorage", original);
      }
    }
  }

  it("reads degrade to defaults instead of throwing", () => {
    withThrowingSessionStorage(() => {
      expect(() => isAwake()).not.toThrow();
      expect(isAwake()).toBe(false);
      expect(() => seenDemos()).not.toThrow();
      expect(seenDemos()).toEqual(new Set());
      expect(() => pagerModeOverride()).not.toThrow();
      expect(pagerModeOverride()).toBeNull();
    });
  });

  it("writes silently no-op instead of throwing", () => {
    withThrowingSessionStorage(() => {
      expect(() => setAwake()).not.toThrow();
      expect(() => markDemoSeen("starship")).not.toThrow();
      expect(() => setPagerModeOverride("paged")).not.toThrow();
      expect(() => setPagerModeOverride(null)).not.toThrow();
    });
  });
});
