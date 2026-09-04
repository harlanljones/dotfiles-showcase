import { useCallback, useEffect, useState } from "react";
import Explorer from "./components/Explorer";

const AWAKE_KEY = "display-awake";

function sessionAwake(): boolean {
  try {
    return sessionStorage.getItem(AWAKE_KEY) === "1";
  } catch {
    return false;
  }
}

export default function App() {
  const [awake, setAwake] = useState(sessionAwake);

  const wake = useCallback(() => {
    try {
      sessionStorage.setItem(AWAKE_KEY, "1");
    } catch {
      /* private mode */
    }
    setAwake(true);
  }, []);

  useEffect(() => {
    if (awake) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") return;
      wake();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [awake, wake]);

  return (
    <div className="display">
      {!awake ? (
        <button type="button" className="veil" onClick={wake} aria-label="Wake display">
          <span className="veil-frame" aria-hidden="true">
            <span className="block-cursor" />
            <span className="veil-copy">
              <span className="veil-title">dotfiles showcase</span>
              <span className="veil-subtitle">terminal-native · local-first</span>
              <span className="veil-hint">press any key — or click — to wake</span>
            </span>
          </span>
        </button>
      ) : (
        <Explorer />
      )}
    </div>
  );
}
