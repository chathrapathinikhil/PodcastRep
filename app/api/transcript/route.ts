import { NextRequest, NextResponse } from 'next/server';
import { generateTranscript } from '@/lib/media-pipeline';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body?.episodeUrl) {
      return NextResponse.json({ error: 'Upload an episode video before transcribing.' }, { status: 400 });
    }

    const result = await generateTranscript({ episodeUrl: body.episodeUrl });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Transcript job failed.',
        hint: 'Install ffmpeg and ffprobe locally before running transcript jobs.',
      },
      { status: 500 }
    );
  }
}
