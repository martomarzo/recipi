import Anthropic from "@anthropic-ai/sdk";
import { createWithConfiguredModel } from "./anthropicModel";

// Estimación de macros con Claude para ingredientes que no están en el
// catálogo (import de recetas). Usa el mismo modelo económico que el parser
// de recetas (ANTHROPIC_MODEL, default claude-haiku-4-5): una llamada estima
// todos los ingredientes de una receta por una fracción de centavo.

export interface EstimatedIngredient {
  /** Nombre tal como vino en la request (para mapear en el cliente). */
  input: string;
  name: string;
  categoryKey: string;
  emoji: string | null;
  kcal100: number;
  protein100: number;
  carbs100: number;
  fat100: number;
}

const SYSTEM_PROMPT = `Sos un nutricionista que estima valores nutricionales aproximados de ingredientes de cocina.
Para cada ingrediente de la lista devolvé sus valores por 100 g (crudo / como se compra, salvo que el nombre indique otra preparación) y una categoría del catálogo dado.
Respondé únicamente con un array JSON (sin markdown ni texto extra), un objeto por ingrediente de entrada y en el mismo orden:
[{ "name": "nombre limpio en español (solo el ingrediente, sin cantidades ni preparación)", "categoryKey": "una de las claves dadas", "emoji": "un emoji representativo", "kcal100": 0, "protein100": 0, "carbs100": 0, "fat100": 0 }]
Los números son aproximados y razonables: kcal100 entre 0 y 900; proteínas, hidratos y grasas en gramos por 100 g.`;

function clampMacro(value: unknown, max: number): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(Math.round(n * 10) / 10, max);
}

export async function estimateIngredients(
  names: string[],
  categoryKeys: string[]
): Promise<EstimatedIngredient[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await createWithConfiguredModel(client, {
    max_tokens: 4096,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `Claves de categoría disponibles: ${categoryKeys.join(", ")}\n\nIngredientes:\n${names
          .map((n, i) => `${i + 1}. ${n}`)
          .join("\n")}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude no devolvió texto");
  }

  const raw = textBlock.text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error("Respuesta de Claude inválida (no es un array)");

  // Emparejamos por índice (mismo orden que la entrada); entradas inválidas se descartan.
  const out: EstimatedIngredient[] = [];
  for (let i = 0; i < names.length && i < parsed.length; i++) {
    const e = parsed[i] as Record<string, unknown> | null;
    if (!e || typeof e !== "object") continue;
    const kcal100 = clampMacro(e.kcal100, 900);
    const protein100 = clampMacro(e.protein100, 100);
    const carbs100 = clampMacro(e.carbs100, 100);
    const fat100 = clampMacro(e.fat100, 100);
    if (kcal100 === null || protein100 === null || carbs100 === null || fat100 === null) continue;
    out.push({
      input: names[i],
      name: typeof e.name === "string" && e.name.trim() ? e.name.trim() : names[i],
      categoryKey: typeof e.categoryKey === "string" ? e.categoryKey : "",
      emoji: typeof e.emoji === "string" && e.emoji.trim() ? e.emoji.trim() : null,
      kcal100,
      protein100,
      carbs100,
      fat100,
    });
  }
  return out;
}
