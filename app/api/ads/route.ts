import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function validateAd(body: any) {
  if (typeof body?.name !== 'string' || body.name.trim().length === 0) return 'name is required';
  if (typeof body?.url !== 'string' || body.url.trim().length === 0) return 'url is required';
  if (body.thumbnail !== undefined && typeof body.thumbnail !== 'string') return 'thumbnail must be a string';
  if (body.duration !== undefined && (typeof body.duration !== 'number' || body.duration < 0)) return 'duration must be a non-negative number';
  return null;
}

export async function GET() {
  return NextResponse.json(db.ads.getAll());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const error = validateAd(body);
  if (error) return NextResponse.json({ error }, { status: 400 });
  const ad = db.ads.create(body);
  return NextResponse.json(ad, { status: 201 });
}
