import { useEffect, useRef } from "react";

/** Calls `fn` every `intervalMs` until it returns true, it throws, or the component unmounts. */
export function usePoll(fn: (() => Promise<boolean>) | null, intervalMs: number) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const active = fn !== null;

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (stopped || !fnRef.current) return;
      const done = await fnRef.current().catch(() => true);
      if (!done && !stopped) timer = setTimeout(tick, intervalMs);
    };
    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [active, intervalMs]);
}
