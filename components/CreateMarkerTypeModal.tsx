'use client';

import { CircleDashed, Columns2, Crosshair, X } from 'lucide-react';
import { useState } from 'react';
import type { AdType } from '@/types';
import clsx from 'clsx';

const options: Array<{
  type: AdType;
  title: string;
  description: string;
  icon: typeof CircleDashed;
}> = [
  {
    type: 'auto',
    title: 'Auto',
    description: 'Automatic ad insertions',
    icon: CircleDashed,
  },
  {
    type: 'static',
    title: 'Static',
    description: 'A marker for a specific ad that you select',
    icon: Crosshair,
  },
  {
    type: 'ab',
    title: 'A/B test',
    description: 'Compare the performance of multiple ads',
    icon: Columns2,
  },
];

interface Props {
  onClose: () => void;
  onSelect: (type: AdType) => void;
}

export default function CreateMarkerTypeModal({ onClose, onSelect }: Props) {
  const [selected, setSelected] = useState<AdType>('ab');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="relative w-[420px] rounded-lg border border-zinc-200 bg-white p-6 shadow-xl">
        <button
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          onClick={onClose}
          type="button"
          title="Close"
        >
          <X size={16} />
        </button>

        <header className="mb-5">
          <h2 className="text-base font-bold text-zinc-900">Create ad marker</h2>
          <p className="mt-1 text-sm font-semibold text-zinc-500">Insert a new ad marker into this episode</p>
        </header>

        <div className="flex flex-col gap-3">
          {options.map(option => {
            const Icon = option.icon;
            const active = selected === option.type;
            return (
              <button
                key={option.type}
                className={clsx(
                  'flex h-[62px] items-center gap-4 rounded-lg border bg-white px-4 text-left transition-colors',
                  active ? 'border-zinc-900' : 'border-zinc-200 hover:border-zinc-300'
                )}
                onClick={() => setSelected(option.type)}
                type="button"
              >
                <Icon size={24} className="text-zinc-500" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-zinc-900">{option.title}</span>
                  <span className="block truncate text-xs font-semibold text-zinc-500">{option.description}</span>
                </span>
                <span className={clsx('h-4 w-4 rounded-full border', active ? 'border-zinc-900 bg-zinc-900 ring-2 ring-zinc-200' : 'border-zinc-400')} />
              </button>
            );
          })}
        </div>

        <footer className="mt-6 flex justify-end gap-3">
          <button
            className="h-9 rounded-md border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="h-9 rounded-md bg-zinc-900 px-4 text-sm font-semibold text-zinc-50 hover:bg-zinc-800"
            onClick={() => onSelect(selected)}
            type="button"
          >
            Select marker
          </button>
        </footer>
      </section>
    </div>
  );
}
