import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const { challengeId } = await request.json();
    
    const challenge = await convex.query(api.duel.getChallenge, { challengeId });
    
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    return NextResponse.json({ status: challenge.challenge.status });
  } catch (error) {
    console.error('Error checking challenge status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
