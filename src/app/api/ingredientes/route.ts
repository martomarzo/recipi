import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

function slugify(input: string): string {
  const base = input
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  return base || 'ingrediente';
}

async function uniqueKey(base: string): Promise<string> {
  let key = base;
  let n = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.ingredient.findUnique({ where: { key } })) {
    key = `${base}-${n}`;
    n++;
  }
  return key;
}

function parseRequiredNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();
  const categoria = searchParams.get('categoria')?.trim();
  const archivados = searchParams.get('archivados') === '1';

  const ingredientes = await prisma.ingredient.findMany({
    where: {
      ...(archivados ? {} : { archivedAt: null }),
      ...(q ? { name: { contains: q } } : {}),
      ...(categoria && categoria !== 'todas' ? { category: { key: categoria } } : {}),
    },
    include: { category: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(ingredientes);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const { name, categoryId, kcal100, protein100, carbs100, fat100, fiber100, notes, emoji, imagePath } =
    body as Record<string, unknown>;

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'El nombre es obligatorio.' }, { status: 400 });
  }

  const catId = Number(categoryId);
  if (!catId || Number.isNaN(catId)) {
    return NextResponse.json({ error: 'La categoría es obligatoria.' }, { status: 400 });
  }
  const category = await prisma.ingredientCategory.findUnique({ where: { id: catId } });
  if (!category) {
    return NextResponse.json({ error: 'Categoría inválida.' }, { status: 400 });
  }

  const kcal = parseRequiredNumber(kcal100);
  const protein = parseRequiredNumber(protein100);
  const carbs = parseRequiredNumber(carbs100);
  const fat = parseRequiredNumber(fat100);
  if (kcal === null || protein === null || carbs === null || fat === null) {
    return NextResponse.json(
      { error: 'kcal, proteína, carbohidratos y grasa por 100 g son obligatorios y deben ser números ≥ 0.' },
      { status: 400 }
    );
  }

  let fiber: number | null = null;
  if (fiber100 !== undefined && fiber100 !== null && fiber100 !== '') {
    const f = Number(fiber100);
    if (Number.isNaN(f) || f < 0) {
      return NextResponse.json({ error: 'Valor inválido para fibra.' }, { status: 400 });
    }
    fiber = f;
  }

  const key = await uniqueKey(slugify(name));

  const ingredient = await prisma.ingredient.create({
    data: {
      key,
      categoryId: catId,
      name: name.trim(),
      notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
      emoji: typeof emoji === 'string' && emoji.trim() ? emoji.trim() : null,
      imagePath: typeof imagePath === 'string' && imagePath.trim() ? imagePath.trim() : null,
      kcal100: kcal,
      protein100: protein,
      carbs100: carbs,
      fat100: fat,
      fiber100: fiber,
    },
    include: { category: true },
  });

  return NextResponse.json(ingredient, { status: 201 });
}
