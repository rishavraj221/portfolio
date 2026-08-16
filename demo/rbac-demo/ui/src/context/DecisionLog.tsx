import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export interface DecisionLogEntry {
  id: string;
  ts: number;
  path: "local" | "central";
  action: string;
  resource: string;
  decision: "allow" | "deny";
  reason: string;
}

interface DecisionLogValue {
  entries: DecisionLogEntry[];
  log: (entry: Omit<DecisionLogEntry, "id" | "ts">) => void;
  clear: () => void;
}

const DecisionLogContext = createContext<DecisionLogValue | null>(null);

export function DecisionLogProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<DecisionLogEntry[]>([]);

  const log = useCallback((entry: Omit<DecisionLogEntry, "id" | "ts">) => {
    setEntries((prev) =>
      [{ ...entry, id: crypto.randomUUID(), ts: Date.now() }, ...prev].slice(0, 100),
    );
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  return (
    <DecisionLogContext.Provider value={{ entries, log, clear }}>{children}</DecisionLogContext.Provider>
  );
}

export function useDecisionLog(): DecisionLogValue {
  const ctx = useContext(DecisionLogContext);
  if (!ctx) throw new Error("useDecisionLog must be used within DecisionLogProvider");
  return ctx;
}
