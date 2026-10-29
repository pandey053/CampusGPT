import "server-only";

type RateWindow = {
  count: number;
  resetsAt: number;
};

const windows = new Map<string, RateWindow>();

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const current = windows.get(key);

  if (windows.size > 2000) {
    for (const [windowKey, window] of windows) {
      if (window.resetsAt <= now) windows.delete(windowKey);
    }
  }

  if (!current || current.resetsAt <= now) {
    windows.set(key, { count: 1, resetsAt: now + windowMs });
    return true;
  }

  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}
