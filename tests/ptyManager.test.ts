import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';
import os from 'os';

const require = createRequire(import.meta.url);
const { PtyManager, resolveWorkingDirectory } = require('../electron/ptyManager.cjs');

/** Minimal stand-in for node-pty: lets a test push output and see writes/resizes. */
function makeFakePty() {
  const procs: any[] = [];
  return {
    procs,
    spawn: () => {
      const p: any = { writes: [] as string[], resizes: [] as number[][], killed: false };
      p.onData = (cb: (d: string) => void) => (p.emitData = cb);
      p.onExit = (cb: (e: { exitCode: number }) => void) => (p.emitExit = cb);
      p.write = (d: string) => p.writes.push(d);
      p.resize = (c: number, r: number) => p.resizes.push([c, r]);
      p.kill = () => (p.killed = true);
      procs.push(p);
      return p;
    },
  };
}

describe('PtyManager', () => {
  let sent: [string, any][];
  let fake: ReturnType<typeof makeFakePty>;
  let mgr: any;
  beforeEach(() => {
    vi.useFakeTimers();
    sent = [];
    fake = makeFakePty();
    mgr = new PtyManager((ch: string, payload: any) => sent.push([ch, payload]), { ptyBackend: fake });
  });
  afterEach(() => vi.useRealTimers());
  const dataEvents = () => sent.filter(([ch]) => ch === 'pty:data').map(([, p]) => p);

  it('forwards output and detects a CLI prompt as "waiting"', () => {
    mgr.spawnSession('c1', { commandType: 'shell' });
    fake.procs[0].emitData('Rome\r\n❯');
    expect(dataEvents().map((p) => p.data)).toContain('Rome\r\n❯');
    expect(sent).toContainEqual(['pty:status', { id: 'c1', status: 'waiting' }]);
  });

  it('replays history only when asked, flagged as replay', () => {
    mgr.spawnSession('c1', { commandType: 'shell' });
    fake.procs[0].emitData('ancien');
    sent = [];
    mgr.spawnSession('c1', { commandType: 'shell' });
    vi.advanceTimersByTime(100);
    expect(dataEvents()).toEqual([]);
    mgr.spawnSession('c1', { commandType: 'shell', replayHistory: true });
    vi.advanceTimersByTime(100);
    expect(dataEvents()).toEqual([{ id: 'c1', data: 'ancien', replay: true }]);
  });

  it('ignores events from a killed process that was replaced', () => {
    mgr.spawnSession('c1', { commandType: 'shell' });
    mgr.spawnSession('c1', { commandType: 'shell', forceRestart: true });
    const [old, current] = fake.procs;
    expect(old.killed).toBe(true);
    sent = [];
    old.emitData('fantôme');
    old.emitExit({ exitCode: 1 });
    expect(sent).toEqual([]);
    expect(mgr.sessions.has('c1')).toBe(true);
    current.emitData('ok');
    expect(dataEvents()).toEqual([{ id: 'c1', data: 'ok' }]);
  });

  it('buffers output while paused and flushes it on resume', () => {
    mgr.spawnSession('c1', { commandType: 'shell' });
    mgr.setPaused('c1', true);
    fake.procs[0].emitData('pendant la pause');
    expect(dataEvents()).toEqual([]);
    expect(mgr.writeToSession('c1', 'x')).toBe(false);
    mgr.setPaused('c1', false);
    expect(dataEvents()).toEqual([{ id: 'c1', data: 'pendant la pause' }]);
  });

  it('skips same-size resizes (ConPTY would repaint old text)', () => {
    mgr.spawnSession('c1', { commandType: 'shell', cols: 100, rows: 30 });
    mgr.resizeSession('c1', 100, 30);
    mgr.resizeSession('c1', 120, 30);
    expect(fake.procs[0].resizes).toEqual([[120, 30]]);
  });
});

describe('resolveWorkingDirectory', () => {
  it('falls back to the home folder when the project folder does not exist', () => {
    expect(resolveWorkingDirectory('/dossier/qui/n/existe/pas')).toBe(os.homedir());
    expect(resolveWorkingDirectory(os.tmpdir())).toBe(os.tmpdir());
  });
});
