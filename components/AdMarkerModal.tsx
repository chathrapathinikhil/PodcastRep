'use client';

import { useMemo, useState } from 'react';
import { Check, Folder, Search, Upload, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { Ad, AdMarker, AdType } from '@/types';
import clsx from 'clsx';

interface Props {
  initialTime?: number;
  initialType?: AdType;
  editingMarker?: AdMarker;
  onClose: () => void;
}

function titleForType(type: AdType) {
  if (type === 'static') return 'Static ad';
  if (type === 'auto') return 'Auto ad rotation';
  return 'A/B test';
}

function subtitleForType(type: AdType) {
  if (type === 'static') return 'Select the exact ad that should play every time.';
  if (type === 'auto') return 'Select the ads that should be randomly rotated.';
  return "Select which ads you'd like to A/B test";
}

function metaForAd(ad: Ad, index: number) {
  const duration = ad.duration ? `${Math.floor(ad.duration / 60)}m ${String(ad.duration % 60).padStart(2, '0')}s` : '3m 17s';
  return `Uploaded ad - ${duration}`;
}

function categoryForAd(ad: Ad) {
  return ad.name
    .replace(/\.[^.]+$/, '')
    .replace(/\s*[-_]\s*(v?\d+|copy|final|draft)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Uploaded ads';
}

function AdThumb({ ad }: { ad: Ad }) {
  return (
    <div
      className="h-[105px] w-[138px] shrink-0 overflow-hidden rounded border border-zinc-300 bg-zinc-200"
    >
      {ad.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ad.thumbnail} alt="" className="h-full w-full object-cover" />
      ) : (
        <video
          src={ad.url}
          className="h-full w-full bg-zinc-900 object-cover"
          muted
          playsInline
          preload="metadata"
        />
      )}
    </div>
  );
}

export default function AdMarkerModal({ initialTime = 0, initialType = 'ab', editingMarker, onClose }: Props) {
  const { ads, addMarker, updateMarker } = useStore();
  const [type] = useState<AdType>(editingMarker?.type ?? initialType);
  const [selectedAdIds, setSelectedAdIds] = useState<string[]>(
    editingMarker?.adIds ?? []
  );
  const [query, setQuery] = useState('');
  const [activeFolder, setActiveFolder] = useState('All ads');
  const [saving, setSaving] = useState(false);

  const folders = useMemo(() => {
    const categories = Array.from(new Set(ads.map(categoryForAd))).sort((a, b) => a.localeCompare(b));
    return ['All ads', ...categories];
  }, [ads]);

  const visibleAds = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return ads.filter(ad => {
      const matchesSearch = !normalized || ad.name.toLowerCase().includes(normalized);
      const matchesFolder = activeFolder === 'All ads' || categoryForAd(ad) === activeFolder;
      return matchesSearch && matchesFolder;
    });
  }, [activeFolder, ads, query]);

  const toggleAd = (id: string) => {
    setSelectedAdIds(prev => {
      if (prev.includes(id)) return prev.filter(item => item !== id);
      if (type === 'static') return [id];
      return [...prev, id];
    });
  };

  const save = async () => {
    if (selectedAdIds.length === 0 || saving) return;
    setSaving(true);
    try {
      const data = {
        type,
        adIds: selectedAdIds,
        label: editingMarker?.label ?? titleForType(type),
        time: editingMarker?.time ?? initialTime,
      };
      if (editingMarker) await updateMarker(editingMarker.id, data);
      else await addMarker(data);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/15 p-2"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="relative flex h-[min(816px,calc(100vh-32px))] w-[min(985px,calc(100vw-32px))] flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-lg">
        <button
          className="absolute right-8 top-8 flex h-4 w-4 items-center justify-center rounded text-zinc-950 hover:text-zinc-500"
          onClick={onClose}
          type="button"
          title="Close"
        >
          <X size={16} />
        </button>

        <header className="flex w-full flex-col gap-2">
          <h2 className="text-base font-bold leading-6 text-zinc-800">{titleForType(type)}</h2>
          <p className="text-sm font-semibold leading-5 text-zinc-500">{subtitleForType(type)}</p>
        </header>

        <div className="h-px w-full bg-zinc-200" />

        <div className="flex min-h-0 flex-1 overflow-hidden gap-6">
          <aside className="flex h-full w-[244px] shrink-0 flex-col gap-5 rounded-lg bg-zinc-100 p-4 shadow-sm">
            <label className="flex h-11 items-center gap-3 rounded-md border border-zinc-200 bg-white px-3">
              <Search size={16} className="text-zinc-950 opacity-50" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search option..."
                className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-800 outline-none placeholder:text-zinc-500"
              />
            </label>

            <div className="flex items-center gap-3">
              <Folder size={24} className="text-zinc-600" />
              <span className="text-base font-bold text-zinc-800">Ad library</span>
            </div>

            <nav className="flex flex-col gap-4">
              {folders.map(folder => (
                <button
                  key={folder}
                  className={clsx('flex h-9 items-center justify-between rounded px-4 text-sm font-semibold', activeFolder === folder ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-800 hover:bg-white/70')}
                  onClick={() => setActiveFolder(folder)}
                  type="button"
                >
                  <span className="truncate">{folder}</span>
                  <span className="text-xs text-zinc-500">
                    {folder === 'All ads' ? ads.length : ads.filter(ad => categoryForAd(ad) === folder).length}
                  </span>
                </button>
              ))}
            </nav>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-800">{activeFolder}</h3>
                <p className="text-sm font-semibold text-zinc-500">{visibleAds.length} ads available</p>
              </div>
              <label className="flex h-11 w-[200px] items-center gap-3 rounded-md border border-zinc-200 bg-white px-3">
                <Search size={16} className="text-zinc-950 opacity-50" />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search ads..."
                  className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-zinc-800 outline-none placeholder:text-zinc-500"
                />
              </label>
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden">
              {ads.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-zinc-500 shadow-sm">
                    <Upload size={22} />
                  </span>
                  <div>
                    <p className="text-base font-bold text-zinc-800">No ads uploaded yet</p>
                    <p className="mt-1 text-sm font-semibold text-zinc-500">
                      Upload ads from the main page, then come back here to attach them to this marker.
                    </p>
                  </div>
                </div>
              ) : visibleAds.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm font-semibold text-zinc-500">
                  No ads match your search.
                </div>
              ) : (
                <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto pr-3">
                  {visibleAds.map((ad, index) => {
                  const selected = selectedAdIds.includes(ad.id);
                  return (
                    <button
                      key={ad.id}
                      className="flex min-h-[129px] w-full shrink-0 items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white p-3 pr-4 text-left shadow-sm transition-colors hover:border-zinc-300"
                      onClick={() => toggleAd(ad.id)}
                      type="button"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-4 pr-4">
                        <AdThumb ad={ad} />
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                          <span className="truncate text-base font-bold text-zinc-800">{ad.name}</span>
                          <span className="text-sm font-semibold text-zinc-500">
                            {metaForAd(ad, index)}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-semibold text-zinc-800">{categoryForAd(ad)}</span>
                          </span>
                        </div>
                      </div>

                      <span
                        className={clsx(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                          selected ? 'border-zinc-900 bg-zinc-900 text-zinc-50' : 'border-zinc-900 bg-white'
                        )}
                      >
                        {selected && <Check size={14} />}
                      </span>
                    </button>
                  );
                  })}
                </div>
              )}
              {visibleAds.length > 0 && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-b from-white/0 to-white" />}
            </div>
          </section>
        </div>

        <div className="h-px w-full bg-zinc-200" />

        <footer className="flex h-9 items-center justify-end gap-4">
          <div className="flex-1" />
          <button
            className="h-9 rounded-md border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <span className="text-sm font-semibold text-zinc-800">
            {selectedAdIds.length} ad{selectedAdIds.length === 1 ? '' : 's'} selected
          </span>
          <button
            className="h-9 rounded-md bg-zinc-900 px-4 text-sm font-semibold text-zinc-50 shadow-sm hover:bg-zinc-800 disabled:opacity-50"
            disabled={saving || selectedAdIds.length === 0}
            onClick={save}
            type="button"
          >
            {saving ? 'Saving...' : editingMarker ? 'Save changes' : 'Add marker'}
          </button>
        </footer>
      </section>
    </div>
  );
}
