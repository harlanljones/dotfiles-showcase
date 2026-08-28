import { describe, expect, it } from "bun:test";
import worker from "../server/worker";
import { app } from "../server/app";

/**
 * ANALYTICS-01: /api/t is mounted on the Workers composition only, validates
 * against a fixed event allowlist, caps payload/field sizes, and writes one
 * AE data point per accepted event. Aggregate values only.
 */

const CTX = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

function makeEnv() {
  const written: Array<{ indexes: unknown[]; blobs: unknown[]; doubles: unknown[] }> = [];
  const env = {
    TELEMETRY: {
      writeDataPoint: (point: { indexes: unknown[]; blobs: unknown[]; doubles: unknown[] }) => {
        written.push(point);
      },
    },
  };
  return { env, written };
}

async function post(body: string, env?: Record<string, unknown>): Promise<Response> {
  return worker.fetch(
    new Request("https://mirror.test/api/t", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }),
    env as never,
    CTX,
  );
}

describe("POST /api/t (Workers only)", () => {
  it("writes one data point for a valid event and returns 204", async () => {
    const { env, written } = makeEnv();
    const res = await post(JSON.stringify({ n: "room_switch", f: { from: "starship", to: "dots" } }), env);
    expect(res.status).toBe(204);
    expect(written.length).toBe(1);
    expect(written[0].indexes).toEqual(["room_switch"]);
    const blob = written[0].blobs?.[1] as string;
    expect(blob).toBe("from=starship");
  });

  it("returns 204 without writing when the binding is absent (pre-provisioning)", async () => {
    const res = await post(JSON.stringify({ n: "copy_link" }), {});
    expect(res.status).toBe(204);
  });

  it("rejects unknown event names with 400", async () => {
    const { env, written } = makeEnv();
    const res = await post(JSON.stringify({ n: "exfiltrate_branch", f: { branch: "secret" } }), env);
    expect(res.status).toBe(400);
    expect(written.length).toBe(0);
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await post("{not json");
    expect(res.status).toBe(400);
  });

  it("rejects oversized bodies with 413", async () => {
    const res = await post(JSON.stringify({ n: "copy_link", f: { pad: "x".repeat(600) } }));
    expect(res.status).toBe(413);
  });

  it("caps fields: at most 4 entries, keys and values length-capped", async () => {
    const { env, written } = makeEnv();
    const res = await post(
      JSON.stringify({
        n: "range_committed",
        f: { field: "width", value: 200, extra1: 1, extra2: 2, extra3: 3, dropped: 4 },
      }),
      env,
    );
    expect(res.status).toBe(204);
    expect(written.length).toBe(1);
    expect(written[0].blobs?.length).toBe(1 + 4); // name + 4 capped fields
    const blob = written[0].blobs?.[written[0].blobs!.length - 1] as string;
    expect(blob).toBe("extra2=2");
  });

  it("drops non-aggregate field values (objects/arrays/NaN) instead of writing them", async () => {
    const { env, written } = makeEnv();
    const res = await post(
      JSON.stringify({ n: "flag_toggled", f: { flag: "dirty", branch: { name: "leak" } } }),
      env,
    );
    expect(res.status).toBe(204);
    expect(written[0].blobs).toEqual(["flag_toggled", "flag=dirty"]);
  });

  it("is not mounted on the shared local app (local Bun never serves it)", async () => {
    const res = await app.fetch(
      new Request("http://localhost/api/t", { method: "POST", body: JSON.stringify({ n: "copy_link" }) }),
    );
    expect(res.status).toBe(404);
  });
});
