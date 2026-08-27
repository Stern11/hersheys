/**
 * A minimal in-memory `Storage` implementation.
 *
 * Node has no Web Storage, so the persistence tests install one of these on
 * `globalThis` before exercising a store. `stores/persist-storage.ts` resolves
 * `globalThis.sessionStorage` / `localStorage` lazily on every call precisely
 * so this substitution works without mocking modules.
 */
export function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, String(value)),
  };
}
