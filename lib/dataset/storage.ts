/**
 * Local persistence for an uploaded planning dataset.
 *
 * Uploaded workbook data stays in the browser. It is never posted to a server,
 * an LLM, or analytics (V2 §36) — IndexedDB is the whole storage story.
 *
 * A demo dataset is never stored here: it is regenerated from its seed, which
 * is both smaller and guaranteed to stay in step with the generator.
 */

import type { PlanningDataset } from "@/types/dataset";

const DB_NAME = "heizen";
const DB_VERSION = 1;
const STORE = "datasets";
const ACTIVE_KEY = "active-upload";

function supported(): boolean {
  return typeof globalThis !== "undefined" && "indexedDB" in globalThis;
}

function openDb(): Promise<IDBDatabase | null> {
  if (!supported()) return Promise.resolve(null);
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      // Private-mode browsers can throw on open rather than erroring.
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

/**
 * Every operation resolves rather than rejects. Storage being unavailable is a
 * degraded session, not a crash — the caller falls back to keeping the dataset
 * in memory for the current page.
 */
async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest,
  fallback: T
): Promise<T> {
  const db = await openDb();
  if (!db) return fallback;
  return new Promise<T>((resolve) => {
    let request: IDBRequest;
    try {
      request = run(db.transaction(STORE, mode).objectStore(STORE));
    } catch {
      db.close();
      resolve(fallback);
      return;
    }
    request.onsuccess = () => {
      resolve((request.result as T) ?? fallback);
      db.close();
    };
    request.onerror = () => {
      resolve(fallback);
      db.close();
    };
  });
}

export async function saveUploadedDataset(dataset: PlanningDataset): Promise<boolean> {
  const stored = await withStore<unknown>("readwrite", (s) => s.put(dataset, ACTIVE_KEY), null);
  return stored !== null || supported();
}

export async function loadUploadedDataset(): Promise<PlanningDataset | null> {
  return withStore<PlanningDataset | null>("readonly", (s) => s.get(ACTIVE_KEY), null);
}

export async function clearUploadedDataset(): Promise<void> {
  await withStore<unknown>("readwrite", (s) => s.delete(ACTIVE_KEY), null);
}

/** Whether uploaded data can survive a refresh in this browser. */
export function persistenceAvailable(): boolean {
  return supported();
}
