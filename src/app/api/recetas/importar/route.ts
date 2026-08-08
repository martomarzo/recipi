import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { extractSchemaOrgRecipe } from "@/lib/recetas/schemaOrg";
import { stripHtmlToText } from "@/lib/recetas/html";
import { parseRecipe } from "@/lib/recetas/parser";
import { buildDraft } from "@/lib/recetas/importDraft";
import type { ParsedRecipe } from "@/lib/recetas/types";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 2 * 1024 * 1024; // ~2 MB

async function fetchTextLimited(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!res.ok) throw new Error(`El sitio respondió con estado ${res.status}`);

    const reader = res.body?.getReader();
    if (!reader) return (await res.text()).slice(0, MAX_BYTES);

    const decoder = new TextDecoder();
    let received = 0;
    let out = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      out += decoder.decode(value, { stream: true });
      if (received >= MAX_BYTES) {
        await reader.cancel().catch(() => {});
        break;
      }
    }
    return out;
  } finally {
    clearTimeout(timeout);
  }
}

async function parseText(rawText: string): Promise<{ parsed: ParsedRecipe; parsedWith: "claude" | "regex" }> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { parseWithClaude } = await import("@/lib/recetas/claudeParser");
      const parsed = await parseWithClaude(rawText);
      return { parsed, parsedWith: "claude" };
    } catch (err) {
      console.warn("Parseo con Claude falló, uso el parser por regex:", err);
    }
  }
  return { parsed: parseRecipe(rawText), parsedWith: "regex" };
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  if (!url && !text) {
    return NextResponse.json({ error: "Pegá un link o el texto de la receta." }, { status: 400 });
  }

  try {
    if (url) {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        return NextResponse.json({ error: "El link no es una URL válida." }, { status: 400 });
      }
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return NextResponse.json({ error: "Solo se admiten links http/https." }, { status: 400 });
      }

      const html = await fetchTextLimited(parsedUrl.toString());

      const jsonLd = extractSchemaOrgRecipe(html);
      if (jsonLd) {
        const draft = buildDraft(jsonLd, {
          sourceUrl: parsedUrl.toString(),
          rawText: stripHtmlToText(html).slice(0, 20_000),
          parsedWith: "jsonld",
        });
        return NextResponse.json({ draft });
      }

      const plainText = stripHtmlToText(html);
      const { parsed, parsedWith } = await parseText(plainText);
      const draft = buildDraft(parsed, {
        sourceUrl: parsedUrl.toString(),
        rawText: plainText.slice(0, 20_000),
        parsedWith,
      });
      return NextResponse.json({ draft });
    }

    const { parsed, parsedWith } = await parseText(text);
    const draft = buildDraft(parsed, { rawText: text, parsedWith });
    return NextResponse.json({ draft });
  } catch (err) {
    console.error("Error al importar receta:", err);
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "El sitio tardó demasiado en responder (10 s)."
        : "No se pudo importar la receta.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
