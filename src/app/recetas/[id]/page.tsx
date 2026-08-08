import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { loadActiveDiet } from "@/lib/planData";
import { findVisibleDish, toDishDTO } from "@/lib/recetas/dishQuery";
import { splitSteps } from "@/lib/recetas/steps";
import { MEAL_TYPE_LABELS } from "@/lib/recetas/constants";
import StepList from "@/components/StepList";
import DishActions from "@/components/recetas/DishActions";

const TONE_CLASSES: Record<string, string> = {
  ok: "text-salvia-osc",
  warn: "text-terra-osc",
  muted: "text-tinta-suave",
  bad: "text-mal",
};

export default async function RecetaDetallePage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const dish = await findVisibleDish(params.id, user.id);
  if (!dish) notFound();

  const activeDiet = await loadActiveDiet(user.id);
  const dto = toDishDTO(dish, user.id, activeDiet);
  const steps = splitSteps(dto.recipeMd);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-1">
        <Link href="/recetas" className="text-sm text-tinta-suave hover:text-tinta">
          ← Recetas
        </Link>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold leading-tight">{dto.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-terra/40 bg-terra-bg px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-terra-osc">
              {MEAL_TYPE_LABELS[dto.mealType as keyof typeof MEAL_TYPE_LABELS] ?? dto.mealType}
            </span>
            {dto.suggestions.map((s) => (
              <span
                key={s.id}
                className="rounded-full border border-linea bg-neutro-bg px-2 py-0.5 text-[11px] font-semibold text-tinta-suave"
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {dto.description && <p className="mt-3 text-sm text-tinta-suave">{dto.description}</p>}

      {dto.sourceUrl && (
        <p className="mt-1 text-xs text-tinta-suave">
          Importada de{" "}
          <a href={dto.sourceUrl} target="_blank" rel="noreferrer" className="underline hover:text-tinta">
            {dto.sourceUrl}
          </a>
        </p>
      )}

      {activeDiet && dto.allAvailableToday === false && (
        <p className="mt-3 rounded-xl border border-mal/30 bg-terra-bg px-3 py-2 text-sm font-semibold text-mal">
          ⚠ No todos los ingredientes están disponibles hoy en tu dieta activa.
        </p>
      )}

      <div className="mt-4">
        <DishActions
          id={dto.id}
          isOwner={dto.isOwner}
          isGlobal={dto.isGlobal}
          duplicatePayload={{
            name: dto.name,
            description: dto.description,
            mealType: dto.mealType,
            recipeMd: dto.recipeMd,
            ingredients: dto.ingredients.map((i) => ({ ingredientId: i.ingredientId, grams: i.grams })),
          }}
        />
      </div>

      <section className="mt-6">
        <h2 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-tinta-suave">Ingredientes</h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {dto.ingredients.map((i) => (
                <tr key={i.ingredientId} className="border-b border-linea last:border-0">
                  <td className="px-4 py-2.5">
                    <div>
                      {i.emoji ? `${i.emoji} ` : ""}
                      {i.name}
                    </div>
                    {i.availability && (
                      <div className={`text-[11.5px] ${TONE_CLASSES[i.availability.tone]}`}>
                        {i.availability.text}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold">{i.grams} g</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-[10px] uppercase tracking-wide text-tinta-suave/70">aprox. por porción</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <span className="rounded-full border border-tinta bg-tinta px-3 py-1 text-sm font-bold text-crema">
            {dto.macros.kcal} kcal
          </span>
          <span className="rounded-full border border-linea bg-crema px-3 py-1 text-sm font-bold text-tinta">
            P {dto.macros.protein} g
          </span>
          <span className="rounded-full border border-linea bg-crema px-3 py-1 text-sm font-bold text-tinta">
            H {dto.macros.carbs} g
          </span>
          <span className="rounded-full border border-linea bg-crema px-3 py-1 text-sm font-bold text-tinta">
            G {dto.macros.fat} g
          </span>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-tinta-suave">Preparación</h2>
        {steps.length > 0 ? (
          <StepList steps={steps} />
        ) : (
          <p className="text-sm text-tinta-suave">Todavía no hay pasos de preparación cargados.</p>
        )}
      </section>
    </div>
  );
}
