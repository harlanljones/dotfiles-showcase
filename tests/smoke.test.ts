import { describe, expect, test } from "bun:test";
import {
  CATEGORY_ROUTES,
  DEMO_DEEPLINK,
  RETIRED_ROOM_ROUTES,
  checkAllReachable,
  checkReachable,
  isCanonicalRoute,
  verifyDemoInCatalogue,
  verifyRouting,
  type CategoryRouteCheck,
  type FetchLike,
} from "../scripts/smoke";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function fakeShellResponse(status = 200, body = '<div id="root"></div>'): { status: number; text: () => Promise<string> } {
  return { status, text: async () => body };
}

/** SPA-fallback fetch: every path returns 200 + the app shell, no exceptions. */
function alwaysShellFetch(): FetchLike {
  return async () => fakeShellResponse();
}

// ---------------------------------------------------------------------------
// Layer 1: HTTP reachability
// ---------------------------------------------------------------------------

describe("checkReachable", () => {
  test("passes on 200 + app-shell body", async () => {
    const result = await checkReachable(alwaysShellFetch(), "https://example.workers.dev", "/system");
    expect(result).toBeNull();
  });

  test("fails on non-200", async () => {
    const fetchImpl: FetchLike = async () => fakeShellResponse(404);
    const result = await checkReachable(fetchImpl, "https://example.workers.dev", "/system");
    expect(result).toMatchObject({ path: "/system", detail: expect.stringContaining("404") });
  });

  test("fails when the root mount point is missing", async () => {
    const fetchImpl: FetchLike = async () => fakeShellResponse(200, "<html><body>not the app</body></html>");
    const result = await checkReachable(fetchImpl, "https://example.workers.dev", "/system");
    expect(result).toMatchObject({ path: "/system", detail: expect.stringContaining("root mount point") });
  });
});

describe("checkAllReachable", () => {
  test("checks every category route plus the demo deep link's base path", async () => {
    const seen: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      seen.push(url);
      return fakeShellResponse();
    };
    const failures = await checkAllReachable(fetchImpl, "https://example.workers.dev");
    expect(failures).toEqual([]);
    expect(seen).toEqual(
      expect.arrayContaining(["https://example.workers.dev/system", "https://example.workers.dev/shell", "https://example.workers.dev/editor", "https://example.workers.dev/agents"]),
    );
    // demo deep link's server-visible path (hash never reaches the server)
    expect(seen).toContain(`https://example.workers.dev${DEMO_DEEPLINK.path}`);
  });
});

// ---------------------------------------------------------------------------
// Layer 2: routing resolution — the layer that gives this teeth
// ---------------------------------------------------------------------------

describe("verifyRouting", () => {
  test("passes for today's real catalogue-derived category routes", () => {
    expect(verifyRouting()).toEqual([]);
  });

  test("passes the demo deep link's catalogue membership", () => {
    expect(verifyDemoInCatalogue()).toEqual([]);
  });

  test("catches a category route that stops resolving to its category (route deleted/rewired)", () => {
    const broken: CategoryRouteCheck[] = [
      { path: "/system", category: "system" },
      { path: "/shell", category: "shell" },
      { path: "/editor", category: "editor" },
      // simulates a regression: /agents no longer maps to "agents"
      { path: "/agents", category: "editor" },
    ];
    const failures = verifyRouting(broken);
    expect(failures.some((f) => f.path === "/agents")).toBe(true);
  });

  test("catches a shrunk catalogue (the vacuous-pass failure mode this ticket exists to close)", () => {
    const gutted: CategoryRouteCheck[] = [{ path: "/system", category: "system" }];
    const failures = verifyRouting(gutted);
    expect(failures.some((f) => f.detail.includes("expected 4 category routes"))).toBe(true);
  });

  test("REGRESSION: the pre-HJ-716 retired room-route list fails the canonical-route gate", () => {
    // DEPLOY-10 originally asserted these five paths as if they were category
    // views. They still 200 today only because of `parseRoute`'s permissive
    // legacy-alias / unknown-path fallback — the exact behavior that let a
    // deleted router pass silently under a bare-200 check. None of them is a
    // canonical category route, so this new, stricter gate correctly rejects
    // every one of them: proof the old route list would never have been
    // trusted by this job, and proof this job has teeth where curl-200 alone
    // did not.
    for (const path of RETIRED_ROOM_ROUTES) {
      expect(isCanonicalRoute(path)).toBe(false);
    }
  });

  test("today's category routes all pass the canonical-route gate", () => {
    for (const { path } of CATEGORY_ROUTES) {
      expect(isCanonicalRoute(path)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Full-gate regression: a router deletion stays invisible to HTTP-only
// checks but is caught once routing resolution is required too.
// ---------------------------------------------------------------------------

describe("router-deleted regression (why layer 1 alone is vacuous)", () => {
  test("an HTTP-only check (the pre-HJ-716 shape) stays green even against a route the router no longer knows", async () => {
    // Simulates deleting the router entirely: the Worker still serves the
    // app shell for anything (single-page-application fallback), so a
    // bare 200 + body check reports success regardless of routing reality.
    const httpFailures = await checkAllReachable(alwaysShellFetch(), "https://example.workers.dev", [
      { path: "/prompt", category: "shell" },
    ]);
    expect(httpFailures).toEqual([]); // green — this is the bug HJ-716 fixes
  });

  test("the routing-resolution layer fails the same scenario", () => {
    const failures = verifyRouting([{ path: "/prompt", category: "shell" }]);
    // /prompt is not a canonical category route; even though parseRoute's
    // legacy alias resolves it to "shell", the count tripwire below is the
    // one guaranteed to fire for any catalogue that isn't exactly today's 4.
    expect(failures.some((f) => f.detail.includes("expected 4 category routes"))).toBe(true);
  });
});
