export type AdType = 'static' | 'auto' | 'ab';

export interface Ad {
  id: string;
  name: string;
  url: string;
  thumbnail?: string;
  duration?: number; // seconds
}

export interface AbStats {
  impressions: number;
  completions: number;
  skips: number;
  clicks: number;
}

export interface AdMarker {
  id: string;
  time: number;       // seconds from video start
  type: AdType;
  adIds: string[];    // ids of ads to play here
  label?: string;
  abIndex?: number;
  abStats?: Record<string, AbStats>;
}

export type PlaybackMode = 'editor' | 'preview';

export const AD_TYPE_LABELS: Record<AdType, string> = {
  static: 'Static',
  auto: 'Auto',
  ab: 'A/B Test',
};

export const AD_TYPE_COLORS: Record<AdType, string> = {
  static: '#ec4899',  // pink
  auto: '#3b82f6',    // blue
  ab: '#f59e0b',      // amber
};

export const AD_TYPE_BG: Record<AdType, string> = {
  static: 'bg-pink-500',
  auto: 'bg-blue-500',
  ab: 'bg-amber-500',
};

export const AD_TYPE_LIGHT: Record<AdType, string> = {
  static: 'bg-pink-100 text-pink-700',
  auto: 'bg-blue-100 text-blue-700',
  ab: 'bg-amber-100 text-amber-700',
};
