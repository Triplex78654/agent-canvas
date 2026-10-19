import { useEffect, useRef } from 'react';

interface AutosaveOptions<Args extends readonly unknown[]> {
  enabled: boolean;
  /** Latest values to save; a change schedules a save. */
  args: Args;
  /** String used to skip writes when nothing meaningful changed (e.g. only a status flag). */
  snapshot: (...args: Args) => string;
  save: (...args: Args) => unknown;
  /** Minimum delay between two writes (ms). */
  intervalMs?: number;
}

/**
 * Throttled autosave: at most one write every `intervalMs`, always ending with the latest state,
 * and a final flush when the window closes or the component unmounts (hot reload included).
 */
export function useThrottledAutosave<Args extends readonly unknown[]>({
  enabled,
  args,
  snapshot,
  save,
  intervalMs = 2000,
}: AutosaveOptions<Args>) {
  const latestArgsRef = useRef<Args | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduledAtRef = useRef(0);
  const lastSaveAtRef = useRef(0);
  const lastSnapshotRef = useRef('');
  const saveRef = useRef(save);
  const snapshotRef = useRef(snapshot);
  saveRef.current = save;
  snapshotRef.current = snapshot;

  useEffect(() => {
    if (!enabled) return;
    latestArgsRef.current = args;
    // A timer older than 10s is stale (cancelled by a hot reload): never let it block later saves.
    if (timerRef.current && Date.now() - scheduledAtRef.current < 10_000) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    scheduledAtRef.current = Date.now();
    const wait = Math.max(350, intervalMs - (Date.now() - lastSaveAtRef.current));
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const latest = latestArgsRef.current;
      if (!latest) return;
      const snap = snapshotRef.current(...latest);
      if (snap === lastSnapshotRef.current) return;
      lastSnapshotRef.current = snap;
      lastSaveAtRef.current = Date.now();
      saveRef.current(...latest);
    }, wait);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs, ...args]);

  useEffect(() => {
    // Flush a pending save when the window closes so the last changes are not lost.
    const flush = () => {
      if (!timerRef.current || !latestArgsRef.current) return;
      clearTimeout(timerRef.current);
      timerRef.current = null;
      saveRef.current(...latestArgsRef.current);
    };
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      // Save what is pending AND release the slot: leaving a cancelled timer id here blocked every
      // later save after a hot reload (the Workspace panel was then lost on the next restart).
      flush();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, []);
}
