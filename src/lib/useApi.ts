import { useEffect, useState } from "react";

/** Tiny JSON GET hook with loading/error states. */
export function useJson<T>(url: string): { data: T | null; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => {
        if (alive) setData(d as T);
      })
      .catch((e) => {
        if (alive) setError(String(e instanceof Error ? e.message : e));
      });
    return () => {
      alive = false;
    };
  }, [url]);

  return { data, error };
}

export function postJson<T>(url: string, body: unknown): Promise<T> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<T>;
  });
}
