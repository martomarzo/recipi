// Matching simple (sin dependencias) entre una línea de ingrediente
// parseada y el catálogo, para preseleccionar el mejor candidato en el
// mapeador de importación.

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "") // saca acentos tras descomponer NFD
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface MatchCandidate {
  id: number;
  name: string;
}

/** Devuelve los candidatos del catálogo que matchean por substring, mejor primero. */
export function matchIngredients<T extends MatchCandidate>(lineName: string, catalog: T[]): T[] {
  const needle = normalizeText(lineName);
  if (!needle) return [];

  const scored = catalog
    .map((item) => {
      const hay = normalizeText(item.name);
      if (!hay) return null;
      let score = -1;
      if (hay === needle) score = 100;
      else if (needle.includes(hay)) score = 80 - Math.abs(needle.length - hay.length);
      else if (hay.includes(needle)) score = 60 - Math.abs(needle.length - hay.length);
      else {
        // coincidencia por palabra suelta (ej. "pechuga de pollo" vs "pollo")
        const needleWords = needle.split(" ");
        const hayWords = hay.split(" ");
        const shared = needleWords.filter((w) => w.length > 2 && hayWords.includes(w));
        if (shared.length > 0) score = 20 + shared.length * 5;
      }
      return score >= 0 ? { item, score } : null;
    })
    .filter((x): x is { item: T; score: number } => x !== null)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 6).map((s) => s.item);
}
