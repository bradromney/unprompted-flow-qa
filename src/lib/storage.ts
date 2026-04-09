import type { Issue, StepCorrection } from "./types";

const LS_PREFIX = "flowqa:";
const IDB_NAME = "unprompted-flow-qa";
const IDB_STORE = "blobs";

const META_KEYS = {
  visitedSteps: `${LS_PREFIX}visitedSteps`,
  stepNotes: `${LS_PREFIX}stepNotes`,
  issues: `${LS_PREFIX}issues`,
  corrections: `${LS_PREFIX}corrections`,
  facadeMode: `${LS_PREFIX}facadeMode`,
  facadeCopyMap: `${LS_PREFIX}facadeCopyMap`,
} as const;

const SIZE_THRESHOLD = 50 * 1024;

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
  });
}

export async function idbPut(key: string, value: Blob | ArrayBuffer | string): Promise<void> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(IDB_STORE).put(value, key);
  });
}

export async function idbGet(key: string): Promise<Blob | undefined> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    tx.onerror = () => reject(tx.error);
    const r = tx.objectStore(IDB_STORE).get(key);
    r.onsuccess = () => resolve(r.result as Blob | undefined);
  });
}

export function shouldUseIdb(payload: string): boolean {
  return payload.length >= SIZE_THRESHOLD;
}

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getVisitedSteps(): Record<string, true> {
  return loadJson(META_KEYS.visitedSteps, {});
}

export function setVisitedSteps(m: Record<string, true>): void {
  saveJson(META_KEYS.visitedSteps, m);
}

export function getStepNotes(): Record<string, string> {
  return loadJson(META_KEYS.stepNotes, {});
}

export function setStepNotes(m: Record<string, string>): void {
  saveJson(META_KEYS.stepNotes, m);
}

export function getIssues(): Issue[] {
  return loadJson(META_KEYS.issues, []);
}

export function setIssues(issues: Issue[]): void {
  saveJson(META_KEYS.issues, issues);
}

export function getCorrections(): StepCorrection[] {
  return loadJson(META_KEYS.corrections, []);
}

export function setCorrections(c: StepCorrection[]): void {
  saveJson(META_KEYS.corrections, c);
}

export type FacadeMode = "off" | "empty_state" | "copy_review";

export function getFacadeMode(): FacadeMode {
  return loadJson(META_KEYS.facadeMode, "off");
}

export function setFacadeMode(m: FacadeMode): void {
  saveJson(META_KEYS.facadeMode, m);
}

export function getFacadeCopyMap(): Record<string, string> {
  return loadJson(META_KEYS.facadeCopyMap, {});
}

export function setFacadeCopyMap(m: Record<string, string>): void {
  saveJson(META_KEYS.facadeCopyMap, m);
}

export { META_KEYS };
