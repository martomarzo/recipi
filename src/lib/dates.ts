// Fechas del plan: aritmética date-only sobre strings ISO "YYYY-MM-DD".
// Evita bugs de timezone: la DB guarda DateTime pero el dominio trabaja
// siempre con el día calendario, y "hoy" se resuelve en el cliente.

export type ISODate = string; // "YYYY-MM-DD"

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Interpreta un DateTime de la DB (guardado como medianoche UTC) como día calendario. */
export function dbDateToISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function isoToUTCDate(iso: ISODate): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = isoToUTCDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** b - a en días (positivo si b es posterior). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((isoToUTCDate(b).getTime() - isoToUTCDate(a).getTime()) / 86400000);
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

/** "dd/mm" */
export function fmtDdMm(iso: ISODate): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** "dd/mm/yyyy" */
export function fmtDdMmYyyy(iso: ISODate): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "lunes 3 de agosto" */
export function fmtLargo(iso: ISODate): string {
  const d = isoToUTCDate(iso);
  return `${DIAS_SEMANA[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

export function rangoDdMm(ini: ISODate, fin: ISODate): string {
  return `${fmtDdMm(ini)}–${fmtDdMm(fin)}`;
}
