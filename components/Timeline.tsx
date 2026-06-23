'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GripVertical,
  Redo2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import type { AdMarker, AdType } from '@/types';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 10;

const typeStyles: Record<AdType, { bg: string; fg: string; label: string }> = {
  static: { bg: '#93C5FD', fg: '#1E40AF', label: 'S' },
  auto: { bg: '#86EFAC', fg: '#166534', label: 'A' },
  ab: { bg: '#FDBA74', fg: '#9A3412', label: 'A/B' },
};

function fmt(s: number) {
  const total = Math.max(0, Math.floor(s));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

const waveform = Array.from({ length: 145 }, (_, index) => {
  const v = Math.sin(index * 0.37) * 0.5 + Math.sin(index * 0.13) * 0.35 + 0.7;
  return Math.max(14, Math.min(68, Math.round(v * 42)));
});

interface MarkerBlockProps {
  marker: AdMarker;
  left: number;
  width: number;
  selected: boolean;
  onDragStart: (id: string, startX: number) => void;
  onSelect: () => void;
}

function MarkerBlock({ marker, left, width, selected, onDragStart, onSelect }: MarkerBlockProps) {
  const style = typeStyles[marker.type];

  return (
    <div
      data-marker
      className="absolute top-2 z-20 flex h-28 cursor-grab flex-col items-center justify-between rounded-md p-2 shadow-sm transition-transform active:cursor-grabbing"
      style={{
        left,
        width: Math.max(width, marker.type === 'ab' ? 42 : 40),
        backgroundColor: style.bg,
        outline: selected ? `2px solid ${style.fg}` : undefined,
        outlineOffset: 2,
      }}
      onMouseDown={e => {
        e.preventDefault();
        e.stopPropagation();
        onSelect();
        onDragStart(marker.id, e.clientX);
      }}
    >
      <span
        className="flex h-3.5 min-w-3.5 items-center justify-center rounded border px-1 text-[10px] font-semibold leading-none"
        style={{ borderColor: style.fg, color: style.fg }}
      >
        {style.label}
      </span>
      <GripVertical size={16} style={{ color: style.fg }} />
    </div>
  );
}

interface Props {
  onAddMarker: (time: number) => void;
}

export default function Timeline({ onAddMarker }: Props) {
  const {
    markers,
    ads,
    currentTime,
    duration,
    zoom,
    setZoom,
    setScrollLeft,
    selectMarker,
    selectedMarkerId,
    beginMarkerMove,
    moveMarkerLocal,
    flushMarkerMove,
    undo,
    redo,
    past,
    future,
  } = useStore();

  const trackRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1168);
  const [dragging, setDragging] = useState<{ id: string; startX: number; startTime: number } | null>(null);
  const [draggingPlayhead, setDraggingPlayhead] = useState(false);

  useEffect(() => {
    const obs = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    if (scrollRef.current) obs.observe(scrollRef.current);
    return () => obs.disconnect();
  }, []);

  const timelineDuration = duration || 420;
  const totalWidth = Math.max(containerWidth * zoom, containerWidth);
  const pxPerSec = totalWidth / timelineDuration;
  const sorted = useMemo(() => [...markers].sort((a, b) => a.time - b.time), [markers]);

  const timeToX = useCallback((time: number) => time * pxPerSec, [pxPerSec]);
  const xToTime = useCallback((x: number) => Math.max(0, Math.min(timelineDuration, x / pxPerSec)), [pxPerSec, timelineDuration]);
  const updateZoom = useCallback((nextZoom: number) => {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
    setZoom(clamped);

    window.requestAnimationFrame(() => {
      const scroller = scrollRef.current;
      if (!scroller) return;
      const nextWidth = Math.max(containerWidth * clamped, containerWidth);
      const nextX = (currentTime / timelineDuration) * nextWidth;
      const maxScroll = Math.max(0, nextWidth - scroller.clientWidth);
      scroller.scrollLeft = Math.max(0, Math.min(maxScroll, nextX - scroller.clientWidth / 2));
      setScrollLeft(scroller.scrollLeft);
    });
  }, [containerWidth, currentTime, setScrollLeft, setZoom, timelineDuration]);

  const startDrag = useCallback((id: string, startClientX: number) => {
    const marker = markers.find(m => m.id === id);
    if (!marker) return;
    beginMarkerMove();
    setDragging({ id, startX: startClientX, startTime: marker.time });
    document.body.classList.add('dragging');
  }, [beginMarkerMove, markers]);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (event: MouseEvent) => {
      event.preventDefault();
      const dx = event.clientX - dragging.startX;
      moveMarkerLocal(dragging.id, Math.max(0, Math.min(timelineDuration, dragging.startTime + dx / pxPerSec)));
    };
    const onUp = () => {
      flushMarkerMove(dragging.id);
      setDragging(null);
      document.body.classList.remove('dragging');
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, flushMarkerMove, moveMarkerLocal, pxPerSec, timelineDuration]);

  const pointerTime = (event: React.MouseEvent) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return xToTime(event.clientX - rect.left);
  };

  const seek = useCallback((time: number) => {
    useStore.getState().setCurrentTime(time);
    window.dispatchEvent(new CustomEvent('vidpod:seek', { detail: time }));
  }, []);

  useEffect(() => {
    if (!draggingPlayhead) return;

    const onMove = (event: MouseEvent) => {
      event.preventDefault();
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      seek(xToTime(event.clientX - rect.left));
    };
    const onUp = () => setDraggingPlayhead(false);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [draggingPlayhead, seek, xToTime]);

  const ticks = Array.from({ length: 14 }, (_, i) => (timelineDuration / 13) * i);
  const playheadX = timeToX(currentTime);

  return (
    <section className="flex h-[358px] w-full flex-col gap-8 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
      <div className="flex h-10 items-center justify-between gap-4">
        <div className="flex items-center gap-12">
          <button className="flex h-8 items-center gap-3 text-sm font-semibold text-zinc-500 disabled:opacity-40" disabled={!past.length} onClick={undo} type="button">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300">
              <Undo2 size={16} className="text-zinc-900" />
            </span>
            Undo
          </button>
          <button className="flex h-8 items-center gap-3 text-sm font-semibold text-zinc-500 disabled:opacity-40" disabled={!future.length} onClick={redo} type="button">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300">
              <Redo2 size={16} className="text-zinc-900" />
            </span>
            Redo
          </button>
        </div>

        <div className="flex h-10 w-[94px] items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-center text-base font-semibold tabular-nums leading-none text-zinc-500">
          {fmt(currentTime).slice(3)}
        </div>

        <div className="flex items-center gap-4">
          <ZoomOut size={20} className="text-zinc-800" />
          <div className="flex items-center gap-3">
            <input
              aria-label="Timeline zoom"
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.1}
              value={zoom}
              onChange={event => updateZoom(Number(event.target.value))}
              className="timeline-zoom h-4 w-[220px] cursor-pointer"
            />
            <span className="w-10 text-right text-sm font-semibold tabular-nums text-zinc-500">{zoom.toFixed(1)}x</span>
          </div>
          <ZoomIn size={20} className="text-zinc-800" />
        </div>
      </div>

      <div className="flex h-[182px] flex-col overflow-hidden">
        <div
          ref={scrollRef}
          className="overflow-x-auto overflow-y-hidden"
          onScroll={event => setScrollLeft(event.currentTarget.scrollLeft)}
          onWheel={event => {
            if (event.ctrlKey || event.metaKey) {
              event.preventDefault();
              updateZoom(zoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15));
            }
          }}
        >
          <div style={{ width: totalWidth }} className="relative">
            <div
              ref={trackRef}
              className="relative h-32 rounded-l-lg bg-zinc-900 p-2"
              onClick={event => {
                if ((event.target as HTMLElement).closest('[data-marker]')) return;
                seek(pointerTime(event));
              }}
              onDoubleClick={event => {
                if ((event.target as HTMLElement).closest('[data-marker]')) return;
                onAddMarker(pointerTime(event));
              }}
              onMouseDown={event => {
                if (!(event.target as HTMLElement).closest('[data-marker]')) selectMarker(null);
              }}
            >
              <div className="absolute inset-2 z-0 overflow-hidden px-2 pb-2">
                {waveform.map((height, index) => (
                  <span
                    key={index}
                    className="absolute bottom-2 w-1 rounded-full bg-white/30"
                    style={{
                      height,
                      left: `${(index / Math.max(1, waveform.length - 1)) * 100}%`,
                    }}
                  />
                ))}
              </div>

              {sorted.map((marker) => {
                const markerAds = ads.filter(ad => marker.adIds.includes(ad.id));
                const blockDuration = markerAds.reduce((sum, ad) => sum + (ad.duration || 15), 0) || 15;
                return (
                  <MarkerBlock
                    key={marker.id}
                    marker={marker}
                    left={timeToX(marker.time)}
                    width={Math.max(40, blockDuration * pxPerSec)}
                    selected={selectedMarkerId === marker.id}
                    onDragStart={startDrag}
                    onSelect={() => selectMarker(marker.id)}
                  />
                );
              })}

              <div
                className="absolute -top-[39px] z-30 -translate-x-1/2 cursor-grab active:cursor-grabbing"
                data-marker
                style={{ left: playheadX }}
                onMouseDown={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  setDraggingPlayhead(true);
                }}
              >
                <div className="h-[167px] w-8">
                  <div className="absolute left-4 top-6 h-[143px] -translate-x-1/2 border-l-[6px] border-red-500" />
                  <div className="flex h-8 w-8 items-center justify-center rounded-md border border-red-500 bg-red-500">
                    <GripVertical size={16} className="text-zinc-50" />
                  </div>
                </div>
              </div>
            </div>

            <div className="relative h-[54px] border-r border-zinc-300">
              {ticks.map((tick, index) => (
                <div
                  key={index}
                  className="absolute top-0 flex h-[54px] -translate-x-px flex-col items-start gap-2 border-l border-zinc-300 pb-4 pl-2"
                  style={{ left: timeToX(tick) }}
                >
                  <div className="flex h-2 w-20 justify-between">
                    {Array.from({ length: 8 }, (_, i) => (
                      <span key={i} className="h-2 border-l border-zinc-300" />
                    ))}
                  </div>
                  <span className="text-sm font-semibold text-zinc-500">{fmt(tick)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex h-2 rounded-lg bg-zinc-100">
          <div className="h-2 rounded-lg bg-zinc-200" style={{ width: `${Math.min(100, (currentTime / timelineDuration) * 100)}%` }} />
        </div>
      </div>
    </section>
  );
}
