import { useCallback, useEffect, useState } from "react";
import type { CardId } from "../manifest";

export type RoomId = "starship" | "ghostty" | "hyprland" | "dots";

export interface RouteState {
  room: RoomId;
  indexOpen: boolean;
  targetReceipt?: CardId;
}

export const ROOM_PATHS: Record<RoomId, string> = {
  starship: "/prompt",
  ghostty: "/palette",
  hyprland: "/desk",
  dots: "/dots",
};

export const PATH_TO_ROOM: Record<string, RoomId> = {
  "/": "starship",
  "/prompt": "starship",
  "/starship": "starship",
  "/palette": "ghostty",
  "/ghostty": "ghostty",
  "/desk": "hyprland",
  "/hyprland": "hyprland",
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
    return {
      room: "starship",
      indexOpen: true,
      targetReceipt: cleanHash && cleanHash !== "index" && cleanHash !== "annex" ? (cleanHash as CardId) : undefined,
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
 */
export function getRoutePath(state: RouteState): string {
  if (state.indexOpen) {
    return state.targetReceipt ? `/index#${state.targetReceipt}` : "/index";
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
