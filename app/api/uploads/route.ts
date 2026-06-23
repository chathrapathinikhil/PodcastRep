import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

function safeName(name: string) {
  const ext = path.extname(name).toLowerCase();
  const base = path.basename(name, ext)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60) || 'upload';
  return `${base}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }

  if (!file.type.startsWith('video/')) {
    return NextResponse.json({ error: 'only video uploads are supported' }, { status: 400 });
  }

  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadsDir, { recursive: true });

  const filename = safeName(file.name);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, filename), bytes);

  return NextResponse.json({
    name: file.name,
    filename,
    url: `/uploads/${filename}`,
    size: file.size,
    type: file.type,
  }, { status: 201 });
}
