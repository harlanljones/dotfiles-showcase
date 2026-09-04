import { useEffect, useMemo, useRef, useState } from "react";
import { searchCorpus, type DemoRef } from "../lib/search";
import { CONFIG_INDEX } from "../lib/configIndex";

/**
 * The `/` palette (HJ-715 wave 1): ripgrep over the rice. Searches the
 * Explorer catalogue (demo names) and the visitor's real configuration
 * content (HJ-719's generated index once it lands; demo names only until
 * then). Selecting a configuration hit navigates to the demo that renders
 * that configuration.
 */
export default function Palette({
  demos,
  onSelect,
  onClose,
  initialQuery = "",
}: {
  demos: readonly DemoRef[];
  onSelect: (demoId: string) => void;
  onClose: () => void;
  /** Test seam (and future `?q=` deep-link): the query to start with. */
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(
    () => searchCorpus({ demos, configs: CONFIG_INDEX }, query),
    [demos, query],
  );

  return (
    <div className="palette-veil" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search demos and configuration"
        className="palette"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          role="searchbox"
          aria-label="Search demos and configuration"
          placeholder="search demos and config…  (esc to close)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            else if (e.key === "Enter" && results.length > 0) onSelect(results[0].demoId);
          }}
          className="palette-input"
        />
        {query.trim() !== "" && (
          <ul aria-label="search results" className="palette-results">
            {results.length === 0 && (
              <li className="palette-empty">no match — try a demo name or a config key</li>
            )}
            {results.map((hit) => (
              <li key={`${hit.kind}:${hit.demoId}:${hit.label}`}>
                <button type="button" className="palette-hit" onClick={() => onSelect(hit.demoId)}>
                  <span className="palette-hit-kind">{hit.kind === "demo" ? "demo" : "config"}</span>
                  <span className="palette-hit-label">{hit.label}</span>
                  <span className="palette-hit-detail">{hit.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
