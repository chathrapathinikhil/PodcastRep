'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import type { AbStats, AdMarker } from '@/types';
import clsx from 'clsx';

const EMPTY_STATS: AbStats = {
  impressions: 0,
  completions: 0,
  skips: 0,
  clicks: 0,
};

function getStats(marker: AdMarker, adId: string): AbStats {
  return marker.abStats?.[adId] ?? EMPTY_STATS;
}

interface Props {
  marker: AdMarker;
  onClose: () => void;
}

export default function AbResultsModal({ marker, onClose }: Props) {
  const { ads, updateMarker, markers } = useStore();
  const liveMarker = markers.find(candidate => candidate.id === marker.id) ?? marker;
  const candidates = ads.filter(ad => marker.adIds.includes(ad.id));
  const scored = candidates.map((ad) => {
    const adStats = getStats(liveMarker, ad.id);
    const rate = adStats.impressions ? adStats.completions / adStats.impressions : 0;
    return { ad, ...adStats, rate };
  }).sort((a, b) => b.rate - a.rate);
  const [winnerId, setWinnerId] = useState(scored[0]?.ad.id ?? candidates[0]?.id);
  const totalImpressions = scored.reduce((sum, item) => sum + item.impressions, 0);

  const saveWinner = async () => {
    if (!winnerId) return;
    await updateMarker(marker.id, { type: 'static', adIds: [winnerId], label: 'A/B winner', abIndex: 0 });
    onClose();
  };

  const resetTest = async () => {
    await updateMarker(marker.id, { abIndex: 0, abStats: {} });
    setWinnerId(candidates[0]?.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/15">
      <div className="relative flex w-[577px] flex-col gap-6 rounded-lg border border-zinc-200 bg-white p-8 shadow-xl">
        <button
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          onClick={onClose}
          type="button"
          title="Close"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold leading-8 text-zinc-800">A/B test results</h2>
          <p className="text-base font-semibold text-zinc-500">
            {candidates.length} ads selected - {totalImpressions} measured play{totalImpressions === 1 ? '' : 's'}
          </p>
          <p className="text-sm font-semibold text-zinc-500">
            The current test ranks ads by completion rate. It needs real playback data before a winner is meaningful.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {scored.length === 0 && (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm font-semibold text-zinc-500">
              This marker has no ads attached yet.
            </div>
          )}
          {scored.slice(0, 2).map((item, index) => {
            const selected = winnerId === item.ad.id;
            const hasData = item.impressions > 0;
            return (
              <button
                key={item.ad.id}
                className={clsx(
                  'flex h-[129px] w-full items-center gap-4 rounded-lg border bg-white p-3 text-left shadow-sm transition-colors',
                  selected ? 'border-green-300' : 'border-zinc-200 hover:border-zinc-300'
                )}
                onClick={() => setWinnerId(item.ad.id)}
                type="button"
              >
                <div className="h-[105px] w-[138px] overflow-hidden rounded-md bg-zinc-200">
                  {item.ad.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.ad.thumbnail} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-[linear-gradient(135deg,#d4d4d8,#71717a)]" />
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <div>
                    <p className="truncate text-base font-bold text-zinc-800">{item.ad.name}</p>
                    <p className="text-sm font-semibold text-zinc-500">
                      {item.impressions} impressions - {item.completions} completions - {item.skips} skips
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={clsx('rounded-md px-2 py-1 text-xs font-semibold', index === 0 && hasData ? 'bg-green-200 text-green-800' : 'border border-zinc-200 text-zinc-600')}>
                      {index === 0 && hasData ? 'Leading' : 'Variant'}
                    </span>
                    <span className="text-sm font-semibold text-zinc-500">
                      {hasData ? `${Math.round(item.rate * 100)}% completion` : 'No plays yet'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-3">
          <button
            className="h-9 rounded-md border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            onClick={resetTest}
            type="button"
          >
            New test
          </button>
          <button
            className="h-9 rounded-md border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            onClick={onClose}
            type="button"
          >
            Done
          </button>
          <button
            className="h-9 rounded-md bg-zinc-900 px-4 text-sm font-semibold text-zinc-50 hover:bg-zinc-800 disabled:opacity-40"
            onClick={saveWinner}
            disabled={!winnerId || totalImpressions === 0}
            type="button"
          >
            Save winner
          </button>
        </div>
      </div>
    </div>
  );
}
