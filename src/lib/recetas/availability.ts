// Texto de disponibilidad de un ingrediente en la dieta activa, para la
// sección Recetas (SPECS §4.4). Deriva de lib/plan.ts — no reimplementa la
// lógica de fases/bloques, solo la traduce a texto + tono visual.

import { fmtDdMm } from "@/lib/dates";
import type { Availability } from "@/lib/plan";
import { todayISO } from "@/lib/dates";

export type AvailabilityTone = "ok" | "warn" | "muted" | "bad";

export interface AvailabilityText {
  text: string;
  tone: AvailabilityTone;
}

export function describeAvailability(av: Availability, today: string = todayISO()): AvailabilityText {
  if (av.kind === "base") {
    return { text: "disponible todo el plan", tone: "ok" };
  }
  if (av.kind === "no_disponible") {
    return { text: "no está en el plan", tone: "muted" };
  }

  const block = av.block!;
  if (block.status === "con_sintomas") {
    return { text: `con síntomas · ${block.name}`, tone: "bad" };
  }
  if (today < block.start) {
    return { text: `todavía no (entra en S${av.week})`, tone: "muted" };
  }
  if (today <= block.end) {
    return {
      text: `disponible desde S${av.week} · ${fmtDdMm(block.start)} — en prueba hasta ${fmtDdMm(block.end)}`,
      tone: "warn",
    };
  }
  return { text: `disponible desde S${av.week} · ${fmtDdMm(block.start)}`, tone: "ok" };
}
