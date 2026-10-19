// Browser storage, wrapped: when storage is blocked the page still works and nothing is remembered.
export function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // blocked: keep the choice for this visit only
  }
}
