import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const recipes = await prisma.recipe.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      ratings: { select: { stars: true } },
    },
  });

  const items = recipes.map((r) => {
    const count = r.ratings.length;
    const avg = count > 0 ? r.ratings.reduce((s, x) => s + x.stars, 0) / count : null;
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      imageUrl: r.imageUrl,
      avgRating: avg,
      ratingCount: count,
      createdAt: r.createdAt.toISOString(),
    };
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, rawText, imageUrl, ingredients, steps } = body;

    if (!name || !rawText) {
      return NextResponse.json({ error: 'name and rawText are required' }, { status: 400 });
    }

    const recipe = await prisma.recipe.create({
      data: {
        name,
        description: description || null,
        rawText,
        imageUrl: imageUrl || null,
        ingredients: {
          create: (ingredients || []).map(
            (ing: { quantity?: string; unit?: string; name: string }, i: number) => ({
              position: i + 1,
              quantity: ing.quantity || null,
              unit: ing.unit || null,
              name: ing.name,
            })
          ),
        },
        steps: {
          create: (steps || []).map((step: { text: string }, i: number) => ({
            position: i + 1,
            text: step.text,
          })),
        },
      },
    });

    return NextResponse.json({ id: recipe.id }, { status: 201 });
  } catch (err) {
    console.error('Create recipe error:', err);
    return NextResponse.json({ error: 'Failed to create recipe' }, { status: 500 });
  }
}
