'use client';

import {
  ArrowUp,
  BarChart3,
  CircleDollarSign,
  HelpCircle,
  Home,
  Import,
  Lightbulb,
  MailPlus,
  PlayCircle,
  Settings,
  Tv,
  ChevronDown,
} from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';

const nav = [
  { label: 'Dashboard', icon: Home },
  { label: 'Analytics', icon: BarChart3 },
  { label: 'Ads', icon: CircleDollarSign },
  { label: 'Channels', icon: Tv },
  { label: 'Import', icon: Import },
  { label: 'Settings', icon: Settings },
];

const bottom = [
  { label: 'Schedule upload', icon: PlayCircle, toggle: true },
  { label: 'Invite collaborators', icon: MailPlus },
  { label: 'Ideas and tips', icon: Lightbulb },
  { label: 'Help and support', icon: HelpCircle },
];

interface Props {
  onCreateEpisode?: () => void;
}

export default function Sidebar({ onCreateEpisode }: Props) {
  const [activeNav, setActiveNav] = useState('Ads');
  const [scheduleUpload, setScheduleUpload] = useState(false);

  return (
    <aside className="flex h-full w-[272px] shrink-0 flex-col justify-between border-r border-zinc-200 bg-zinc-50 px-6 py-7">
      <div className="flex w-full flex-col gap-7">
        <div className="flex flex-col gap-4">
          <button
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-50 transition-colors hover:bg-zinc-800"
            onClick={onCreateEpisode}
            type="button"
          >
            Create a Podcast
          </button>

          <button
            className="flex h-14 w-full items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white px-4 py-3 transition-colors hover:border-zinc-300"
            type="button"
            onClick={() => alert('Podcast switching is not connected in this workspace.')}
          >
            <span className="flex items-center gap-3">
              <span className="h-8 w-8 rounded bg-zinc-200 bg-[linear-gradient(135deg,#18181b,#71717a)]" />
              <span className="max-w-36 truncate whitespace-nowrap text-base font-bold text-zinc-500">The Diary Of A CEO</span>
            </span>
            <ChevronDown size={16} className="text-zinc-950" />
          </button>
        </div>

        <nav className="flex w-full flex-col gap-3 px-3">
          {nav.map(({ label, icon: Icon }) => {
            const active = activeNav === label;
            return (
            <button
              key={label}
              className={clsx(
                'group flex h-10 items-center gap-4 rounded-md px-3 text-left transition-colors hover:bg-white',
                active && 'bg-white shadow-sm'
              )}
              onClick={() => setActiveNav(label)}
              type="button"
            >
              <Icon size={20} className={clsx(active ? 'text-zinc-800' : 'text-zinc-500', 'transition-colors group-hover:text-zinc-800')} />
              <span className={clsx('text-lg font-bold leading-6 transition-colors', active ? 'text-zinc-800' : 'text-zinc-500 group-hover:text-zinc-800')}>
                {label}
              </span>
            </button>
            );
          })}
        </nav>
      </div>

      <div className="flex w-full flex-col items-center gap-4">
        <section className="h-[202px] w-full rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex h-full flex-col gap-4">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-2">
                <div className="border-b border-dashed border-zinc-300 text-base font-semibold text-zinc-800">Weekly plays</div>
                <div className="text-2xl font-extrabold text-zinc-800">738,849</div>
              </div>
              <div className="flex items-center gap-2">
                <ArrowUp size={16} className="text-green-600" />
                <span className="text-base font-bold text-zinc-500">17%</span>
              </div>
            </div>
            <div className="relative h-[90px] overflow-hidden rounded-lg">
              <svg viewBox="0 0 224 90" className="h-full w-full">
                <defs>
                  <linearGradient id="playsFill" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#8af9b2" stopOpacity="0.34" />
                    <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0 90 L0 72 C22 66 34 78 52 54 C70 30 86 40 106 36 C132 30 142 8 166 19 C190 30 198 12 224 3 L224 90 Z" fill="url(#playsFill)" />
                <path d="M0 72 C22 66 34 78 52 54 C70 30 86 40 106 36 C132 30 142 8 166 19 C190 30 198 12 224 3" fill="none" stroke="#16A34A" strokeWidth="2" />
              </svg>
            </div>
          </div>
        </section>

        <div className="flex gap-3">
          <span className="h-2 w-6 rounded-full bg-zinc-500" />
          <span className="h-2 w-2 rounded-full bg-zinc-300" />
          <span className="h-2 w-2 rounded-full bg-zinc-300" />
        </div>

        <div className="flex w-full flex-col gap-2 px-3">
          {bottom.map(({ label, icon: Icon, toggle }) => (
            <button
              key={label}
              className="group flex h-9 items-center justify-between rounded-md px-3 text-left transition-colors hover:bg-white"
              onClick={() => {
                if (toggle) setScheduleUpload(value => !value);
                if (label === 'Invite collaborators') window.location.href = 'mailto:?subject=Join%20my%20Vidpod%20workspace';
                if (label === 'Ideas and tips') setActiveNav('Dashboard');
                if (label === 'Help and support') setActiveNav('Settings');
              }}
              type="button"
            >
              <span className="flex items-center gap-3">
                <Icon size={20} className="text-zinc-500 group-hover:text-zinc-800" />
                <span className="text-sm font-bold text-zinc-500 group-hover:text-zinc-800">{label}</span>
              </span>
              {toggle && (
                <span className={clsx('flex h-5 w-9 rounded-full p-0.5 transition-colors', scheduleUpload ? 'bg-zinc-900' : 'bg-zinc-200')}>
                  <span className={clsx('h-4 w-4 rounded-full bg-white shadow-sm transition-transform', scheduleUpload && 'translate-x-4')} />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
