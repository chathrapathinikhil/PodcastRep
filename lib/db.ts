// Small local JSON store for this take-home app.
import fs from 'fs';
import path from 'path';
import type { AdMarker, Ad } from '@/types';

const g = globalThis as any;
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'vidpod-db.json');

const DEFAULT_ADS: Ad[] = [];

const DEFAULT_MARKERS: AdMarker[] = [];

interface LocalDb {
  markers: AdMarker[];
  ads: Ad[];
}

function readDb(): LocalDb {
  try {
    if (!fs.existsSync(DB_FILE)) return { markers: [...DEFAULT_MARKERS], ads: [...DEFAULT_ADS] };
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) as Partial<LocalDb>;
    return {
      markers: Array.isArray(parsed.markers) ? parsed.markers : [],
      ads: Array.isArray(parsed.ads) ? parsed.ads : [],
    };
  } catch {
    return { markers: [...DEFAULT_MARKERS], ads: [...DEFAULT_ADS] };
  }
}

function writeDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify({ markers: g.__vidpod_markers, ads: g.__vidpod_ads }, null, 2)
  );
}

if (g.__vidpod_seed_version !== 3) {
  const saved = readDb();
  g.__vidpod_seed_version = 3;
  g.__vidpod_markers = saved.markers;
  g.__vidpod_ads = saved.ads;
}

if (!g.__vidpod_markers) g.__vidpod_markers = [];
if (!g.__vidpod_ads) g.__vidpod_ads = [];

export const db = {
  markers: {
    getAll: (): AdMarker[] => [...g.__vidpod_markers],
    get: (id: string): AdMarker | undefined => g.__vidpod_markers.find((m: AdMarker) => m.id === id),
    create: (data: Omit<AdMarker, 'id'> & { id?: string }): AdMarker => {
      const marker: AdMarker = { ...data, id: data.id ?? crypto.randomUUID() };
      g.__vidpod_markers.push(marker);
      writeDb();
      return marker;
    },
    update: (id: string, data: Partial<AdMarker>): AdMarker | null => {
      const idx = g.__vidpod_markers.findIndex((m: AdMarker) => m.id === id);
      if (idx === -1) return null;
      g.__vidpod_markers[idx] = { ...g.__vidpod_markers[idx], ...data };
      writeDb();
      return g.__vidpod_markers[idx];
    },
    delete: (id: string): boolean => {
      const idx = g.__vidpod_markers.findIndex((m: AdMarker) => m.id === id);
      if (idx === -1) return false;
      g.__vidpod_markers.splice(idx, 1);
      writeDb();
      return true;
    },
  },
  ads: {
    getAll: (): Ad[] => [...g.__vidpod_ads],
    create: (data: Omit<Ad, 'id'>): Ad => {
      const ad: Ad = { ...data, id: crypto.randomUUID() };
      g.__vidpod_ads.push(ad);
      writeDb();
      return ad;
    },
  },
};
