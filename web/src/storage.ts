// Browser storage that never throws: localStorage, or sessionStorage for what lasts a browser tab's
// session. When storage is blocked, a value lasts until the page closes.
type Area = "localStorage" | "sessionStorage";
const memory = new Map<string, string>();

export function stored(key: string, area: Area = "localStorage"): string | null {
  try {
    return globalThis[area].getItem(key) ?? memory.get(`${area}|${key}`) ?? null;
  } catch {
    return memory.get(`${area}|${key}`) ?? null;
  }
}

export function store(key: string, value: string, area: Area = "localStorage") {
  memory.set(`${area}|${key}`, value);
  try {
    globalThis[area].setItem(key, value);
  } catch {
    // memory only
  }
}
