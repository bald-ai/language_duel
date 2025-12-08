import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';

export const runtime = 'nodejs';
import { api } from '@/convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const { duelId } = await request.json();
    
    const duel = await convex.query(api.duel.getDuel, { duelId });
    
    if (!duel) {
      return NextResponse.json({ error: 'Duel not found' }, { status: 404 });
    }

    return NextResponse.json({ status: duel.duel.status });
  } catch (error) {
    console.error('Error checking duel status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
