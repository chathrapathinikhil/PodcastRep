import { NextRequest, NextResponse } from 'next/server';
import { generateHls, generateMp4 } from '@/lib/media-pipeline';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body?.episodeUrl) {
      return NextResponse.json({ error: 'Upload an episode video before exporting.' }, { status: 400 });
    }

    const input = {
      episodeUrl: body.episodeUrl,
      markers: body.markers ?? [],
      ads: body.ads ?? [],
    };
    const result = body.type === 'hls' ? await generateHls(input) : await generateMp4(input);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Export failed.',
        hint: 'Install ffmpeg and ffprobe locally, then retry the export.',
      },
      { status: 500 }
    );
  }
}
