// Browser storage that never throws. When storage is blocked, a value lasts until the page closes.
const memory = new Map<string, string>();

export function stored(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

export function store(key: string, value: string) {
  memory.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    // memory only
  }
}
