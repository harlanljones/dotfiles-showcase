import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { CardId } from "../../manifest";
import type { CategoryId } from "../../lib/catalogue";
import { buildPaletteIndex } from "../../lib/paletteIndex";
import { searchPalette, type PaletteResult } from "../../lib/paletteSearch";

/**
 * The / palette (HJ-725): search showcase demos and real configuration
 * content, opened on `/` and from the persistent .palette-trigger button in
 * the chrome (the only route in on touch, and how desktop visitors discover
 * the binding at all).
 *
 * This component owns UI state only (query text, selected index, focus).
 * Matching and ranking live in `paletteSearch.ts` — a pure module the index
 * (`paletteIndex.ts`) is handed to; this file never scores anything itself.
 */

export interface PaletteDestination {
  category: CategoryId;
  targetCard: CardId;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (destination: PaletteDestination) => void;
}

function clampSelection(selected: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(Math.max(selected, 0), length - 1);
}

export default function CommandPalette({ open, onClose, onNavigate }: CommandPaletteProps) {
  // Built once per mount — buildPaletteIndex reads only already-imported,
  // already-generated modules (CATALOGUE/MANIFEST/SEARCH_INDEX), never the
  // network or the filesystem.
  const index = useMemo(() => buildPaletteIndex(), []);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const listId = useId();
  const titleId = useId();

  const results = useMemo(() => searchPalette(index, query), [index, query]);
  const safeSelected = clampSelection(selected, results.length);
  const hasResults = results.length > 0;
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!open) return;
    openerRef.current = (document.activeElement as HTMLElement) ?? null;
    setQuery("");
    setSelected(0);
    // Focus after the dialog paints so it's interactive on first keystroke.
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (open) return;
    openerRef.current?.focus?.();
  }, [open]);

  if (!open) return null;

  const commit = (result: PaletteResult) => {
    onNavigate({ category: result.entry.category, targetCard: result.entry.demoId });
    onClose();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((s) => clampSelection(s + 1, results.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((s) => clampSelection(s - 1, results.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const result = results[safeSelected];
      if (result) commit(result);
    } else if (event.key === "Tab") {
      // A single-field dialog: keep focus on the input rather than letting
      // Tab escape to the page behind the scrim.
      event.preventDefault();
    }
  };

  const activeOptionId = hasResults ? `${listId}-option-${safeSelected}` : undefined;

  return (
    <div className="palette-scrim" onMouseDown={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId} className="sr-only">
          Search showcase demos and configuration
        </h2>
        <div className="palette-input-row">
          <span aria-hidden="true" className="palette-slash">
            /
          </span>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={hasResults}
            aria-controls={hasResults ? listId : undefined}
            aria-activedescendant={activeOptionId}
            aria-autocomplete="list"
            aria-label="Search demos and configuration"
            placeholder="search demos or configuration…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(0);
            }}
            className="palette-field"
          />
          <button type="button" className="palette-close" onClick={onClose}>
            esc
          </button>
        </div>

        {trimmedQuery &&
          (hasResults ? (
            <ul id={listId} role="listbox" aria-label="Search results" className="palette-results">
              {results.map((result, i) => (
                <li
                  key={`${result.entry.kind}-${result.entry.demoId}-${result.matchedOn}-${i}`}
                  id={`${listId}-option-${i}`}
                  role="option"
                  aria-selected={i === safeSelected}
                  className={`palette-result${i === safeSelected ? " is-active" : ""}`}
                  onMouseEnter={() => setSelected(i)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    commit(result);
                  }}
                >
                  {result.entry.kind === "demo" ? (
                    <>
                      <span className="palette-result-label">{result.entry.label}</span>
                      <span className="palette-result-meta">demo</span>
                    </>
                  ) : (
                    <>
                      <span className="palette-result-label">
                        {result.entry.key} <span className="palette-result-value">{result.entry.value}</span>
                      </span>
                      <span className="palette-result-meta">{result.entry.configPath}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p role="status" className="palette-empty">
              no matches for &ldquo;{trimmedQuery}&rdquo;
            </p>
          ))}
      </div>
    </div>
  );
}
