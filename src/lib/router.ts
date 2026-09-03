import { useCallback, useEffect, useState } from "react";
import type { CardId } from "../manifest";
import {
  CATEGORIES,
  type CategoryId,
  getCategoryForCard,
  isCard,
} from "./catalogue";

export type { CategoryId } from "./catalogue";
/** Backward compatibility alias */
export type RoomId = CategoryId;

export interface RouteState {
  category: CategoryId;
  targetCard?: CardId;
  /** Backward compatibility alias matching category */
  room?: CategoryId;
}

export const CATEGORY_PATHS: Record<CategoryId, string> = {
  system: "/system",
  shell: "/shell",
  editor: "/editor",
  agents: "/agents",
};

/** Backward compatibility mapping */
export const ROOM_PATHS: Record<string, string> = {
  ...CATEGORY_PATHS,
  starship: "/shell#starship",
  ghostty: "/system#ghostty",
  hyprland: "/system#hyprland",
  dots: "/system#dots",
};

/**
 * Legacy aliases for deep-link compatibility.
 */
const LEGACY_ALIASES: Record<string, { category: CategoryId; targetCard?: CardId }> = {
  "/prompt": { category: "shell", targetCard: "starship" },
  "/starship": { category: "shell", targetCard: "starship" },
  "/palette": { category: "system", targetCard: "ghostty" },
  "/ghostty": { category: "system", targetCard: "ghostty" },
  "/desk": { category: "system", targetCard: "hyprland" },
  "/hyprland": { category: "system", targetCard: "hyprland" },
  "/dots": { category: "system", targetCard: "dots" },
};

/**
 * Normalizes a raw path/hash into canonical RouteState.
 */
export function parseRoute(pathname = "/", hash = ""): RouteState {
  const cleanPath = pathname.replace(/\/+$/, "").toLowerCase() || "/";
  const cleanHash = hash.replace(/^#\/?/, "").toLowerCase();

  const requestedCard = cleanHash && isCard(cleanHash) ? (cleanHash as CardId) : undefined;

  // 1. Direct category path match (/system, /shell, /editor, /agents)
  for (const cat of CATEGORIES) {
    if (cleanPath === cat.route) {
      const targetCard = requestedCard && getCategoryForCard(requestedCard) === cat.id ? requestedCard : requestedCard;
      return {
        category: cat.id,
        targetCard,
        room: cat.id,
      };
    }
  }

  // 2. Legacy /index or /annex path or #index / #annex hash
  if (cleanPath === "/index" || cleanPath === "/annex" || cleanHash === "index" || cleanHash === "annex") {
    if (requestedCard) {
      const cat = getCategoryForCard(requestedCard) ?? "agents";
      return {
        category: cat,
        targetCard: requestedCard,
        room: cat,
      };
    }
    return {
      category: "system",
      room: "system",
    };
  }

  // 3. Legacy room path aliases (/prompt, /palette, /desk, /dots, etc.)
  if (LEGACY_ALIASES[cleanPath]) {
    const alias = LEGACY_ALIASES[cleanPath];
    const targetCard = requestedCard ?? alias.targetCard;
    return {
      category: alias.category,
      targetCard,
      room: alias.category,
    };
  }

  // 4. Hash-based category or card navigation
  if (cleanHash) {
    const catMatch = CATEGORIES.find((c) => c.id === cleanHash || `/${c.id}` === cleanHash);
    if (catMatch) {
      return { category: catMatch.id, room: catMatch.id };
    }
    if (requestedCard) {
      const cat = getCategoryForCard(requestedCard) ?? "system";
      return {
        category: cat,
        targetCard: requestedCard,
        room: cat,
      };
    }
  }

  // 5. Default fallback to /system
  return {
    category: "system",
    room: "system",
  };
}

/**
 * Returns canonical URL path for a given RouteState.
 */
export function getRoutePath(state: RouteState): string {
  const basePath = CATEGORY_PATHS[state.category] ?? "/system";
  if (state.targetCard) {
    return `${basePath}#${state.targetCard}`;
  }
  return basePath;
}

/**
 * Pushes or replaces history state.
 */
export function updateHistory(state: RouteState, replace = false, search = ""): void {
  if (typeof window === "undefined" || !window.history) return;

  const path = getRoutePath(state);
  const hashIndex = path.indexOf("#");
  const basePath = hashIndex !== -1 ? path.slice(0, hashIndex) : path;
  const hashPart = hashIndex !== -1 ? path.slice(hashIndex) : "";

  const formattedSearch = search ? (search.startsWith("?") ? search : `?${search}`) : "";
  const fullUrl = `${basePath}${formattedSearch}${hashPart}`;

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
      return { category: "system", room: "system" };
    }
    return parseRoute(window.location.pathname, window.location.hash);
  });

  useEffect(() => {
    const handleUrlChange = () => {
      const parsed = parseRoute(window.location.pathname, window.location.hash);
      setRouteState(parsed);
    };

    window.addEventListener("popstate", handleUrlChange);
    window.addEventListener("hashchange", handleUrlChange);
    return () => {
      window.removeEventListener("popstate", handleUrlChange);
      window.removeEventListener("hashchange", handleUrlChange);
    };
  }, []);

  const navigate = useCallback((next: Partial<RouteState>, replace = false) => {
    setRouteState((prev) => {
      const category = next.category ?? prev.category;
      const targetCard = "targetCard" in next ? next.targetCard : prev.targetCard;
      const updated: RouteState = {
        category,
        targetCard,
        room: category,
      };
      updateHistory(updated, replace, window.location.search);
      return updated;
    });
  }, []);

  return { route, navigate };
}