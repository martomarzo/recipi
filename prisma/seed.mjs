// prisma/seed.mjs
//
// Seed idempotente para "Protocolo" — carga el catálogo global (categorías,
// ingredientes, recetas) y el plan demo "Protocolo Intestinal" (Apéndice A
// de SPECS.md) a partir de los datos verbatim en prisma/seed-data/*.json.
//
// Uso: npm run seed  (equivalente a `node prisma/seed.mjs`)
// Variables de entorno opcionales:
//   SEED_USER_PASSWORD  contraseña del usuario demo creado si no hay usuarios (default "protocolo123")
//   SEED_USER_EMAIL     si se define, fuerza qué usuario existente es el dueño del plan demo
//
// Idempotencia: todo se hace vía upsert por clave estable (key/name) o
// vía "si ya existe, no lo vuelvo a crear". Correrlo dos veces no duplica nada.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cargar .env manualmente: un script `node prisma/seed.mjs` plano no pasa
// por el CLI de Prisma (que auto-carga .env), así que DATABASE_URL no
// estaría definida sin esto. process.loadEnvFile() es nativo en Node 20+.
try {
  process.loadEnvFile(path.join(__dirname, "..", ".env"));
} catch {
  // sin .env o ya cargado: seguimos, puede venir del entorno (Docker, etc.)
}

const { PrismaClient } = await import("@prisma/client");
const bcrypt = (await import("bcryptjs")).default;

const prisma = new PrismaClient();

const SEED_DATA_DIR = path.join(__dirname, "seed-data");

async function loadJson(file) {
  const raw = await readFile(path.join(SEED_DATA_DIR, file), "utf8");
  return JSON.parse(raw);
}

async function main() {
  // Nota: phases.json no se usa directamente — sort/color/duración/descripción
  // de cada fase vienen codificados abajo tal como los especifica SPECS.md
  // Apéndice A.1 (colores como tokens cortos "salvia|azul|terra|neutro" para
  // que coincidan con el enum documentado en schema.prisma, no los hex de
  // phases.json que son para el prototipo HTML).
  const [categories, ingredients, blocks, rules, recipes] = await Promise.all(
    [
      loadJson("categories.json"),
      loadJson("ingredients.json"),
      loadJson("blocks.json"),
      loadJson("rules.json"),
      loadJson("recipes.json"),
    ]
  );

  const summary = {
    categoriesCreated: 0,
    categoriesUpdated: 0,
    ingredientsCreated: 0,
    ingredientsUpdated: 0,
    dishesCreated: 0,
    dishesUpdated: 0,
  };

  // ── 1. Categorías ────────────────────────────────────────────────────
  const categoryIdByKey = new Map(); // key -> IngredientCategory.id (int)

  for (let i = 0; i < categories.length; i++) {
    const c = categories[i];
    const existing = await prisma.ingredientCategory.findUnique({
      where: { key: c.id },
    });
    const row = await prisma.ingredientCategory.upsert({
      where: { key: c.id },
      create: { key: c.id, name: c.n, emoji: c.e, sort: i },
      update: { name: c.n, emoji: c.e, sort: i },
    });
    categoryIdByKey.set(c.id, row.id);
    if (existing) summary.categoriesUpdated++;
    else summary.categoriesCreated++;
  }

  // ── 2. Ingredientes ──────────────────────────────────────────────────
  const ingredientIdByKey = new Map(); // key -> Ingredient.id (int)

  for (const key of Object.keys(ingredients)) {
    const ing = ingredients[key];
    const categoryId = categoryIdByKey.get(ing.cat);
    if (!categoryId) {
      throw new Error(
        `Ingrediente "${key}" referencia categoría desconocida "${ing.cat}"`
      );
    }
    const existing = await prisma.ingredient.findUnique({ where: { key } });
    const row = await prisma.ingredient.upsert({
      where: { key },
      create: {
        key,
        name: ing.n,
        emoji: ing.e,
        notes: ing.nota ?? null,
        kcal100: ing.kcal,
        protein100: ing.protein,
        carbs100: ing.carbs,
        fat100: ing.fat,
        categoryId,
      },
      update: {
        name: ing.n,
        emoji: ing.e,
        notes: ing.nota ?? null,
        kcal100: ing.kcal,
        protein100: ing.protein,
        carbs100: ing.carbs,
        fat100: ing.fat,
        categoryId,
      },
    });
    ingredientIdByKey.set(key, row.id);
    if (existing) summary.ingredientsUpdated++;
    else summary.ingredientsCreated++;
  }

  // ── 3. Usuario dueño del plan demo ──────────────────────────────────
  let owner;
  let userCreated = false;
  let plainPassword = null;

  const forcedEmail = process.env.SEED_USER_EMAIL;
  const userCount = await prisma.user.count();

  if (forcedEmail) {
    owner = await prisma.user.findUnique({ where: { email: forcedEmail } });
    if (!owner) {
      throw new Error(
        `SEED_USER_EMAIL="${forcedEmail}" no corresponde a ningún usuario existente. Abortando.`
      );
    }
  } else if (userCount === 0) {
    plainPassword = process.env.SEED_USER_PASSWORD || "protocolo123";
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    owner = await prisma.user.create({
      data: {
        email: "demo@protocolo.local",
        name: "Marto",
        passwordHash,
      },
    });
    userCreated = true;
  } else {
    owner = await prisma.user.findFirstOrThrow({
      orderBy: { createdAt: "asc" },
    });
  }

  // ── 4. Dieta demo "Protocolo Intestinal" ────────────────────────────
  const DIET_NAME = "Protocolo Intestinal";
  let diet = await prisma.diet.findFirst({
    where: { userId: owner.id, name: DIET_NAME },
  });
  let dietCreated = false;
  // Poblados solo si la dieta se crea en este run (ver §5-8 más abajo);
  // se usan luego en §10 para las sugerencias de recetas.
  let phaseIdByKey = null;
  let blockIdByIndex = null;

  if (diet) {
    console.log(
      `Dieta "${DIET_NAME}" ya existe para ${owner.email} (id=${diet.id}) — ya existe, no se recrea el plan.`
    );
  } else {
    diet = await prisma.diet.create({
      data: {
        userId: owner.id,
        name: DIET_NAME,
        description:
          "Protocolo intestinal de 11 semanas: exclusión → probióticos → " +
          "reintroducción de 11 alimentos (uno cada 4 días) → mantenimiento. " +
          "Objetivo: reducir la inflamación, reparar la barrera intestinal y " +
          "reintroducir alimentos de forma ordenada según tolerancia.",
        startDate: new Date("2026-08-03T00:00:00.000Z"),
        isActive: true,
      },
    });
    dietCreated = true;

    // ── 5. Fases ────────────────────────────────────────────────────
    // Los textos del prototipo traen <b>…</b>; en la app se renderiza markdown.
    const htmlToMd = (s) => s.replaceAll("<b>", "**").replaceAll("</b>", "**");
    const dailyRulesBase = rules.REGLAS_DIARIAS.map((r) => `- ${htmlToMd(r)}`).join(
      "\n"
    );
    const reintroRulesMd = rules.REGLAS_REINTRO.map((r) => `- ${htmlToMd(r)}`).join(
      "\n"
    );

    const phaseDefs = [
      {
        key: "exclusion",
        name: "Exclusión",
        type: "exclusion",
        sort: 1,
        startOffsetDays: 0,
        durationDays: 21,
        color: "salvia",
        description:
          "Reducir inflamación y reparar barrera intestinal eliminando irritantes",
      },
      {
        key: "probioticos",
        name: "Probióticos",
        type: "probioticos",
        sort: 2,
        startOffsetDays: 21,
        durationDays: 7,
        color: "azul",
        description:
          "Misma dieta de exclusión + probióticos (ej. Bonusan Bacteri 17 Resilience Pro, 1 sobre después de comer)",
      },
      {
        key: "reintroduccion",
        name: "Reintroducción",
        type: "reintroduccion",
        sort: 3,
        startOffsetDays: 28,
        durationDays: 44,
        color: "terra",
        description:
          "Reintroducir alimentos de a uno, regla de los 4 días",
      },
      {
        key: "mantenimiento",
        name: "Mantenimiento",
        type: "mantenimiento",
        sort: 4,
        startOffsetDays: 72,
        durationDays: null,
        color: "neutro",
        description: "Dieta ampliada con lo tolerado",
      },
    ];

    phaseIdByKey = new Map();
    for (const p of phaseDefs) {
      const dailyRulesMd =
        p.key === "reintroduccion"
          ? `${dailyRulesBase}\n\n**Reglas de reintroducción:**\n${reintroRulesMd}`
          : dailyRulesBase;

      const phase = await prisma.phase.create({
        data: {
          dietId: diet.id,
          name: p.name,
          type: p.type,
          sort: p.sort,
          startOffsetDays: p.startOffsetDays,
          durationDays: p.durationDays,
          color: p.color,
          description: p.description,
          dailyRulesMd,
        },
      });
      phaseIdByKey.set(p.key, phase.id);
    }

    const reintroPhaseId = phaseIdByKey.get("reintroduccion");
    const exclusionPhaseId = phaseIdByKey.get("exclusion");

    // ── 6. Bloques de reintroducción ───────────────────────────────
    blockIdByIndex = new Map(); // i (0-based) -> ReintroBlock.id
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const block = await prisma.reintroBlock.create({
        data: {
          phaseId: reintroPhaseId,
          sort: i + 1,
          name: b.n,
          emoji: b.e,
          durationDays: 4,
          tipsMd: b.tip,
          status: "pendiente",
        },
      });
      blockIdByIndex.set(i, block.id);
    }

    // ── 7. Bloque ↔ ingrediente ─────────────────────────────────────
    for (const [ingKey, blockIndex] of Object.entries(rules.GANTT_BLOQUE)) {
      const ingredientId = ingredientIdByKey.get(ingKey);
      const blockId = blockIdByIndex.get(blockIndex);
      if (!ingredientId || !blockId) {
        throw new Error(
          `GANTT_BLOQUE: no pude resolver ingrediente "${ingKey}" o bloque ${blockIndex}`
        );
      }
      await prisma.reintroBlockIngredient.create({
        data: { blockId, ingredientId },
      });
    }

    // ── 8a. Base segura (Exclusión) ─────────────────────────────────
    for (const group of rules.BASE) {
      for (const ingKey of group.ids) {
        const ingredientId = ingredientIdByKey.get(ingKey);
        if (!ingredientId) {
          throw new Error(`BASE: ingrediente desconocido "${ingKey}"`);
        }
        await prisma.phaseIngredientRule.create({
          data: {
            phaseId: exclusionPhaseId,
            ingredientId,
            categoryId: null,
            rule: "permitido",
          },
        });
      }
    }

    // ── 8b. A evitar (Exclusión) ────────────────────────────────────
    for (const [label, detail] of rules.EVITAR) {
      await prisma.phaseIngredientRule.create({
        data: {
          phaseId: exclusionPhaseId,
          ingredientId: null,
          categoryId: null,
          rule: "evitar",
          note: `**${label}**: ${detail}`,
        },
      });
    }
  }

  // ── 9. Recetas (Dish) ────────────────────────────────────────────────
  const dishIdByName = new Map();
  for (const r of recipes) {
    const existing = await prisma.dish.findFirst({
      where: { userId: null, name: r.n },
    });

    let dish;
    if (existing) {
      dish = await prisma.dish.update({
        where: { id: existing.id },
        data: {
          mealType: r.t,
          description: r.nota ?? null,
        },
      });
      // borrar y recrear ingredientes de la receta
      await prisma.dishIngredient.deleteMany({ where: { dishId: dish.id } });
      summary.dishesUpdated++;
    } else {
      dish = await prisma.dish.create({
        data: {
          userId: null,
          name: r.n,
          mealType: r.t,
          description: r.nota ?? null,
          recipeMd: null,
        },
      });
      summary.dishesCreated++;
    }

    let sortI = 0;
    for (const [ingKey, grams] of r.ing) {
      const ingredientId = ingredientIdByKey.get(ingKey);
      if (!ingredientId) {
        throw new Error(
          `Receta "${r.n}": ingrediente desconocido "${ingKey}"`
        );
      }
      await prisma.dishIngredient.create({
        data: { dishId: dish.id, ingredientId, grams, sort: sortI++ },
      });
    }

    dishIdByName.set(r.n, dish.id);
  }

  // ── 10. Sugerencias de recetas (solo si la dieta se creó en este run) ──
  if (dietCreated) {
    for (const r of recipes) {
      const dishId = dishIdByName.get(r.n);
      if (r.fase === "base") {
        await prisma.dishSuggestion.create({
          data: {
            dishId,
            dietId: diet.id,
            phaseId: null,
            blockId: null,
            weekNumber: null,
          },
        });
      } else if (typeof r.fase === "number") {
        const blockId = blockIdByIndex.get(r.fase);
        if (!blockId) {
          throw new Error(
            `Receta "${r.n}": bloque desconocido para fase=${r.fase}`
          );
        }
        await prisma.dishSuggestion.create({
          data: {
            dishId,
            dietId: diet.id,
            phaseId: null,
            blockId,
            weekNumber: null,
          },
        });
      } else {
        throw new Error(
          `Receta "${r.n}": valor de "fase" no reconocido: ${JSON.stringify(
            r.fase
          )}`
        );
      }
    }
  }

  // ── 11. Resumen ──────────────────────────────────────────────────────
  console.log("");
  console.log("── Resumen del seed ─────────────────────────────────────");
  console.log(
    `Categorías: ${summary.categoriesCreated} creadas, ${summary.categoriesUpdated} actualizadas`
  );
  console.log(
    `Ingredientes: ${summary.ingredientsCreated} creados, ${summary.ingredientsUpdated} actualizados`
  );
  console.log(
    `Platos: ${summary.dishesCreated} creados, ${summary.dishesUpdated} actualizados`
  );
  console.log(
    dietCreated
      ? `Dieta "${DIET_NAME}": creada (id=${diet.id}) para ${owner.email}, con 4 fases, 11 bloques de reintroducción y sus sugerencias de recetas.`
      : `Dieta "${DIET_NAME}": ya existía para ${owner.email} — no se tocó.`
  );
  if (userCreated) {
    console.log("");
    console.log("── Usuario demo creado ──────────────────────────────────");
    console.log(`  email:    demo@protocolo.local`);
    console.log(`  password: ${plainPassword}`);
    console.log("  (cambiar esta contraseña en producción)");
  } else {
    console.log(`Usuario dueño del plan: ${owner.email} (ya existía)`);
  }
  console.log("──────────────────────────────────────────────────────────");
}

main()
  .catch((err) => {
    console.error("Error corriendo el seed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
