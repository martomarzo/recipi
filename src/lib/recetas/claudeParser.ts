import Anthropic from "@anthropic-ai/sdk";
import { createWithConfiguredModel } from "./anthropicModel";
import type { ParsedRecipe } from "./types";

const SYSTEM_PROMPT = `Sos un extractor de recetas de cocina. A partir de un texto crudo (posiblemente en español o inglés), devolvé únicamente un objeto JSON con esta forma exacta (sin markdown, sin texto extra):
{
  "name": "nombre de la receta",
  "description": "una o dos frases de descripción",
  "ingredients": [
    { "quantity": "2", "unit": "tazas", "name": "harina" },
    { "quantity": "1", "unit": null, "name": "huevo" }
  ],
  "steps": ["Precalentar el horno a 180°C durante 10 minutos.", "Mezclar los ingredientes secos en un bowl."]
}

Reglas:
- Mantené el idioma original del texto (no traduzcas).
- quantity y unit pueden ser null si no aparecen.
- Cada paso es una instrucción autocontenida.
- Incluí toda referencia a tiempos dentro del texto del paso (ej. "hornear 30 minutos"); no separes un paso solo para aislar un timer.
- description es "" si no se puede determinar del texto.`;

export async function parseWithClaude(rawText: string): Promise<ParsedRecipe> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await createWithConfiguredModel(client, {
    max_tokens: 4096,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `Extraé la receta de este texto:\n\n${rawText}` }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude no devolvió texto");
  }

  const raw = textBlock.text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const parsed = JSON.parse(raw) as {
    name: string;
    description: string;
    ingredients: { quantity: string | null; unit: string | null; name: string }[];
    steps: string[];
  };

  return {
    name: parsed.name || "Receta sin título",
    description: parsed.description || "",
    ingredients: (parsed.ingredients || []).map((i) => ({
      raw: [i.quantity, i.unit, i.name].filter(Boolean).join(" "),
      quantity: i.quantity ?? null,
      unit: i.unit ?? null,
      name: i.name,
    })),
    steps: parsed.steps || [],
  };
}
