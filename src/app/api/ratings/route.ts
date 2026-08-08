import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { recipeId, stars } = await req.json();

    if (!recipeId || typeof stars !== 'number' || stars < 1 || stars > 5) {
      return NextResponse.json({ error: 'recipeId and stars (1-5) are required' }, { status: 400 });
    }

    await prisma.rating.create({ data: { recipeId, stars: Math.round(stars) } });

    const ratings = await prisma.rating.findMany({ where: { recipeId }, select: { stars: true } });
    const count = ratings.length;
    const avg = count > 0 ? ratings.reduce((s, r) => s + r.stars, 0) / count : null;

    return NextResponse.json({ avgRating: avg, ratingCount: count });
  } catch (err) {
    console.error('Rating error:', err);
    return NextResponse.json({ error: 'Failed to submit rating' }, { status: 500 });
  }
}
