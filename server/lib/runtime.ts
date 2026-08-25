/**
 * Runtime detection for dual-mode (Bun vs workerd).
 * Bun exposes globalThis.Bun; workerd does not.
 */
export function isBunRuntime(): boolean {
  return typeof (globalThis as unknown as { Bun?: unknown }).Bun !== "undefined";
}

export function isWorkerd(): boolean {
  return !isBunRuntime();
}
