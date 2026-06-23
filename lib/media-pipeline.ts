import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import fs from 'fs';
import path from 'path';
import type { Ad, AdMarker } from '@/types';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const TMP_DIR = path.join(process.cwd(), '.tmp', 'media-jobs');

export interface PipelineInput {
  episodeUrl: string;
  markers: AdMarker[];
  ads: Ad[];
}

function publicPath(url: string) {
  if (!url.startsWith('/')) throw new Error(`Only local uploaded media is supported: ${url}`);
  const clean = url.split('?')[0].replace(/^\/+/, '');
  const resolved = path.resolve(PUBLIC_DIR, clean);
  if (!resolved.startsWith(PUBLIC_DIR)) throw new Error('Invalid media path');
  if (!fs.existsSync(resolved)) throw new Error(`File not found: ${url}`);
  return resolved;
}

function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', error => reject(error));
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `${command} exited with ${code}`));
    });
  });
}

function output(command: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', error => reject(error));
    child.on('close', code => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr || `${command} exited with ${code}`));
    });
  });
}

function pickAd(marker: AdMarker, ads: Ad[]) {
  const markerAds = ads.filter(ad => marker.adIds.includes(ad.id));
  if (marker.type === 'static') return markerAds[0];
  if (marker.type === 'auto') return markerAds[0];
  return markerAds[0];
}

function concatLine(file: string) {
  return `file '${file.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`;
}

async function probeDuration(file: string) {
  const value = await output('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file,
  ]);
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Could not read media duration for ${file}`);
  return duration;
}

async function cutSegment(source: string, start: number, end: number, destination: string) {
  const length = Math.max(0, end - start);
  if (length <= 0.05) return false;

  await run('ffmpeg', [
    '-y',
    '-ss', start.toFixed(3),
    '-i', source,
    '-t', length.toFixed(3),
    '-map', '0:v:0',
    '-map', '0:a?',
    '-c:v', 'libx264',
    '-c:a', 'aac',
    '-preset', 'veryfast',
    '-movflags', '+faststart',
    destination,
  ]);
  return true;
}

async function createConcatList(input: PipelineInput, jobId: string) {
  const jobDir = path.join(TMP_DIR, jobId);
  await mkdir(jobDir, { recursive: true });
  const episode = publicPath(input.episodeUrl);
  const episodeDuration = await probeDuration(episode);
  const parts: string[] = [];
  let previousTime = 0;

  const orderedMarkers = [...input.markers].sort((a, b) => a.time - b.time);
  for (let index = 0; index < orderedMarkers.length; index += 1) {
    const marker = orderedMarkers[index];
    const ad = pickAd(marker, input.ads);
    const markerTime = Math.max(0, Math.min(episodeDuration, marker.time));
    if (markerTime < previousTime) continue;

    const segmentPath = path.join(jobDir, `episode-${index}.mp4`);
    if (await cutSegment(episode, previousTime, markerTime, segmentPath)) parts.push(segmentPath);
    if (ad) parts.push(publicPath(ad.url));
    previousTime = markerTime;
  }

  const tailPath = path.join(jobDir, 'episode-tail.mp4');
  if (await cutSegment(episode, previousTime, episodeDuration, tailPath)) parts.push(tailPath);
  if (parts.length === 0) parts.push(episode);

  const listFile = path.join(TMP_DIR, `${jobId}.txt`);
  await writeFile(listFile, parts.map(concatLine).join('\n'));
  return listFile;
}

export async function generateMp4(input: PipelineInput) {
  const jobId = randomUUID();
  const outDir = path.join(PUBLIC_DIR, 'exports');
  await mkdir(outDir, { recursive: true });
  const output = path.join(outDir, `${jobId}.mp4`);
  const listFile = await createConcatList(input, jobId);

  await run('ffmpeg', [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listFile,
    '-c:v', 'libx264',
    '-c:a', 'aac',
    '-movflags', '+faststart',
    output,
  ]);

  return { jobId, url: `/exports/${jobId}.mp4` };
}

export async function generateHls(input: PipelineInput) {
  const mp4 = await generateMp4(input);
  const inputFile = publicPath(mp4.url);
  const jobId = mp4.jobId;
  const outDir = path.join(PUBLIC_DIR, 'hls', jobId);
  await mkdir(outDir, { recursive: true });
  await Promise.all([0, 1, 2, 3].map(index => mkdir(path.join(outDir, `v${index}`), { recursive: true })));

  await run('ffmpeg', [
    '-y',
    '-i', inputFile,
    '-filter_complex',
    '[0:v]split=4[v1080][v720][v480][v360];[v1080]scale=-2:1080[v1080out];[v720]scale=-2:720[v720out];[v480]scale=-2:480[v480out];[v360]scale=-2:360[v360out]',
    '-map', '[v1080out]', '-map', '0:a?', '-c:v:0', 'libx264', '-b:v:0', '5000k', '-c:a:0', 'aac', '-b:a:0', '160k',
    '-map', '[v720out]', '-map', '0:a?', '-c:v:1', 'libx264', '-b:v:1', '2800k', '-c:a:1', 'aac', '-b:a:1', '128k',
    '-map', '[v480out]', '-map', '0:a?', '-c:v:2', 'libx264', '-b:v:2', '1400k', '-c:a:2', 'aac', '-b:a:2', '96k',
    '-map', '[v360out]', '-map', '0:a?', '-c:v:3', 'libx264', '-b:v:3', '800k', '-c:a:3', 'aac', '-b:a:3', '96k',
    '-f', 'hls',
    '-hls_time', '6',
    '-hls_playlist_type', 'vod',
    '-hls_flags', 'independent_segments',
    '-master_pl_name', 'master.m3u8',
    '-var_stream_map', 'v:0,a:0 v:1,a:1 v:2,a:2 v:3,a:3',
    '-hls_segment_filename', path.join(outDir, 'v%v', 'segment_%03d.ts'),
    path.join(outDir, 'v%v', 'index.m3u8'),
  ]);

  const interstitials = input.markers
    .sort((a, b) => a.time - b.time)
    .map(marker => ({
      markerId: marker.id,
      time: marker.time,
      type: marker.type,
      adIds: marker.adIds,
    }));
  await writeFile(path.join(outDir, 'interstitials.json'), JSON.stringify({ jobId, interstitials }, null, 2));

  return { jobId, url: `/hls/${jobId}/master.m3u8`, sourceMp4: mp4.url, interstitials };
}

export async function generateTranscript(input: Pick<PipelineInput, 'episodeUrl'>) {
  const jobId = randomUUID();
  const episode = publicPath(input.episodeUrl);
  const outDir = path.join(process.cwd(), 'data', 'transcripts');
  const audioDir = path.join(process.cwd(), '.tmp', 'audio');
  await mkdir(outDir, { recursive: true });
  await mkdir(audioDir, { recursive: true });
  const audioPath = path.join(audioDir, `${jobId}.wav`);
  const transcriptPath = path.join(outDir, `${jobId}.json`);

  await run('ffmpeg', ['-y', '-i', episode, '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', audioPath]);

  const transcript = {
    jobId,
    audio: audioPath,
    segments: [
      {
        start: 0,
        end: 0,
        text: 'Audio extracted. Add a speech-to-text provider to populate timestamped transcript segments.',
      },
    ],
  };

  await writeFile(transcriptPath, JSON.stringify(transcript, null, 2));
  return { jobId, transcript };
}
