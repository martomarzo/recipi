// Mapea el token de color de una fase (guardado en phase.color) a clases Tailwind
// literales (no se pueden construir nombres de clase dinámicamente con JIT).
// Nunca comunicar la fase solo por color: siempre acompañar con la etiqueta de texto.

export interface PhaseColorClasses {
  bg: string; // fondo sólido (bandas, chips)
  text: string; // texto sobre fondo claro
  border: string;
  bgSoft: string; // fondo suave (fichas, cajas)
  dot: string; // clase de fondo para puntitos/leyenda
}

const MAP: Record<string, PhaseColorClasses> = {
  salvia: {
    bg: 'bg-salvia',
    text: 'text-salvia-osc',
    border: 'border-salvia',
    bgSoft: 'bg-salvia-bg',
    dot: 'bg-salvia',
  },
  azul: {
    bg: 'bg-azul',
    text: 'text-azul',
    border: 'border-azul',
    bgSoft: 'bg-azul-bg',
    dot: 'bg-azul',
  },
  terra: {
    bg: 'bg-terra',
    text: 'text-terra-osc',
    border: 'border-terra',
    bgSoft: 'bg-terra-bg',
    dot: 'bg-terra',
  },
  neutro: {
    bg: 'bg-neutro',
    text: 'text-tinta-suave',
    border: 'border-neutro',
    bgSoft: 'bg-neutro-bg',
    dot: 'bg-neutro',
  },
};

const DEFAULT: PhaseColorClasses = MAP.neutro;

export function phaseClasses(color: string): PhaseColorClasses {
  return MAP[color] ?? DEFAULT;
}
