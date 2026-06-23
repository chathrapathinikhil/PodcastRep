'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronsLeft,
  ChevronsRight,
  ChevronRight,
  FastForward,
  Pause,
  Play,
  Rewind,
  RotateCcw,
  RotateCw,
  Upload,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import type { AbStats, Ad, AdMarker } from '@/types';

type ActiveAd = { marker: AdMarker; ad: Ad; manual: boolean; resumeTime: number | null; resumeAfter: boolean };

function normalizeStats(stats: Record<string, AbStats>, adId: string) {
  stats[adId] = {
    impressions: stats[adId]?.impressions ?? 0,
    completions: stats[adId]?.completions ?? 0,
    skips: stats[adId]?.skips ?? 0,
    clicks: stats[adId]?.clicks ?? 0,
  };
  return stats[adId];
}

interface Props {
  videoUrl?: string;
  onUploadEpisode: (file?: File) => void;
}

export default function VideoPlayer({ videoUrl, onUploadEpisode }: Props) {
  const mainRef = useRef<HTMLVideoElement>(null);
  const adRef = useRef<HTMLVideoElement>(null);
  const activeAdRef = useRef<ActiveAd | null>(null);
  const modeRef = useRef(useStore.getState().mode);

  const {
    markers,
    ads,
    currentTime,
    duration,
    isPlaying,
    mode,
    playedMarkerIds,
    pendingResumeTime,
    setCurrentTime,
    setPreviousTime,
    setDuration,
    setPlaying,
    setAdPlaying,
    markMarkerPlayed,
    setPendingResumeTime,
    updateMarker,
  } = useStore();
  const [activeAd, setActiveAd] = useState<ActiveAd | null>(null);

  const hasVideo = Boolean(videoUrl);
  const disabled = !hasVideo;
  const playedIds = useMemo(() => new Set(playedMarkerIds), [playedMarkerIds]);

  useEffect(() => {
    activeAdRef.current = activeAd;
    setAdPlaying(Boolean(activeAd));
  }, [activeAd, setAdPlaying]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const recordAbMetric = useCallback(async (marker: AdMarker, ad: Ad, metric: keyof AbStats) => {
    if (marker.type !== 'ab') return;
    const latest = useStore.getState().markers.find(candidate => candidate.id === marker.id) ?? marker;
    const stats = { ...(marker.abStats ?? {}), ...(latest.abStats ?? {}) };
    normalizeStats(stats, ad.id)[metric] += 1;
    await updateMarker(marker.id, { abStats: stats });
  }, [updateMarker]);

  const pickAd = useCallback((marker: AdMarker, markerAds: Ad[]) => {
    if (marker.type === 'static') return markerAds[0];
    if (marker.type === 'auto') return markerAds[Math.floor(Math.random() * markerAds.length)];

    const currentIndex = marker.abIndex ?? 0;
    const ad = markerAds[currentIndex % markerAds.length];
    return ad;
  }, []);

  const findCrossedMarker = useCallback((previousTime: number, nextTime: number) => {
    if (nextTime <= previousTime) return null;
    return [...markers]
      .filter(marker => marker.time > previousTime && marker.time <= nextTime && !playedIds.has(marker.id))
      .sort((a, b) => a.time - b.time)[0] ?? null;
  }, [markers, playedIds]);

  const playMain = useCallback(() => {
    const video = mainRef.current;
    if (!video?.src) return;
    video.play().catch(() => {});
  }, []);

  const pauseMain = useCallback(() => {
    mainRef.current?.pause();
  }, []);

  const startAd = useCallback((marker: AdMarker, options: { manual: boolean; resumeTime: number | null; resumeAfter: boolean }) => {
    const markerAds = ads.filter(ad => marker.adIds.includes(ad.id));
    if (!markerAds.length) return false;

    const ad = pickAd(marker, markerAds);
    pauseMain();
    if (!options.manual) {
      markMarkerPlayed(marker.id);
      setPendingResumeTime(options.resumeTime);
    }
    let activeMarker = marker;
    if (marker.type === 'ab') {
      const nextIndex = ((marker.abIndex ?? 0) + 1) % markerAds.length;
      const stats = { ...(marker.abStats ?? {}) };
      normalizeStats(stats, ad.id).impressions += 1;
      activeMarker = { ...marker, abIndex: nextIndex, abStats: stats };
      updateMarker(marker.id, { abIndex: nextIndex, abStats: stats });
    }
    setActiveAd({ marker: activeMarker, ad, ...options });
    return true;
  }, [ads, markMarkerPlayed, pauseMain, pickAd, setPendingResumeTime, updateMarker]);

  const finishAd = useCallback((completed: boolean) => {
    const currentAd = activeAdRef.current;
    const adVideo = adRef.current;
    if (!currentAd) return;

    recordAbMetric(currentAd.marker, currentAd.ad, completed ? 'completions' : 'skips');
    if (adVideo) {
      adVideo.pause();
      adVideo.removeAttribute('src');
      adVideo.load();
    }

    setActiveAd(null);
    setPendingResumeTime(null);

    const video = mainRef.current;
    if (video && currentAd.resumeTime !== null) {
      video.currentTime = currentAd.resumeTime;
      setPreviousTime(currentAd.resumeTime);
      setCurrentTime(currentAd.resumeTime);
    }

    if (currentAd.resumeAfter) {
      window.setTimeout(() => playMain(), 0);
    } else {
      setPlaying(false);
    }
  }, [playMain, recordAbMetric, setCurrentTime, setPendingResumeTime, setPlaying, setPreviousTime]);

  const seekMain = useCallback((time: number) => {
    const video = mainRef.current;
    const max = duration || video?.duration || 0;
    const nextTime = max > 0 ? Math.max(0, Math.min(max, time)) : Math.max(0, time);
    const previous = video?.currentTime ?? currentTime;
    const wasPlaying = isPlaying && !activeAdRef.current;

    if (activeAdRef.current) finishAd(false);

    if (video?.src) video.currentTime = nextTime;
    setPreviousTime(previous);
    setCurrentTime(nextTime);

    if (modeRef.current === 'preview') {
      const crossed = findCrossedMarker(previous, nextTime);
      if (crossed && startAd(crossed, { manual: false, resumeTime: nextTime, resumeAfter: true })) return;
    }

    if (wasPlaying) window.setTimeout(() => playMain(), 0);
  }, [currentTime, duration, findCrossedMarker, finishAd, isPlaying, playMain, setCurrentTime, setPreviousTime, startAd]);

  const updateVideoTime = useCallback(() => {
    const video = mainRef.current;
    if (!video) return;

    const nextDuration = Number.isFinite(video.duration) ? video.duration : 0;
    const previous = useStore.getState().currentTime;
    const nextTime = video.currentTime || 0;
    setPreviousTime(previous);
    setCurrentTime(nextTime);
    setDuration(nextDuration);

    if (modeRef.current !== 'preview' || activeAdRef.current) return;
    const crossed = findCrossedMarker(previous, nextTime);
    if (crossed) startAd(crossed, { manual: false, resumeTime: nextTime, resumeAfter: true });
  }, [findCrossedMarker, setCurrentTime, setDuration, setPreviousTime, startAd]);

  const togglePlay = useCallback(() => {
    if (activeAd) {
      const adVideo = adRef.current;
      if (!adVideo) return;
      if (adVideo.paused) adVideo.play().then(() => setPlaying(true)).catch(() => {});
      else {
        adVideo.pause();
        setPlaying(false);
      }
      return;
    }
    if (isPlaying) pauseMain();
    else playMain();
  }, [activeAd, isPlaying, pauseMain, playMain, setPlaying]);

  useEffect(() => {
    const video = mainRef.current;
    if (!video) return;

    const onLoaded = () => {
      const loadedDuration = Number.isFinite(video.duration) ? video.duration : 0;
      setDuration(loadedDuration);
      setPreviousTime(0);
      setCurrentTime(0);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => {
      if (!activeAdRef.current) setPlaying(false);
    };
    const onEnded = () => setPlaying(false);

    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('durationchange', onLoaded);
    video.addEventListener('timeupdate', updateVideoTime);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);

    return () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('durationchange', onLoaded);
      video.removeEventListener('timeupdate', updateVideoTime);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
    };
  }, [setCurrentTime, setDuration, setPlaying, setPreviousTime, updateVideoTime, videoUrl]);

  useEffect(() => {
    const adVideo = adRef.current;
    if (!adVideo || !activeAd) return;

    adVideo.src = activeAd.ad.url;
    adVideo.play().then(() => setPlaying(true)).catch(() => {});

    const onEnded = () => finishAd(true);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    adVideo.addEventListener('ended', onEnded);
    adVideo.addEventListener('play', onPlay);
    adVideo.addEventListener('pause', onPause);
    return () => {
      adVideo.removeEventListener('ended', onEnded);
      adVideo.removeEventListener('play', onPlay);
      adVideo.removeEventListener('pause', onPause);
    };
  }, [activeAd, finishAd, setPlaying]);

  useEffect(() => {
    const onSeek = (event: Event) => {
      const time = (event as CustomEvent<number>).detail;
      if (typeof time === 'number') seekMain(time);
    };
    const onPreviewAd = (event: Event) => {
      const markerId = (event as CustomEvent<string>).detail;
      const marker = useStore.getState().markers.find(candidate => candidate.id === markerId);
      if (!marker) return;
      startAd(marker, { manual: true, resumeTime: null, resumeAfter: false });
    };
    window.addEventListener('vidpod:seek', onSeek);
    window.addEventListener('vidpod:preview-ad', onPreviewAd);
    return () => {
      window.removeEventListener('vidpod:seek', onSeek);
      window.removeEventListener('vidpod:preview-ad', onPreviewAd);
    };
  }, [seekMain, startAd]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (event.code === 'Space') {
        event.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay]);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg bg-black">
        {hasVideo ? (
          <video
            key={videoUrl}
            ref={mainRef}
            src={videoUrl}
            className="h-full w-full bg-black object-contain"
            preload="metadata"
            playsInline
            onClick={event => event.preventDefault()}
            onDoubleClick={event => event.preventDefault()}
          />
        ) : (
          <label className="flex h-full cursor-pointer flex-col items-center justify-center gap-4 bg-zinc-950 text-zinc-200 transition-colors hover:bg-zinc-900">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900">
              <Upload size={24} />
            </span>
            <span className="text-sm font-semibold">Upload an episode video</span>
            <span className="text-xs font-medium text-zinc-500">MP4, MOV, or WebM from your computer</span>
            <input type="file" accept="video/*" className="hidden" onChange={event => onUploadEpisode(event.target.files?.[0])} />
          </label>
        )}

        <div className="absolute left-4 top-4 rounded bg-white/90 px-2.5 py-1 text-xs font-semibold text-zinc-900">
          {mode === 'preview' ? `Preview episode${pendingResumeTime !== null ? ` - resumes at ${Math.floor(pendingResumeTime)}s` : ''}` : 'Editor mode'}
        </div>

        {activeAd && (
          <div className="absolute inset-0 bg-black">
            <video ref={adRef} className="h-full w-full object-contain" playsInline autoPlay onClick={event => event.preventDefault()} />
            <div className="absolute left-4 top-4 rounded bg-white/90 px-2.5 py-1 text-xs font-semibold text-zinc-900">
              {activeAd.manual ? 'Ad preview' : 'Ad break'} - {activeAd.ad.name}
            </div>
            <div className="absolute bottom-4 right-4">
              <button
                className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-100"
                onClick={() => finishAd(false)}
                type="button"
              >
                Skip Ad <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex h-16 items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <button
          className="flex items-center gap-2 text-sm font-semibold text-zinc-500 transition-colors hover:text-zinc-800 disabled:opacity-40"
          onClick={() => seekMain(0)}
          disabled={disabled}
          type="button"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300">
            <ChevronsLeft size={16} className="text-zinc-800" />
          </span>
          <span className="max-[1440px]:sr-only">Jump to start</span>
        </button>

        <div className="flex items-center justify-center gap-8">
          <button className="flex items-center gap-2 text-sm font-semibold text-zinc-500 hover:text-zinc-800 disabled:opacity-40" onClick={() => seekMain(currentTime - 10)} disabled={disabled} type="button">
            <RotateCcw size={20} className="text-zinc-900" />
            <span className="max-[1440px]:sr-only">10s</span>
          </button>
          <button onClick={() => seekMain(currentTime - 5)} disabled={disabled} type="button" title="Rewind" className="disabled:opacity-40">
            <Rewind size={20} className="text-zinc-800" />
          </button>
          <button onClick={togglePlay} disabled={!hasVideo} type="button" title={isPlaying ? 'Pause' : 'Play'} className="disabled:opacity-40">
            {isPlaying ? <Pause size={32} className="text-zinc-800" /> : <Play size={32} className="text-zinc-800" fill="currentColor" />}
          </button>
          <button onClick={() => seekMain(currentTime + 5)} disabled={disabled} type="button" title="Forward" className="disabled:opacity-40">
            <FastForward size={20} className="text-zinc-800" />
          </button>
          <button className="flex items-center gap-2 text-sm font-semibold text-zinc-500 hover:text-zinc-800 disabled:opacity-40" onClick={() => seekMain(currentTime + 10)} disabled={disabled} type="button">
            <span className="max-[1440px]:sr-only">10s</span>
            <RotateCw size={20} className="text-zinc-900" />
          </button>
        </div>

        <button
          className="flex items-center gap-2 text-sm font-semibold text-zinc-500 transition-colors hover:text-zinc-800 disabled:opacity-40"
          onClick={() => seekMain(duration)}
          disabled={disabled || duration <= 0}
          type="button"
        >
          <span className="max-[1440px]:sr-only">Jump to end</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300">
            <ChevronsRight size={16} className="text-zinc-800" />
          </span>
        </button>
      </div>
    </div>
  );
}
