'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  BarChart3,
  ChevronDown,
  Download,
  Eye,
  FileText,
  Wand2,
  Plus,
  Radio,
  Settings,
  Trash2,
  Upload,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import VideoPlayer from '@/components/VideoPlayer';
import Timeline from '@/components/Timeline';
import AdMarkerModal from '@/components/AdMarkerModal';
import AbResultsModal from '@/components/AbResultsModal';
import CreateMarkerTypeModal from '@/components/CreateMarkerTypeModal';
import { useStore } from '@/lib/store';
import type { AdMarker, AdType } from '@/types';
import clsx from 'clsx';

function fmt(s: number) {
  const total = Math.max(0, Math.floor(s));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

const badges: Record<AdType, { label: string; className: string }> = {
  static: { label: 'Static', className: 'bg-green-200 text-green-800' },
  auto: { label: 'Auto', className: 'bg-blue-200 text-blue-800' },
  ab: { label: 'A/B', className: 'bg-orange-200 text-orange-800' },
};

interface UploadResult {
  name: string;
  url: string;
}

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

function Brand() {
  return (
    <div className="flex h-8 items-center gap-4">
      <div className="relative h-6 w-[23px] rounded-[2px] border border-zinc-500">
        <div className="absolute left-1 top-1 h-2 w-2 rounded-sm bg-zinc-500" />
        <div className="absolute bottom-1 right-1 h-2 w-2 rounded-sm bg-zinc-500" />
      </div>
      <span className="text-2xl font-bold leading-8 text-zinc-800">Vidpod</span>
    </div>
  );
}

export default function AdsPage() {
  const {
    markers,
    ads,
    selectedMarkerId,
    selectMarker,
    deleteMarker,
    undo,
    redo,
    loadData,
    addAd,
    addMarker,
    currentTime,
    mode,
    playedMarkerIds,
    setMode,
    resetPreviewSession,
    setCurrentTime,
    setDuration,
    setPlaying,
  } = useStore();

  const [modal, setModal] = useState<{ type: 'add'; time: number; markerType: AdType } | { type: 'edit'; marker: AdMarker } | null>(null);
  const [typePickerTime, setTypePickerTime] = useState<number | null>(null);
  const [resultsMarker, setResultsMarker] = useState<AdMarker | null>(null);
  const [episode, setEpisode] = useState<{ url: string; name: string } | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState('');
  const [exports, setExports] = useState<{ mp4?: string; hls?: string; hlsSourceMp4?: string }>({});
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const episodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('vidpod:last-episode');
      if (saved) setEpisode(JSON.parse(saved));
    } catch {
      localStorage.removeItem('vidpod:last-episode');
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('modal') === 'ab') {
      setModal({ type: 'add', time: currentTime || 30, markerType: 'ab' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const editingText = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      const mod = e.ctrlKey || e.metaKey;

      if (!editingText && (e.key === 'Backspace' || e.key === 'Delete') && selectedMarkerId) {
        e.preventDefault();
        deleteMarker(selectedMarkerId);
      }
      if (!mod) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteMarker, redo, selectedMarkerId, undo]);

  const openAdd = useCallback((time: number) => setTypePickerTime(time), []);
  const closeModal = () => setModal(null);

  const uploadFile = async (file: File): Promise<UploadResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('/api/uploads', { method: 'POST', body: formData });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error ?? 'Upload failed');
    }
    return response.json();
  };

  const uploadEpisode = async (file?: File) => {
    if (!file) return;
    const uploaded = await uploadFile(file);
    const nextEpisode = { url: uploaded.url, name: uploaded.name.replace(/\.[^.]+$/, '') || uploaded.name };
    setEpisode(nextEpisode);
    localStorage.setItem('vidpod:last-episode', JSON.stringify(nextEpisode));
    setCurrentTime(0);
    setDuration(0);
    setPlaying(false);
  };

  const uploadAd = async (file?: File) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    const duration = await new Promise<number>(resolve => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => resolve(Number.isFinite(video.duration) ? Math.round(video.duration) : 15);
      video.onerror = () => resolve(15);
      video.src = previewUrl;
    });
    URL.revokeObjectURL(previewUrl);
    const uploaded = await uploadFile(file);
    await addAd({ name: file.name.replace(/\.[^.]+$/, '') || 'Uploaded ad', url: uploaded.url, duration });
  };

  const autoPlaceAds = async () => {
    if (ads.length === 0) {
      setModal({ type: 'add', time: Math.max(currentTime, 30), markerType: 'auto' });
      return;
    }

    const total = useStore.getState().duration || 420;
    const times = [0.25, 0.5, 0.75]
      .map(position => Math.round(total * position))
      .filter(time => !markers.some(marker => Math.abs(marker.time - time) < 5));

    for (const time of times.slice(0, 3)) {
      await addMarker({
        time,
        type: 'auto',
        adIds: ads.map(ad => ad.id),
        label: 'Auto ad rotation',
      });
    }
  };

  const runPipeline = async (kind: 'mp4' | 'hls' | 'transcript') => {
    if (!episode) {
      setPipelineStatus('Upload an episode before running a media job.');
      return;
    }

    const endpoint = kind === 'transcript' ? '/api/transcript' : '/api/export';
    setPipelineStatus(kind === 'transcript' ? 'Extracting audio for transcript...' : `Generating ${kind.toUpperCase()} export...`);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeUrl: episode.url,
          type: kind,
          markers,
          ads,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error([result.error, result.hint].filter(Boolean).join(' ') || 'Media job failed');

      if (kind === 'mp4') {
        setExports(previous => ({ ...previous, mp4: result.url }));
        setPipelineStatus('MP4 export created.');
        const link = document.createElement('a');
        link.href = result.url;
        link.download = '';
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      if (kind === 'hls') {
        setExports(previous => ({ ...previous, hls: result.url, hlsSourceMp4: result.sourceMp4 }));
        setPipelineStatus('HLS playlist created. HLS is a streaming playlist, not one single downloadable video file.');
      }
      if (kind === 'transcript') {
        setTranscriptSegments(result.transcript?.segments ?? []);
        setPipelineStatus('Transcript workspace updated.');
      }
    } catch (error) {
      setPipelineStatus(error instanceof Error ? error.message : 'Media job failed.');
    }
  };

  const sortedMarkers = [...markers].sort((a, b) => a.time - b.time);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-800">
      <header className="flex h-[104px] items-center justify-between border-b border-zinc-200 px-[clamp(24px,3.5vw,64px)]">
        <Brand />

        <div className="flex h-14 items-center gap-8">
          <button
            className="relative text-zinc-500 transition-colors hover:text-zinc-800"
            type="button"
            title="Settings"
            onClick={() => alert('Settings are available in the sidebar.')}
          >
            <Settings size={20} />
          </button>
          <button
            className="relative text-zinc-500 transition-colors hover:text-zinc-800"
            type="button"
            title="Notifications"
            onClick={() => alert('No new notifications.')}
          >
            <Bell size={20} />
            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-red-500" />
          </button>
          <button
            className="flex h-14 w-[168px] items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-sm hover:bg-zinc-50"
            type="button"
            onClick={() => alert('Signed in as Guest.')}
          >
            <span className="h-8 w-8 rounded-full bg-[linear-gradient(135deg,#d4d4d8,#71717a)]" />
            <span className="w-[72px] text-base font-bold text-zinc-800">Guest</span>
            <ChevronDown size={16} className="text-zinc-950" />
          </button>
        </div>
      </header>

      <main className="flex min-h-[1286px]">
        <Sidebar onCreateEpisode={() => episodeInputRef.current?.click()} />

        <section className="flex min-w-0 flex-1 flex-col p-[clamp(24px,3.2vw,56px)]">
          <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-8">
            <section className="flex min-h-[130px] flex-col items-start gap-4">
              <button
                className="text-sm font-semibold leading-5 text-zinc-500 hover:text-zinc-800"
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                &lt;- Ads
              </button>
              <h1 className="max-w-[min(760px,75vw)] text-3xl font-bold leading-9 text-zinc-800">
                {episode?.name ?? 'Upload an episode video to start editing'}
              </h1>
              <p className="text-base font-semibold leading-6 text-zinc-500">
                {episode ? 'Local episode - ready for ad markers' : 'Local video editor'}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-10 rounded-md border border-zinc-200 bg-white p-1 shadow-sm">
                  <button
                    className={clsx(
                      'h-8 rounded px-3 text-sm font-semibold',
                      mode === 'editor' ? 'bg-zinc-900 text-zinc-50' : 'text-zinc-600 hover:bg-zinc-50'
                    )}
                    onClick={() => setMode('editor')}
                    type="button"
                  >
                    Editor mode
                  </button>
                  <button
                    className={clsx(
                      'h-8 rounded px-3 text-sm font-semibold',
                      mode === 'preview' ? 'bg-blue-600 text-white' : 'text-zinc-600 hover:bg-zinc-50'
                    )}
                    onClick={() => setMode('preview')}
                    type="button"
                  >
                    Preview Episode
                  </button>
                </div>
                {mode === 'preview' && playedMarkerIds.length > 0 && (
                  <button
                    className="flex h-10 items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                    onClick={resetPreviewSession}
                    type="button"
                  >
                    <Eye size={15} />
                    Reset ad preview session ({playedMarkerIds.length})
                  </button>
                )}
              </div>
            </section>

            <section className="grid min-h-[520px] grid-cols-[minmax(620px,660px)_minmax(560px,1fr)] gap-8 max-[1180px]:grid-cols-1">
              <div className="flex h-full min-h-[520px] max-h-[calc(100vh-260px)] flex-col gap-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm max-[1180px]:max-h-[720px]">
                <div className="flex h-6 items-start justify-between">
                  <h2 className="text-base font-bold text-zinc-800">Ad markers</h2>
                  <span className="text-base font-semibold text-zinc-500">{markers.length} markers</span>
                </div>
                <p className="text-sm font-semibold text-zinc-500">
                  {ads.length} uploaded ad{ads.length === 1 ? '' : 's'}
                </p>

                <div className="max-h-[212px] min-h-0 overflow-y-auto overflow-x-hidden pr-2">
                  <div className="flex flex-col gap-4">
                  {sortedMarkers.length === 0 && (
                    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm font-semibold text-zinc-500">
                      Upload ad videos, then add markers where they should play.
                    </div>
                  )}
                  {sortedMarkers.map((marker, index) => {
                    const badge = badges[marker.type];
                    const selected = selectedMarkerId === marker.id;
                    return (
                      <div key={marker.id} className="flex h-[60px] items-center gap-4">
                        <button
                          className="flex h-4 w-4 shrink-0 items-center justify-center text-base font-semibold text-zinc-500"
                          onClick={() => selectMarker(selected ? null : marker.id)}
                          type="button"
                        >
                          {index + 1}
                        </button>
                        <div
                          className={clsx(
                            'grid h-[60px] flex-1 grid-cols-[96px_64px_minmax(0,1fr)_92px_36px_52px_36px] items-center gap-3 rounded-lg border border-zinc-200 px-4 py-3 shadow-sm transition-colors',
                            selected && 'border-zinc-800'
                          )}
                        >
                          <button
                            onClick={() => {
                              selectMarker(marker.id);
                              window.dispatchEvent(new CustomEvent('vidpod:seek', { detail: marker.time }));
                            }}
                            className="w-24 text-left text-base font-semibold text-zinc-800"
                            type="button"
                          >
                            {fmt(marker.time)}
                          </button>
                          <span className={clsx('flex h-7 w-16 items-center justify-center rounded-lg px-2 text-xs font-semibold leading-none', badge.className)}>
                            {badge.label}
                          </span>
                          <span className="min-w-0" />
                          <button
                            className="flex h-9 w-[92px] items-center justify-center gap-1 rounded-md bg-zinc-900 px-2 text-xs font-semibold text-zinc-50 hover:bg-zinc-800 disabled:opacity-40"
                            onClick={() => window.dispatchEvent(new CustomEvent('vidpod:preview-ad', { detail: marker.id }))}
                            disabled={marker.adIds.length === 0}
                            type="button"
                          >
                            <Eye size={14} />
                            Preview
                          </button>
                          {marker.type === 'ab' ? (
                            <button
                              className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
                              onClick={() => setResultsMarker(marker)}
                              type="button"
                              title="A/B results"
                            >
                              <BarChart3 size={16} />
                            </button>
                          ) : (
                            <span className="h-9 w-9" />
                          )}
                          <button
                            className="flex h-9 w-[52px] items-center justify-center rounded-md border border-zinc-200 bg-white text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                            onClick={() => setModal({ type: 'edit', marker })}
                            type="button"
                          >
                            Edit
                          </button>
                          <button
                            className="flex h-9 w-9 items-center justify-center rounded-md bg-red-300 text-red-900 transition-colors hover:bg-red-400"
                            onClick={() => deleteMarker(marker.id)}
                            type="button"
                            title="Delete marker"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col gap-4">
                  <button
                    onClick={() => openAdd(currentTime)}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-50 hover:bg-zinc-800"
                    type="button"
                  >
                    Add ad marker
                    <Plus size={16} />
                  </button>
                  <button
                    onClick={autoPlaceAds}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                    type="button"
                  >
                    Auto place ads
                    <Wand2 size={16} />
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white text-sm font-semibold text-zinc-800 hover:bg-zinc-50">
                      <Upload size={15} />
                      Episode
                      <input ref={episodeInputRef} type="file" accept="video/*" className="hidden" onChange={e => uploadEpisode(e.target.files?.[0])} />
                    </label>
                    <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white text-sm font-semibold text-zinc-800 hover:bg-zinc-50">
                      <Upload size={15} />
                      Ad
                      <input type="file" accept="video/*" className="hidden" onChange={e => uploadAd(e.target.files?.[0])} />
                    </label>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      className="flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-40"
                      onClick={() => runPipeline('mp4')}
                      disabled={!episode}
                      type="button"
                      title="Generate and download final MP4"
                    >
                      <Download size={15} />
                      MP4
                    </button>
                    <button
                      className="flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-40"
                      onClick={() => runPipeline('hls')}
                      disabled={!episode}
                      type="button"
                      title="Generate HLS streaming playlist"
                    >
                      <Radio size={15} />
                      HLS
                    </button>
                    <button
                      className="flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-40"
                      onClick={() => runPipeline('transcript')}
                      disabled={!episode}
                      type="button"
                      title="Extract transcript"
                    >
                      <FileText size={15} />
                      Text
                    </button>
                  </div>

                  {(pipelineStatus || exports.mp4 || exports.hls) && (
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs font-semibold text-zinc-500">
                      {pipelineStatus && <p>{pipelineStatus}</p>}
                      <div className="mt-2 flex flex-wrap gap-3">
                        {exports.mp4 && <a className="text-zinc-900 underline" href={exports.mp4} download>Download MP4</a>}
                        {exports.hls && <a className="text-zinc-900 underline" href={exports.hls} target="_blank" rel="noreferrer">Open HLS playlist</a>}
                        {exports.hlsSourceMp4 && <a className="text-zinc-900 underline" href={exports.hlsSourceMp4} download>Download HLS source MP4</a>}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="h-full min-h-[520px] rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
                <VideoPlayer videoUrl={episode?.url} onUploadEpisode={uploadEpisode} />
              </div>
            </section>

            <Timeline onAddMarker={openAdd} />

            <section className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="text-base font-bold text-zinc-800">Transcript</h2>
                <button
                  className="flex h-9 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-40"
                  onClick={() => runPipeline('transcript')}
                  disabled={!episode}
                  type="button"
                >
                  <FileText size={15} />
                  Generate
                </button>
              </div>

              {transcriptSegments.length > 0 ? (
                <div className="grid gap-2">
                  {transcriptSegments.map((segment, index) => (
                    <button
                      key={`${segment.start}-${index}`}
                      className="flex items-start gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left hover:border-zinc-300 hover:bg-white"
                      onClick={() => window.dispatchEvent(new CustomEvent('vidpod:seek', { detail: segment.start }))}
                      type="button"
                    >
                      <span className="w-20 shrink-0 text-sm font-semibold tabular-nums text-zinc-500">{fmt(segment.start)}</span>
                      <span className="text-sm font-semibold text-zinc-700">{segment.text}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-semibold text-zinc-500">
                  Generate a transcript after uploading an episode. Each timestamped line can be clicked to scrub the editor.
                </p>
              )}
            </section>
          </div>
        </section>
      </main>

      <footer className="flex h-[106px] items-center justify-between border-t border-zinc-200 px-[clamp(24px,3.5vw,64px)]">
        <span className="text-base font-semibold text-zinc-500">Video first podcasts</span>
        <Brand />
      </footer>

      {modal?.type === 'add' && <AdMarkerModal initialTime={modal.time} initialType={modal.markerType} onClose={closeModal} />}
      {modal?.type === 'edit' && <AdMarkerModal editingMarker={modal.marker} onClose={closeModal} />}
      {typePickerTime !== null && (
        <CreateMarkerTypeModal
          onClose={() => setTypePickerTime(null)}
          onSelect={markerType => {
            setModal({ type: 'add', time: typePickerTime, markerType });
            setTypePickerTime(null);
          }}
        />
      )}
      {resultsMarker && <AbResultsModal marker={resultsMarker} onClose={() => setResultsMarker(null)} />}
    </div>
  );
}
