import type { Terminal } from '@xterm/xterm';

type Point = { clientX: number; clientY: number };
type Rect = { left: number; top: number; width: number; height: number };

/**
 * Bring a mouse position measured on a zoomed element back to the element's own (unzoomed) pixels.
 * `layoutWidth/Height` are the sizes without CSS transform (offsetWidth/offsetHeight). Pure (tested).
 */
export function unscalePoint(point: Point, rect: Rect, layoutWidth: number, layoutHeight: number): Point {
  const scaleX = layoutWidth > 0 ? rect.width / layoutWidth : 1;
  const scaleY = layoutHeight > 0 ? rect.height / layoutHeight : 1;
  if (!scaleX || !scaleY || (Math.abs(scaleX - 1) < 0.001 && Math.abs(scaleY - 1) < 0.001)) return point;
  return {
    clientX: rect.left + (point.clientX - rect.left) / scaleX,
    clientY: rect.top + (point.clientY - rect.top) / scaleY,
  };
}

/**
 * xterm.js measures the mouse in screen pixels but its cells in unzoomed pixels. Inside the zoomable
 * canvas (React Flow applies a CSS scale), text selection and clicks therefore landed on the wrong
 * lines/columns, more and more the further from the top-left corner. This corrects both the selection
 * and the mouse reports sent to full-screen CLIs. Call it right after `term.open()`.
 */
export function fixXtermMouseForCssScale(term: Terminal): void {
  const mouseService = (term as unknown as { _core?: { _mouseService?: any } })._core?._mouseService;
  if (!mouseService || mouseService.__scaleFixed) return;
  const correct = (event: Point, element: HTMLElement): Point =>
    unscalePoint(
      event,
      element.getBoundingClientRect(),
      element.offsetWidth,
      element.offsetHeight
    );

  const originalGetCoords = mouseService.getCoords?.bind(mouseService);
  if (originalGetCoords) {
    mouseService.getCoords = (event: Point, element: HTMLElement, ...rest: unknown[]) =>
      originalGetCoords(correct(event, element), element, ...rest);
  }
  const originalReport = mouseService.getMouseReportCoords?.bind(mouseService);
  if (originalReport) {
    mouseService.getMouseReportCoords = (event: MouseEvent, element: HTMLElement) => {
      const p = correct(event, element);
      // Only clientX/clientY are read from the event.
      return originalReport({ clientX: p.clientX, clientY: p.clientY } as MouseEvent, element);
    };
  }
  mouseService.__scaleFixed = true;
}
