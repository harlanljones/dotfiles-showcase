import { describe, expect, it } from "bun:test";
import { MANIFEST, getManifestEntry } from "../manifest";
import {
  CATALOGUE,
  roomsInOrder,
  annexInOrder,
  getCatalogueEntry,
  isRoom,
  isAnnexDemo,
  receiptPath,
  catalogueAdmissionErrors,
  type RoomId,
} from "./catalogue";

describe("Explorer catalogue: primary rooms", () => {
  it("declares exactly four primary rooms in nav order", () => {
    const rooms = roomsInOrder();
    expect(rooms.map((r) => r.id)).toEqual(["starship", "ghostty", "hyprland", "dots"]);
  });

  it("each room has a canonical route, display word, and lazy flag", () => {
    for (const room of roomsInOrder()) {
      expect(room.route).toMatch(/^\//);
      expect(room.word.length).toBeGreaterThan(0);
      expect(typeof room.lazy).toBe("boolean");
    }
  });

  it("starship is the only eager room (lazy = false)", () => {
    const eager = roomsInOrder().filter((r) => !r.lazy);
    expect(eager.map((r) => r.id)).toEqual(["starship"]);
  });

  it("every room route is a canonical path known to the router", () => {
    const paths = new Set<string>([
      "/prompt", "/palette", "/desk", "/dots",
    ]);
    for (const room of roomsInOrder()) {
      expect(paths.has(room.route)).toBe(true);
    }
  });
});

describe("Explorer catalogue: annex receipts", () => {
  it("declares exactly seven annex demos in the current order", () => {
    const annex = annexInOrder();
    expect(annex.map((a) => a.id)).toEqual([
      "git-safety", "lazygit", "fuzzy", "mise", "packages", "neovim", "ripgrep",
    ]);
  });

  it("each annex demo has a receipt path and a display word", () => {
    for (const entry of annexInOrder()) {
      expect(entry.route).toBe(receiptPath(entry.id));
      expect(entry.word.length).toBeGreaterThan(0);
      expect(entry.lazy).toBe(true);
    }
  });

  it("receiptPath returns the canonical annex route", () => {
    expect(receiptPath("git-safety")).toBe("/annex#git-safety");
    expect(receiptPath("lazygit")).toBe("/annex#lazygit");
  });
});

describe("Explorer catalogue: accessors", () => {
  it("getCatalogueEntry returns the entry for a known id", () => {
    expect(getCatalogueEntry("starship")?.route).toBe("/prompt");
    expect(getCatalogueEntry("git-safety")?.route).toBe("/annex#git-safety");
  });

  it("returns undefined for an unknown id", () => {
    expect(getCatalogueEntry("nonexistent" as never)).toBeUndefined();
  });

  it("isRoom / isAnnexDemo match placement", () => {
    expect(isRoom("starship")).toBe(true);
    expect(isRoom("ghostty")).toBe(true);
    expect(isRoom("git-safety")).toBe(false);
    expect(isAnnexDemo("git-safety")).toBe(true);
    expect(isAnnexDemo("lazygit")).toBe(true);
    expect(isAnnexDemo("starship")).toBe(false);
  });
});

describe("Explorer catalogue: admission invariant", () => {
  it("every catalogue demo has manifest provenance", () => {
    for (const entry of CATALOGUE) {
      expect(getManifestEntry(entry.id), `${entry.id} in manifest`).toBeDefined();
    }
  });

  it("the absorbed demo (recolor) has manifest provenance", () => {
    expect(getManifestEntry("recolor")).toBeDefined();
  });

  it("catalogueAdmissionErrors returns zero errors for the shipped state", () => {
    expect(catalogueAdmissionErrors()).toEqual([]);
  });

  it("detects orphans: a catalogue-only demo", () => {
    // Simulate an extra fake entry by checking the invariants via mutation
    // of a copy is not possible since CATALOGUE is readonly. Instead verify
    // that every manifest live+static+interactive+simulated demo is either
    // catalogued or absorbed.
    const catalogueIds = new Set(CATALOGUE.map((e) => e.id));
    const absorbed = new Set(["recolor" as const]);
    for (const entry of MANIFEST) {
      const ok = catalogueIds.has(entry.id) || absorbed.has(entry.id as never);
      expect(ok, `manifest demo "${entry.id}" is reachable through catalogue or absorbed`).toBe(true);
    }
  });
});