# Vidpod

Vidpod is a Next.js demo app for editing dynamic ad breaks in a podcast or video episode. It is built around the workflow a podcaster would actually use: upload an episode, upload a few ad videos, place markers on the timeline, choose how each marker should behave, and preview how the listener experience will feel.

The app is intentionally local and simple. It uses a JSON file as its small backend database, browser-uploaded media files, and API routes for the basic CRUD operations.

## What Is Implemented

- Upload an episode video and play it in the editor.
- Upload ad videos into a local ad library.
- Create ad markers on the episode timeline.
- Edit and delete existing markers.
- Drag markers directly on the timeline.
- Undo and redo marker create, update, delete, and drag operations.
- Click the timeline to seek.
- Drag the red playhead to scrub.
- Zoom the timeline and keep markers, playhead, waveform, and ruler aligned.
- Press Space anywhere on the page to play or pause.
- Use Static, Auto, and A/B marker types.
- Preview a single ad manually from a marker row.
- Open A/B result details from A/B markers.
- Store markers and ads through API routes backed by `data/vidpod-db.json`.

## Ad Marker Types

**Static**

Always plays the exact ad selected for that marker.

**Auto**

Randomly chooses one of the selected ads when the marker plays.

**A/B**

Rotates through the selected ads using simple round-robin logic. The app stores basic stats on the marker itself:

- impressions
- completions
- skips
- clicks

The current winner logic is intentionally simple: the leading variant is the ad with the highest completion rate.

```text
completion rate = completions / impressions
```

## Editor Mode And Preview Mode

The app has two different modes because editing and watching are different workflows.

**Editor mode**

Editor mode is for placing and managing ad markers. Scrubbing across a marker does not interrupt the editor or auto-play an ad. Markers behave like editable timeline objects.

**Preview Episode mode**

Preview mode simulates the listener experience. When playback crosses an unplayed marker, the episode pauses, the selected ad plays, and then the episode resumes. Each marker auto-plays only once per preview session.

## Backend/API

The app uses Next.js API routes and a local JSON file.

Marker endpoints:

- `GET /api/markers`
- `POST /api/markers`
- `PUT /api/markers/:id`
- `DELETE /api/markers/:id`

Ad endpoints:

- `GET /api/ads`
- `POST /api/ads`

Upload/export/transcript routes also exist:

- `POST /api/uploads`
- `POST /api/export`
- `POST /api/transcript`

The local database lives at:

```text
data/vidpod-db.json
```

Uploaded media is stored under:

```text
public/uploads
```

## Export Notes

The MP4 and HLS export routes are wired up, but they require local `ffmpeg` and `ffprobe` to be installed and available on PATH.

MP4 export creates a stitched video file under:

```text
public/exports
```

HLS export creates a streaming playlist and segments under:

```text
public/hls
```

HLS is not one downloadable video file. It is a playlist plus segment files.

## Tech Stack

- Next.js 14 App Router
- React
- TypeScript
- Tailwind CSS
- Zustand for client state
- Local JSON persistence for the demo backend
- HTML5 video playback

## Running Locally

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Practical Limitations

This is a local demo app, not a production ad server.

Current limitations:

- Media is stored locally in `public/uploads`.
- A/B stats are simple marker-level stats, not a full analytics pipeline.
- MP4/HLS export depends on local FFmpeg tools.
- HLS playback/download UX is basic.
- There is no authentication or multi-user workspace model.
- Sidebar navigation is visual only and does not need to route anywhere.

For production, media should move to object storage such as S3 or Cloudflare R2, exports should run in a background worker, and stats should be stored in a real database with event tracking.
