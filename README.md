# Vidpod - Dynamic Ad Placement

A full-stack Next.js app for placing dynamic ads on a podcast/video episode.

## Stack
- Next.js 14 App Router, TypeScript, Tailwind CSS
- Zustand for client state, timeline sync, and undo/redo history
- API routes for marker/ad CRUD with local JSON persistence

## Getting Started

```bash
npm install
npm run dev
```

Open the local URL printed by Next.js, usually `http://localhost:3000`.

## Implemented

- Main episode player uses a local HTML5 video source uploaded in the browser.
- Upload a local episode video and edit ad markers against that source for the current browser session.
- Upload local video ads into the ad library.
- The app starts with an empty ad library and no default ad markers.
- Static, Auto, and A/B marker types.
- A/B selection records local impression/completion stats and prefers the best completion rate after initial sampling.
- Marker CRUD through API routes.
- API payload validation for marker and ad create/update requests.
- Undo/redo for add, edit, delete, and timeline drag operations.
- Draggable timeline markers with server sync on mouseup.
- Timeline click-to-seek, double-click-to-add, and Ctrl/Cmd-scroll zoom.
- Native video controls, draggable timeline playhead, skip ad, and page-wide Space play/pause.
- A/B results modal for selecting and saving a winning ad variant.
- Sidebar hovers and non-critical navigation placeholders.

## API

- `GET /api/markers`
- `POST /api/markers`
- `PUT /api/markers/:id`
- `DELETE /api/markers/:id`
- `GET /api/ads`
- `POST /api/ads`

## Notes

Uploaded episode/ad videos are stored under `public/uploads`. Marker and ad metadata is stored in `data/vidpod-db.json`. For production, media should move to object storage such as Cloudflare R2 or S3 and be streamed through signed URLs or a CDN.

## Bonus Architecture Notes

- Real waveforms: generate waveform peaks with `ffmpeg`/`audiowaveform` after upload and store peak JSON beside the asset.
- Final MP4 export: enqueue a durable FFmpeg job that stitches the main media and selected ads using concat/filter graphs.
- HLS output: generate multi-bitrate HLS renditions with FFmpeg and use interstitial metadata such as `EXT-X-DATERANGE` for ad markers.
- Transcript UI: extract audio, transcribe with Whisper or a speech-to-text provider, store timestamped segments, and render a clickable transcript panel tied to the same seek event used by the timeline.
- Hosting: deploy the Next.js app on Fly.io/Railway/Render for the Node runtime, use R2/S3 for media, CDN delivery for HLS, and a queue worker for export/transcription pipelines.
- Reliability: use a durable queue with retry/backoff, idempotent job IDs, persisted job state, and resumable artifact writes.
