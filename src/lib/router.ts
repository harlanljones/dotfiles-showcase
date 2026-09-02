import { useCallback, useEffect, useState } from "react";
import type { CardId } from "../manifest";
import { isAnnexDemo, receiptPath, type RoomId } from "./catalogue";

export type { RoomId } from "./catalogue";

export interface RouteState {
  room: RoomId;
  indexOpen: boolean;
  targetReceipt?: CardId;
}

/**
 * Canonical room paths come from the catalogue (HJ-678): the catalogue owns
 * a demo's route identity, so these tables are derived from it rather than
 * declared in parallel. The room aliases below are retained for deep-link
 * compatibility with ADR-002.
 */
export const ROOM_PATHS: Record<RoomId, string> = {
  starship: "/prompt",
  ghostty: "/palette",
  hyprland: "/desk",
  dots: "/dots",
};

const ROOM_ALIASES: Record<string, RoomId> = {
  "/": "starship",
  "/starship": "starship",
  "/ghostty": "ghostty",
  "/hyprland": "hyprland",
};

export const PATH_TO_ROOM: Record<string, RoomId> = {
  ...ROOM_ALIASES,
  "/prompt": "starship",
  "/palette": "ghostty",
  "/desk": "hyprland",
  "/dots": "dots",
};

/**
 * Normalizes a raw path/hash into canonical RouteState.
 */
export function parseRoute(pathname = "/", hash = ""): RouteState {
  let cleanPath = pathname.replace(/\/+$/, "") || "/";
  const cleanHash = hash.replace(/^#\/?/, "").toLowerCase();

  // Handle /index or /annex path or #index hash
  if (cleanPath === "/index" || cleanPath === "/annex" || cleanHash === "index" || cleanHash === "annex") {
    const requested = cleanHash && cleanHash !== "index" && cleanHash !== "annex"
      ? (cleanHash as CardId)
      : undefined;
    // Only annex demos are valid receipts: an unknown or absorbed id must not
    // produce a targeted (but unreachable) receipt.
    const targetReceipt = requested && isAnnexDemo(requested) ? requested : undefined;
    return {
      room: "starship",
      indexOpen: true,
      targetReceipt,
    };
  }

  // Handle hash-based room navigation as fallback (e.g., #/dots or #dots)
  if (cleanHash && PATH_TO_ROOM[`/${cleanHash}`]) {
    return {
      room: PATH_TO_ROOM[`/${cleanHash}`],
      indexOpen: false,
    };
  }

  const room = PATH_TO_ROOM[cleanPath.toLowerCase()] ?? "starship";
  return {
    room,
    indexOpen: false,
  };
}

/**
 * Returns canonical URL path for a given RouteState.
 * The annex canonicalizes to /annex — Workers assets 307-redirects /index to /,
 * which would drop a refreshed visitor out of the annex (DEPLOY-09 finding).
 */
export function getRoutePath(state: RouteState): string {
  if (state.indexOpen) {
    return state.targetReceipt ? receiptPath(state.targetReceipt) : "/annex";
  }
  return ROOM_PATHS[state.room] ?? "/prompt";
}

/**
 * Pushes or replaces history state.
 */
export function updateHistory(state: RouteState, replace = false, search = ""): void {
  if (typeof window === "undefined" || !window.history) return;

  const path = getRoutePath(state);
  const fullUrl = search ? `${path}${search.startsWith("?") ? search : `?${search}`}` : path;

  const currentPath = window.location.pathname + window.location.search + window.location.hash;
  if (currentPath === fullUrl) return;

  if (replace) {
    window.history.replaceState({ ...state }, "", fullUrl);
  } else {
    window.history.pushState({ ...state }, "", fullUrl);
  }
}

/**
 * Hook to read and subscribe to route changes.
 */
export function useRouter() {
  const [route, setRouteState] = useState<RouteState>(() => {
    if (typeof window === "undefined") {
      return { room: "starship", indexOpen: false };
    }
    return parseRoute(window.location.pathname, window.location.hash);
  });

  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseRoute(window.location.pathname, window.location.hash);
      setRouteState(parsed);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback((next: Partial<RouteState>, replace = false) => {
    setRouteState((prev) => {
      const updated: RouteState = {
        room: next.room ?? prev.room,
        indexOpen: next.indexOpen ?? prev.indexOpen,
        targetReceipt: next.targetReceipt,
      };
      updateHistory(updated, replace, window.location.search);
      return updated;
    });
  }, []);

  return { route, navigate };
}