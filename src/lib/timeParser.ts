// Detecta frases de tiempo dentro de un paso de preparación ("hornear 20
// minutos", "dejar reposar 1 hora y 30 minutos") para ofrecer un timer
// interactivo. Soporta español (idioma de la app) e inglés (recetas
// importadas de sitios en inglés).

const HOUR = "horas?|hrs?|h";
const MIN = "minutos?|mins?|min";
const SEC = "segundos?|segs?|sec";
const HOUR_EN = "hours?|hrs?|h";
const MIN_EN = "minutes?|mins?|min";
const SEC_EN = "seconds?|secs?|sec";

const UNIT = `${HOUR}|${MIN}|${SEC}|${HOUR_EN}|${MIN_EN}|${SEC_EN}`;

const TIME_REGEX = new RegExp(
  `(\\d+(?:[.,]\\d+)?)\\s*(${UNIT})(?:\\s+(?:y|and)\\s+(\\d+(?:[.,]\\d+)?)\\s*(${MIN}|${SEC}|${MIN_EN}|${SEC_EN}))?`,
  "gi"
);

function unitToSeconds(value: number, unit: string): number {
  const u = unit.toLowerCase();
  if (/^(horas?|hrs?|h|hours?)$/.test(u)) return value * 3600;
  if (/^(minutos?|mins?|min|minutes?)$/.test(u)) return value * 60;
  return value; // segundos
}

export function extractTimers(text: string): { label: string; seconds: number }[] {
  const timers: { label: string; seconds: number }[] = [];
  const regex = new RegExp(TIME_REGEX.source, "gi");
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const val1 = parseFloat(match[1].replace(",", "."));
    const unit1 = match[2];
    let total = unitToSeconds(val1, unit1);

    if (match[3] && match[4]) {
      const val2 = parseFloat(match[3].replace(",", "."));
      total += unitToSeconds(val2, match[4]);
    }

    if (total > 0) {
      timers.push({ label: match[0].trim(), seconds: Math.round(total) });
    }
  }

  return timers;
}

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
