import { ReactNode } from 'react';
import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { loadDiet } from '@/lib/planData';
import type { ComputedBlock, Week } from '@/lib/plan';
import { fmtDdMm, fmtLargo, rangoDdMm } from '@/lib/dates';
import { phaseClasses } from '@/components/dietas/phaseColors';
import { MiniMarkdown } from '@/components/dietas/markdown';
import ResumenToolbar from '@/components/dietas/ResumenToolbar';

// Ruta /dietas/:id/resumen (§6 SPECS.md, criterio de aceptación 6): vista
// compacta de todo el plan pensada para leer de un vistazo y para 1-2 A4 —
// tabla de semanas + caja "base segura" + caja "a evitar" + reglas diarias.
// Server component: sin JS de cliente salvo la barra de acciones (Exportar
// PDF / Imprimir), que la ruta /api/dietas/:id/pdf renderiza server-side
// navegando a esta misma página con puppeteer-core.

function statusIcon(status: string): string {
  if (status === 'tolerado') return '✓';
  if (status === 'con_sintomas') return '⚠';
  return '';
}

function WeekWhatCell({ week }: { week: Week }): ReactNode {
  if (week.blocks.length > 0) {
    return (
      <div className="grid gap-0.5">
        {week.blocks.map((wb) => (
          <div key={wb.block.id}>
            <b>
              {wb.block.emoji} {wb.block.name}
            </b>{' '}
            <span className="text-tinta-suave">{rangoDdMm(wb.block.start, wb.block.end)}</span>{' '}
            {statusIcon(wb.block.status)}
          </div>
        ))}
      </div>
    );
  }
  return <span className="text-tinta-suave">{week.phase.description ?? week.phase.name}</span>;
}

export default async function ResumenPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const loaded = await loadDiet(params.id, user.id);
  if (!loaded) notFound();
  const { diet, plan, baseIds } = loaded;

  const [baseIngredients, evitarRules] = await Promise.all([
    prisma.ingredient.findMany({
      where: { id: { in: Array.from(baseIds) } },
      include: { category: true },
      orderBy: [{ category: { sort: 'asc' } }, { name: 'asc' }],
    }),
    prisma.phaseIngredientRule.findMany({
      where: {
        phaseId: { in: plan.phases.map((p) => p.id) },
        rule: 'evitar',
        ingredientId: null,
        categoryId: null,
        note: { not: null },
      },
      orderBy: { id: 'asc' },
    }),
  ]);

  // Base segura agrupada por categoría, "emoji + nombre" por ítem (compacto).
  const baseGroups: Array<{ key: string; name: string; emoji: string; items: string[] }> = [];
  for (const ing of baseIngredients) {
    let group = baseGroups.find((g) => g.key === ing.category.key);
    if (!group) {
      group = { key: ing.category.key, name: ing.category.name, emoji: ing.category.emoji, items: [] };
      baseGroups.push(group);
    }
    group.items.push(`${ing.emoji ? ing.emoji + ' ' : ''}${ing.name.toLowerCase()}`);
  }

  // Notas de "a evitar": las reglas viven por fase pero el texto suele
  // repetirse entre fases (misma lista para exclusión/probióticos) — se
  // deduplica por contenido para no repetirlo en la vista compacta.
  const evitarNotes = Array.from(new Set(evitarRules.map((r) => r.note).filter((n): n is string => !!n)));
  const notYetTolerated: ComputedBlock[] = plan.blocks.filter((b) => b.status !== 'tolerado');

  // Reglas diarias: cada fase trae su propio dailyRulesMd (a veces el mismo
  // texto repetido, a veces un superset — p. ej. reintroducción agrega las
  // reglas de los 4 días). Se queda solo con los textos que no están
  // contenidos enteros dentro de otro más largo, para mostrar un bloque
  // compacto sin líneas duplicadas.
  const dailyRuleTexts = Array.from(new Set(plan.phases.map((p) => p.dailyRulesMd).filter((t): t is string => !!t)));
  const dailyRules = dailyRuleTexts.filter(
    (t) => !dailyRuleTexts.some((other) => other !== t && other.length > t.length && other.includes(t))
  );

  // Fase abierta (mantenimiento): no genera semanas propias en plan.weeks
  // (computePlan solo cuenta fases con duración finita), se muestra aparte.
  const openPhase = plan.phases.find((p) => p.end === null) ?? null;

  return (
    <div className="resumen-root mx-auto max-w-[880px]">
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          .resumen-root { font-size: 12px; }
          .resumen-table { font-size: 11px; }
          .resumen-table th { background: #eee !important; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .resumen-box, .resumen-table tr { break-inside: avoid; }
          .card, .resumen-box { box-shadow: none !important; }
        }
      `}</style>

      <Link
        href={`/dietas/${diet.id}`}
        className="no-print mb-2 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-tinta-suave hover:text-tinta"
      >
        ← Volver a la dieta
      </Link>

      <div className="text-center">
        <h1 className="font-display text-3xl font-medium sm:text-4xl">{diet.name}</h1>
        <p className="mx-auto mt-1 max-w-xl text-sm text-tinta-suave">
          {rangoDdMm(plan.startDate, plan.endDate)} · inicio {fmtLargo(plan.startDate)} · regla de los 4 días en
          reintroducción
        </p>
      </div>

      <div className="no-print my-4 flex flex-wrap justify-center gap-3.5">
        <Link
          href={`/dietas/${diet.id}`}
          className="flex min-h-[42px] items-center rounded-full border border-linea bg-white px-4 py-2 text-[13.5px] font-semibold text-tinta hover:border-tinta-suave"
        >
          Timeline
        </Link>
        <Link
          href={`/dietas/${diet.id}/disponibilidad`}
          className="flex min-h-[42px] items-center rounded-full border border-linea bg-white px-4 py-2 text-[13.5px] font-semibold text-tinta hover:border-tinta-suave"
        >
          Disponibilidad
        </Link>
        <span className="inline-flex min-h-[42px] items-center rounded-full border border-salvia-osc bg-salvia-osc px-4 py-2 text-[13.5px] font-semibold text-crema">
          Vista general
        </span>
        {loaded.role !== 'viewer' && (
          <Link
            href={`/dietas/${diet.id}/editar`}
            className="flex min-h-[42px] items-center rounded-full border border-linea bg-white px-4 py-2 text-[13.5px] font-semibold text-tinta hover:border-tinta-suave"
          >
            ✎ Editar fases y bloques
          </Link>
        )}
      </div>

      <ResumenToolbar dietId={diet.id} />

      <div className="resumen-box card overflow-hidden">
        <table className="resumen-table w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              <th className="bg-tinta px-3 py-2.5 text-left text-[12px] uppercase tracking-wide text-crema">Semana</th>
              <th className="bg-tinta px-3 py-2.5 text-left text-[12px] uppercase tracking-wide text-crema">Fechas</th>
              <th className="bg-tinta px-3 py-2.5 text-left text-[12px] uppercase tracking-wide text-crema">Fase</th>
              <th className="bg-tinta px-3 py-2.5 text-left text-[12px] uppercase tracking-wide text-crema">Qué pasa</th>
            </tr>
          </thead>
          <tbody>
            {plan.weeks.map((w) => {
              const pc = phaseClasses(w.phase.color);
              return (
                <tr key={w.num} className={`border-t border-linea border-l-4 ${pc.border}`}>
                  <td className="px-3 py-2.5 align-top font-bold">S{w.num}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-top">{rangoDdMm(w.start, w.end)}</td>
                  <td className="px-3 py-2.5 align-top">
                    <span className={`text-[11px] font-extrabold uppercase tracking-wide ${pc.text}`}>
                      {w.phase.name}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <WeekWhatCell week={w} />
                  </td>
                </tr>
              );
            })}
            {openPhase && (
              <tr className={`border-t border-linea border-l-4 ${phaseClasses(openPhase.color).border}`}>
                <td className="px-3 py-2.5 align-top font-bold">S{plan.weeks.length + 1}+</td>
                <td className="whitespace-nowrap px-3 py-2.5 align-top">desde {fmtDdMm(openPhase.start)}</td>
                <td className="px-3 py-2.5 align-top">
                  <span className={`text-[11px] font-extrabold uppercase tracking-wide ${phaseClasses(openPhase.color).text}`}>
                    {openPhase.name}
                  </span>
                </td>
                <td className="px-3 py-2.5 align-top text-tinta-suave">
                  {openPhase.description ?? 'Dieta ampliada con todo lo tolerado 🎉'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
        <div className="resumen-box card p-4">
          <h3 className="font-display mb-2.5 text-lg font-semibold">✅ Base segura (todo el plan)</h3>
          {baseGroups.length === 0 && <p className="text-[13px] text-tinta-suave">Sin reglas de base cargadas.</p>}
          <div className="space-y-1.5 text-[13px]">
            {baseGroups.map((g) => (
              <p key={g.key}>
                <b>
                  {g.emoji} {g.name}:
                </b>{' '}
                {g.items.join(', ')}.
              </p>
            ))}
          </div>
        </div>

        <div className="resumen-box card p-4">
          <h3 className="font-display mb-2.5 text-lg font-semibold">🚫 A evitar</h3>
          <div className="space-y-1.5 text-[13px]">
            {evitarNotes.map((note, i) => (
              <MiniMarkdown key={i} text={note} />
            ))}
            {evitarNotes.length === 0 && <p className="text-tinta-suave">Sin reglas de exclusión cargadas.</p>}
          </div>
          {notYetTolerated.length > 0 && (
            <div className="mt-2.5">
              <b className="text-[13px]">Todavía no reintroducidos:</b>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {notYetTolerated.map((b) => (
                  <span key={b.id} className="rounded-full border border-linea bg-white px-2.5 py-0.5 text-[12.5px]">
                    {b.emoji} {b.name} {statusIcon(b.status)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {dailyRules.length > 0 && (
        <div className="resumen-box card mt-3.5 p-4">
          <h3 className="font-display mb-2 text-lg font-semibold">Reglas diarias</h3>
          <div className="space-y-1.5 text-[13px] text-tinta-suave">
            {dailyRules.map((text, i) => (
              <MiniMarkdown key={i} text={text} className="space-y-1" />
            ))}
          </div>
        </div>
      )}

      <p className="no-print mx-auto mt-6 max-w-[560px] text-center text-[12px] text-tinta-suave">
        Vista optimizada para leer de un vistazo y para papel (1–2 A4). Usá &quot;Exportar PDF&quot; o &quot;Imprimir&quot;
        arriba.
      </p>
    </div>
  );
}
