import { create } from 'zustand';
import type { AdMarker, Ad, PlaybackMode } from '@/types';

const INITIAL_ADS: Ad[] = [];

const INITIAL_MARKERS: AdMarker[] = [];

const api = {
  async getMarkers(): Promise<AdMarker[]> {
    const r = await fetch('/api/markers');
    return r.json();
  },
  async createMarker(data: Omit<AdMarker, 'id'>): Promise<AdMarker> {
    const r = await fetch('/api/markers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return r.json();
  },
  async updateMarker(id: string, data: Partial<AdMarker>): Promise<AdMarker> {
    const r = await fetch(`/api/markers/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return r.json();
  },
  async deleteMarker(id: string): Promise<void> {
    await fetch(`/api/markers/${id}`, { method: 'DELETE' });
  },
  async getAds(): Promise<Ad[]> {
    const r = await fetch('/api/ads');
    return r.json();
  },
  async createAd(data: Omit<Ad, 'id'>): Promise<Ad> {
    const r = await fetch('/api/ads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return r.json();
  },
};

interface Store {
  // Data
  markers: AdMarker[];
  ads: Ad[];

  // Undo/redo history
  past: AdMarker[][];
  future: AdMarker[][];

  // Video state (shared so timeline + player stay in sync)
  currentTime: number;
  previousTime: number;
  duration: number;
  isPlaying: boolean;
  isAdPlaying: boolean;
  mode: PlaybackMode;
  playedMarkerIds: string[];
  pendingResumeTime: number | null;

  // UI
  selectedMarkerId: string | null;
  zoom: number; // multiplier: 1 = full video fits, 2 = 2x zoom, etc.
  scrollLeft: number; // timeline horizontal scroll offset in pixels

  // Actions
  loadData: () => Promise<void>;
  
  // Marker CRUD (syncs with server + updates history)
  addMarker: (data: Omit<AdMarker, 'id'>) => Promise<void>;
  updateMarker: (id: string, updates: Partial<AdMarker>) => Promise<void>;
  deleteMarker: (id: string) => Promise<void>;
  addAd: (data: Omit<Ad, 'id'>) => Promise<Ad>;
  
  // Drag updates are saved once the marker is released.
  beginMarkerMove: () => void;
  moveMarkerLocal: (id: string, time: number) => void;
  flushMarkerMove: (id: string) => Promise<void>;
  
  undo: () => Promise<void>;
  redo: () => Promise<void>;

  selectMarker: (id: string | null) => void;
  setZoom: (zoom: number) => void;
  setScrollLeft: (x: number) => void;
  setCurrentTime: (t: number) => void;
  setPreviousTime: (t: number) => void;
  setDuration: (d: number) => void;
  setPlaying: (p: boolean) => void;
  setAdPlaying: (p: boolean) => void;
  setMode: (mode: PlaybackMode) => void;
  markMarkerPlayed: (id: string) => void;
  resetPreviewSession: () => void;
  setPendingResumeTime: (time: number | null) => void;
}

function snapshot(markers: AdMarker[]): AdMarker[] {
  return markers.map(m => ({ ...m, adIds: [...m.adIds] }));
}

async function applyMarkerSnapshot(currentMarkers: AdMarker[], nextMarkers: AdMarker[]) {
  for (const marker of nextMarkers) {
    const current = currentMarkers.find(candidate => candidate.id === marker.id);
    if (!current) await api.createMarker(marker);
    else if (JSON.stringify(current) !== JSON.stringify(marker)) await api.updateMarker(marker.id, marker);
  }

  for (const marker of currentMarkers) {
    if (!nextMarkers.find(candidate => candidate.id === marker.id)) await api.deleteMarker(marker.id);
  }
}

export const useStore = create<Store>((set, get) => ({
  markers: INITIAL_MARKERS,
  ads: INITIAL_ADS,
  past: [],
  future: [],
  currentTime: 0,
  previousTime: 0,
  duration: 0,
  isPlaying: false,
  isAdPlaying: false,
  mode: 'editor',
  playedMarkerIds: [],
  pendingResumeTime: null,
  selectedMarkerId: null,
  zoom: 1,
  scrollLeft: 0,

  loadData: async () => {
    const [markers, ads] = await Promise.all([api.getMarkers(), api.getAds()]);
    set({ markers, ads });
  },

  addMarker: async (data) => {
    const { markers, past } = get();
    const marker = await api.createMarker(data);
    set({ markers: [...markers, marker], past: [...past.slice(-50), snapshot(markers)], future: [] });
  },

  updateMarker: async (id, updates) => {
    const { markers, past } = get();
    const updated = await api.updateMarker(id, updates);
    set({
      markers: markers.map(m => m.id === id ? updated : m),
      past: [...past.slice(-50), snapshot(markers)],
      future: [],
    });
  },

  deleteMarker: async (id) => {
    const { markers, past } = get();
    await api.deleteMarker(id);
    set({
      markers: markers.filter(m => m.id !== id),
      past: [...past.slice(-50), snapshot(markers)],
      future: [],
      selectedMarkerId: get().selectedMarkerId === id ? null : get().selectedMarkerId,
    });
  },

  addAd: async (data) => {
    const ad = await api.createAd(data);
    set({ ads: [...get().ads, ad] });
    return ad;
  },

  beginMarkerMove: () => {
    const { markers, past } = get();
    set({ past: [...past.slice(-50), snapshot(markers)], future: [] });
  },

  moveMarkerLocal: (id, time) => {
    const { markers } = get();
    set({ markers: markers.map(m => m.id === id ? { ...m, time } : m) });
  },

  flushMarkerMove: async (id) => {
    const { markers, past } = get();
    const marker = markers.find(m => m.id === id);
    if (!marker) return;
    await api.updateMarker(id, { time: marker.time });
  },

  undo: async () => {
    const { past, markers, future } = get();
    if (past.length === 0) return;
    const prev = snapshot(past[past.length - 1]);
    const newPast = past.slice(0, -1);
    await applyMarkerSnapshot(markers, prev);
    set({
      markers: prev,
      past: newPast,
      future: [snapshot(markers), ...future.slice(0, 49)],
      selectedMarkerId: prev.find(marker => marker.id === get().selectedMarkerId) ? get().selectedMarkerId : null,
    });
  },

  redo: async () => {
    const { future, markers, past } = get();
    if (future.length === 0) return;
    const next = snapshot(future[0]);
    const newFuture = future.slice(1);
    await applyMarkerSnapshot(markers, next);
    set({
      markers: next,
      past: [...past.slice(-50), snapshot(markers)],
      future: newFuture,
      selectedMarkerId: next.find(marker => marker.id === get().selectedMarkerId) ? get().selectedMarkerId : null,
    });
  },

  selectMarker: (id) => set({ selectedMarkerId: id }),
  setZoom: (zoom) => set({ zoom: Math.max(0.5, Math.min(10, zoom)) }),
  setScrollLeft: (x) => set({ scrollLeft: x }),
  setCurrentTime: (t) => set({ previousTime: get().currentTime, currentTime: t }),
  setPreviousTime: (t) => set({ previousTime: t }),
  setDuration: (d) => set({ duration: d }),
  setPlaying: (p) => set({ isPlaying: p }),
  setAdPlaying: (p) => set({ isAdPlaying: p }),
  setMode: (mode) => set({
    mode,
    previousTime: get().currentTime,
    playedMarkerIds: mode === 'preview' ? [] : get().playedMarkerIds,
    pendingResumeTime: null,
  }),
  markMarkerPlayed: (id) => set({
    playedMarkerIds: get().playedMarkerIds.includes(id) ? get().playedMarkerIds : [...get().playedMarkerIds, id],
  }),
  resetPreviewSession: () => set({ playedMarkerIds: [], pendingResumeTime: null }),
  setPendingResumeTime: (time) => set({ pendingResumeTime: time }),
}));
