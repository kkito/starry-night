import { vi } from 'vitest';

export interface RecordedCall { method: string; args: unknown[]; }

export function makeMockCtx() {
  const calls: RecordedCall[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(_t, prop: string) {
      if (['fillStyle', 'strokeStyle', 'font', 'textAlign'].includes(prop)) {
        return (...args: unknown[]) => calls.push({ method: `set ${prop}`, args });
      }
      return (...args: unknown[]) => calls.push({ method: prop, args });
    },
    set(_t, prop: string) {
      calls.push({ method: `set ${prop}`, args: [] });
      return true;
    },
  });
  return { calls, ctx: ctx as unknown as CanvasRenderingContext2D };
}

export function installCanvasMock(mock: { ctx: CanvasRenderingContext2D }) {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => mock.ctx) as never;
}
