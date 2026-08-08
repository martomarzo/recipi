import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const recipe = await prisma.recipe.findUnique({
    where: { id: params.id },
    include: {
      ingredients: { orderBy: { position: 'asc' } },
      steps: { orderBy: { position: 'asc' } },
      ratings: { select: { stars: true } },
    },
  });

  if (!recipe) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const count = recipe.ratings.length;
  const avg = count > 0 ? recipe.ratings.reduce((s, x) => s + x.stars, 0) / count : null;

  return NextResponse.json({
    ...recipe,
    ratings: undefined,
    avgRating: avg,
    ratingCount: count,
    createdAt: recipe.createdAt.toISOString(),
    updatedAt: recipe.updatedAt.toISOString(),
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { name, description, rawText, imageUrl, ingredients, steps } = body;

    await prisma.$transaction([
      prisma.ingredient.deleteMany({ where: { recipeId: params.id } }),
      prisma.step.deleteMany({ where: { recipeId: params.id } }),
      prisma.recipe.update({
        where: { id: params.id },
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
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Update recipe error:', err);
    return NextResponse.json({ error: 'Failed to update recipe' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.recipe.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete recipe' }, { status: 500 });
  }
}
