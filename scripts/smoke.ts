/**
 * Post-deploy smoke verification (HJ-716).
 *
 * DEPLOY-10's original smoke job asserted 200 on a hardcoded list of retired
 * "room" routes (/prompt, /palette, /desk, /dots, /annex). Those paths pass
 * against ANY Workers deploy because `wrangler.jsonc` sets
 * `not_found_handling: "single-page-application"` — every unmatched path
 * returns the app shell (`dist/index.html`) with HTTP 200. The router is
 * entirely client-side (`src/lib/router.ts`); a curl 200 on a path proves
 * only that the Worker is up, never that the app actually routes there. The
 * job would have stayed green even with the router deleted outright.
 *
 * This script closes that gap with two independent layers that must BOTH
 * pass for a route to count as verified:
 *
 *  1. HTTP reachability — the deployed URL responds 200 and serves the real
 *     app shell (the `<div id="root">` mount point), not an error page.
 *  2. Routing resolution — `parseRoute` (the exact client-side router the
 *     bundle ships) resolves the path/hash to the SPECIFIC category (and,
 *     for the demo deep link, the specific card) expected — not merely
 *     *some* category via the router's permissive unknown-path fallback.
 *
 * Layer 2 is what gives this teeth: it exercises the real routing logic
 * in-process, so a deleted/broken router fails the check even though every
 * HTTP response is still a 200. See `tests/smoke.test.ts` for a regression
 * test that runs the OLD retired route list through `isCanonicalRoute` and
 * shows it fails — proof the old list is not a legitimate target of this
 * gate, which a bare 200 check could never show.
 *
 * Usage:
 *   bun run scripts/smoke.ts <base-url>
 *   BASE_URL=https://example.workers.dev bun run scripts/smoke.ts
 *
 * Verification logic is exported and injectable (fetch) for unit testing;
 * `main()` wires the real fetch and process exit code.
 */
import { CATEGORY_PATHS, parseRoute } from "../src/lib/router";
import { CATALOGUE, type CategoryId } from "../src/lib/catalogue";
import type { CardId } from "../src/manifest";

// ---------------------------------------------------------------------------
// Route declarations — sourced from the app's own catalogue/router, not
// re-typed literals, so this file can't silently drift from what actually
// ships. `EXPECTED_CATEGORY_COUNT` is a static tripwire: if the catalogue is
// ever gutted down to nothing, deriving routes from it would silently yield
// an empty (vacuously-passing) list, exactly the failure mode this ticket
// exists to close. Asserting a nonzero, exact count catches that.
// ---------------------------------------------------------------------------

const EXPECTED_CATEGORY_COUNT = 4;

export interface CategoryRouteCheck {
  path: string;
  category: CategoryId;
}

export const CATEGORY_ROUTES: CategoryRouteCheck[] = Object.entries(CATEGORY_PATHS).map(
  ([category, path]) => ({ category: category as CategoryId, path }),
);

/**
 * Representative showcase-demo deep link. Starship is the one eager
 * (non-lazy) card — the wake path every visitor hits first — making it the
 * most representative demo to assert reaches its exact card, not just its
 * category.
 */
export const DEMO_DEEPLINK = {
  path: "/shell",
  hash: "#starship",
  category: "shell" as CategoryId,
  card: "starship" as CardId,
};

/** Paths this job asserted before HJ-716 — retired "room" routes. */
export const RETIRED_ROOM_ROUTES = ["/prompt", "/palette", "/desk", "/dots", "/annex"];

// ---------------------------------------------------------------------------
// Layer 2: routing resolution (no network — exercises the real router)
// ---------------------------------------------------------------------------

/**
 * True only if `path` is exactly one of today's canonical category routes
 * (`CATEGORY_PATHS` values). Legacy aliases (`/prompt`, `/dots`, ...) still
 * resolve via `parseRoute`'s backwards-compat table, but that's navigation
 * convenience, not proof they're a current category view — this is
 * deliberately stricter than "does parseRoute resolve it to something."
 */
export function isCanonicalRoute(path: string): boolean {
  return Object.values(CATEGORY_PATHS).includes(path);
}

export interface RoutingFailure {
  path: string;
  detail: string;
}

/**
 * Verifies the shipped router resolves each declared category path to its
 * specific category (not the permissive unknown-path fallback), and the
 * demo deep link resolves to its specific card. Returns failure details;
 * empty means every routing assertion held.
 */
export function verifyRouting(routes: CategoryRouteCheck[] = CATEGORY_ROUTES): RoutingFailure[] {
  const failures: RoutingFailure[] = [];

  if (routes.length !== EXPECTED_CATEGORY_COUNT) {
    failures.push({
      path: "(catalogue)",
      detail: `expected ${EXPECTED_CATEGORY_COUNT} category routes, catalogue declares ${routes.length}`,
    });
  }

  for (const { path, category } of routes) {
    const resolved = parseRoute(path, "");
    if (resolved.category !== category) {
      failures.push({
        path,
        detail: `parseRoute resolved category "${resolved.category}", expected "${category}"`,
      });
    }
  }

  const demo = parseRoute(DEMO_DEEPLINK.path, DEMO_DEEPLINK.hash);
  if (demo.category !== DEMO_DEEPLINK.category || demo.targetCard !== DEMO_DEEPLINK.card) {
    failures.push({
      path: `${DEMO_DEEPLINK.path}${DEMO_DEEPLINK.hash}`,
      detail: `parseRoute resolved category="${demo.category}" targetCard="${demo.targetCard}", expected category="${DEMO_DEEPLINK.category}" targetCard="${DEMO_DEEPLINK.card}"`,
    });
  }

  return failures;
}

/** Sanity: the demo card is really in the catalogue under the claimed category. */
export function verifyDemoInCatalogue(): RoutingFailure[] {
  const entry = CATALOGUE.find((e) => e.id === DEMO_DEEPLINK.card);
  if (!entry) {
    return [{ path: DEMO_DEEPLINK.path, detail: `demo card "${DEMO_DEEPLINK.card}" not found in CATALOGUE` }];
  }
  if (entry.category !== DEMO_DEEPLINK.category) {
    return [
      {
        path: DEMO_DEEPLINK.path,
        detail: `demo card "${DEMO_DEEPLINK.card}" belongs to category "${entry.category}", expected "${DEMO_DEEPLINK.category}"`,
      },
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Layer 1: HTTP reachability (network — injectable for tests)
// ---------------------------------------------------------------------------

export type FetchLike = (url: string) => Promise<{ status: number; text: () => Promise<string> }>;

export interface HttpFailure {
  path: string;
  detail: string;
}

/** Fetches `base + path` and asserts 200 + the real app-shell mount point. */
export async function checkReachable(fetchImpl: FetchLike, base: string, path: string): Promise<HttpFailure | null> {
  const res = await fetchImpl(`${base}${path}`);
  if (res.status !== 200) {
    return { path, detail: `HTTP ${res.status} (expected 200)` };
  }
  const body = await res.text();
  if (!body.includes('<div id="root"></div>')) {
    return { path, detail: "app-shell body missing root mount point" };
  }
  return null;
}

export async function checkAllReachable(
  fetchImpl: FetchLike,
  base: string,
  routes: CategoryRouteCheck[] = CATEGORY_ROUTES,
): Promise<HttpFailure[]> {
  const paths = [...routes.map((r) => r.path), DEMO_DEEPLINK.path];
  const results = await Promise.all(paths.map((p) => checkReachable(fetchImpl, base, p)));
  return results.filter((r): r is HttpFailure => r !== null);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const base = process.argv[2] ?? process.env.BASE_URL;
  if (!base) {
    console.error("usage: bun run scripts/smoke.ts <base-url> (or set BASE_URL)");
    process.exit(1);
  }

  const routingFailures = [...verifyRouting(), ...verifyDemoInCatalogue()];
  const httpFailures = await checkAllReachable(fetch as FetchLike, base);

  const allFailures = [...routingFailures, ...httpFailures];
  if (allFailures.length > 0) {
    for (const f of allFailures) {
      console.error(`::error::route ${f.path} -> ${f.detail}`);
    }
    console.error(`\n${allFailures.length} smoke assertion(s) failed.`);
    process.exit(1);
  }

  console.log(
    `post-deploy smoke: ${CATEGORY_ROUTES.length} category route(s) + demo deep link "${DEMO_DEEPLINK.path}${DEMO_DEEPLINK.hash}" — all reachable and correctly routed`,
  );
}

if (import.meta.main) {
  main();
}
