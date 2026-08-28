import { describe, expect, it } from "bun:test";
import { emit, telemetryEnabled } from "./telemetry";

/**
 * ANALYTICS-01 client guard: emits nothing without a browser window, nothing
 * on localhost/loopback/*.local hosts, and uses navigator.sendBeacon when
 * available. Aggregate payloads only.
 */

type BeaconSpy = { calls: Array<{ url: string; data: string }> };

async function beaconData(data: BodyInit): Promise<string> {
  if (typeof data === "string") return data;
  if (data instanceof Blob) return await data.text();
  return String(data);
}

function withWindow(host: string | null, sendBeacon?: (url: string, data: BodyInit) => boolean): BeaconSpy {
  const spy: BeaconSpy = { calls: [] };
  const g = globalThis as Record<string, unknown>;
  if (host === null) {
    delete g.window;
    delete g.navigator;
    return spy;
  }
  g.window = { location: { hostname: host } };
  if (sendBeacon) {
    g.navigator = {
      sendBeacon: (url: string, data: BodyInit) => {
        void beaconData(data).then((text) => spy.calls.push({ url, data: text }));
        return true;
      },
    };
  } else {
    delete g.navigator;
  }
  return spy;
}

function cleanup() {
  const g = globalThis as Record<string, unknown>;
  delete g.window;
  delete g.navigator;
}

describe("telemetryEnabled", () => {
  it("is false without a window (SSR/tests)", () => {
    withWindow(null);
    expect(telemetryEnabled()).toBe(false);
    cleanup();
  });

  it("is false on localhost, loopback, and *.local", () => {
    for (const host of ["localhost", "127.0.0.1", "::1", "omarchy.local", ""]) {
      withWindow(host);
      expect(telemetryEnabled()).toBe(false);
    }
    cleanup();
  });

  it("is true on a deployed host", () => {
    withWindow("dotfiles-showcase.harlanljones.workers.dev");
    expect(telemetryEnabled()).toBe(true);
    cleanup();
  });
});

describe("emit", () => {
  it("sends the JSON payload via sendBeacon when enabled", async () => {
    const spy = withWindow("dotfiles-showcase.harlanljones.workers.dev", () => true);
    emit("room_switch", { from: "starship", to: "dots" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(spy.calls.length).toBe(1);
    expect(spy.calls[0].url).toBe("/api/t");
    expect(JSON.parse(spy.calls[0].data)).toEqual({ n: "room_switch", f: { from: "starship", to: "dots" } });
    cleanup();
  });

  it("never throws and never emits when disabled", () => {
    withWindow("localhost");
    expect(() => emit("copy_link")).not.toThrow();
    cleanup();
    withWindow(null);
    expect(() => emit("copy_link")).not.toThrow();
    cleanup();
  });
});
