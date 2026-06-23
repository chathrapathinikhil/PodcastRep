import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { AdType } from '@/types';

const AD_TYPES: AdType[] = ['static', 'auto', 'ab'];

function validateMarkerPatch(body: any) {
  if (body.time !== undefined && (typeof body.time !== 'number' || body.time < 0)) return 'time must be a non-negative number';
  if (body.type !== undefined && !AD_TYPES.includes(body.type)) return 'type must be static, auto, or ab';
  if (body.adIds !== undefined && (!Array.isArray(body.adIds) || !body.adIds.every((id: unknown) => typeof id === 'string'))) return 'adIds must be an array of strings';
  if (body.label !== undefined && typeof body.label !== 'string') return 'label must be a string';
  if (body.abIndex !== undefined && (typeof body.abIndex !== 'number' || body.abIndex < 0)) return 'abIndex must be a non-negative number';
  if (body.abStats !== undefined && (typeof body.abStats !== 'object' || Array.isArray(body.abStats))) return 'abStats must be an object';
  return null;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const error = validateMarkerPatch(body);
  if (error) return NextResponse.json({ error }, { status: 400 });
  const marker = db.markers.update(params.id, body);
  if (!marker) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(marker);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const ok = db.markers.delete(params.id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
