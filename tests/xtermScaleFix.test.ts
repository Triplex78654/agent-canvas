import { describe, expect, it } from 'vitest';
import { unscalePoint } from '../src/lib/xtermScaleFix';

describe('unscalePoint (terminal inside the zoomed canvas)', () => {
  const rect = { left: 100, top: 50, width: 400, height: 200 }; // drawn at 50 % of 800×400

  it('maps a click at half zoom back to the real cell position', () => {
    expect(unscalePoint({ clientX: 300, clientY: 150 }, rect, 800, 400)).toEqual({ clientX: 500, clientY: 250 });
  });
  it('keeps the top-left corner in place', () => {
    expect(unscalePoint({ clientX: 100, clientY: 50 }, rect, 800, 400)).toEqual({ clientX: 100, clientY: 50 });
  });
  it('does nothing at 100 % zoom', () => {
    const p = { clientX: 321, clientY: 123 };
    expect(unscalePoint(p, { left: 0, top: 0, width: 800, height: 400 }, 800, 400)).toBe(p);
  });
  it('ignores hidden elements (no layout size)', () => {
    const p = { clientX: 5, clientY: 5 };
    expect(unscalePoint(p, rect, 0, 0)).toBe(p);
  });
});
