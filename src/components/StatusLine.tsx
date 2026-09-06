/**
 * The pager's status line (HJ-722): how the pager teaches itself. Carries
 * the open showcase demo, page position, percent through, and the active
 * key hints — all as text, not conveyed by layout alone, so it's available
 * to assistive tech and to anyone reading the DOM.
 *
 * `flash` briefly emphasizes the hints — used on the first scroll attempt,
 * so a visitor who reaches for the wheel/trackpad sees the pager's keys
 * rather than being silently ignored.
 */
export default function StatusLine({
  demoWord,
  page,
  pageCount,
  percent,
  flash,
}: {
  demoWord: string;
  page: number;
  pageCount: number;
  percent: number;
  flash: boolean;
}) {
  return (
    <div
      className={`status-line${flash ? " status-line-flash" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="status-line-demo">{demoWord}</span>
      <span className="status-line-position">
        page {page + 1}/{pageCount}
      </span>
      <span className="status-line-percent">{percent}%</span>
      <span className="status-line-hints">j/k page · space page · h/l switch demo</span>
    </div>
  );
}
