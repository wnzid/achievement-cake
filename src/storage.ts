import { defaultThemeId } from "./themes";

export const ACH_CAKES_INDEX_KEY = "ac_cakes_index_v1";
export const ACTIVE_CAKE_KEY = "ac_active_cake_v1";
export const cakeKey = (id: string) => `ac_cake_${id}_v1`;

type CakeMeta = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  themeId: string;
};

type CakesIndex = {
  cakes: CakeMeta[];
  activeId: string | null;
};

function now() {
  return Date.now();
}

export function loadIndex(): CakesIndex | null {
  try {
    const raw = localStorage.getItem(ACH_CAKES_INDEX_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CakesIndex;
  } catch (e) {
    console.error("Failed to parse cakes index", e);
    return null;
  }
}

export function saveIndex(idx: CakesIndex) {
  localStorage.setItem(ACH_CAKES_INDEX_KEY, JSON.stringify(idx));
}

export function loadCakePicks(id: string): any[] {
  try {
    const raw = localStorage.getItem(cakeKey(id));
    if (!raw) return [];
    return JSON.parse(raw) as any[];
  } catch (e) {
    console.error("Failed to parse cake picks", e);
    return [];
  }
}

export function saveCakePicks(id: string, picks: any[]) {
  localStorage.setItem(cakeKey(id), JSON.stringify(picks));
}

export function createNewCake(name: string, initialPicks: any[] = [], themeId: string = defaultThemeId) {
  const id = (crypto as any).randomUUID();
  const meta: CakeMeta = { id, name, createdAt: now(), updatedAt: now(), themeId };
  const idx = loadIndex();
  const newIdx: CakesIndex = idx
    ? { cakes: [...idx.cakes, meta], activeId: id }
    : { cakes: [meta], activeId: id };
  saveCakePicks(id, initialPicks);
  saveIndex(newIdx);
  localStorage.setItem(ACTIVE_CAKE_KEY, id);
  return { id, meta, idx: newIdx };
}

export function setActiveCake(id: string) {
  const idx = loadIndex();
  if (!idx) return;
  idx.activeId = id;
  saveIndex(idx);
  localStorage.setItem(ACTIVE_CAKE_KEY, id);
}

export function getActiveCakeId(): string | null {
  const idx = loadIndex();
  if (idx && idx.activeId) return idx.activeId;
  const fromLS = localStorage.getItem(ACTIVE_CAKE_KEY);
  return fromLS || null;
}

export function updateCakeMetaName(id: string, name: string) {
  const idx = loadIndex();
  if (!idx) return;
  const found = idx.cakes.find(c => c.id === id);
  if (!found) return;
  found.name = name;
  found.updatedAt = now();
  saveIndex(idx);
}

export function updateCakeTheme(id: string, themeId: string) {
  const idx = loadIndex();
  if (!idx) return;
  const found = idx.cakes.find(c => c.id === id);
  if (!found) return;
  found.themeId = themeId;
  found.updatedAt = now();
  saveIndex(idx);
}

export function touchCakeUpdated(id: string) {
  const idx = loadIndex();
  if (!idx) return;
  const found = idx.cakes.find(c => c.id === id);
  if (!found) return;
  found.updatedAt = now();
  saveIndex(idx);
}

export function deleteCake(id: string) {
  const idx = loadIndex();
  if (!idx) return idx;
  const remaining = idx.cakes.filter(c => c.id !== id);
  const active = idx.activeId === id ? (remaining[0]?.id ?? null) : idx.activeId;
  const newIdx: CakesIndex = { cakes: remaining, activeId: active };
  saveIndex(newIdx);
  localStorage.removeItem(cakeKey(id));
  if (active) localStorage.setItem(ACTIVE_CAKE_KEY, active);
  return newIdx;
}

export function duplicateCake(id: string, newName?: string) {
  const idx = loadIndex();
  if (!idx) return null;
  const src = idx.cakes.find(c => c.id === id);
  if (!src) return null;
  const picks = loadCakePicks(id);
  const name = newName || `Copy of ${src.name}`;
  return createNewCake(name, picks, (src as any).themeId ?? defaultThemeId);
}
