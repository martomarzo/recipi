import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

// Sirve las imágenes subidas desde el directorio de datos (data/uploads o
// UPLOADS_DIR). No van en public/ porque next start no sirve archivos
// agregados después del build.

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
};

export async function GET(_req: NextRequest, { params }: { params: { name: string } }) {
  const name = path.basename(params.name); // bloquea traversal
  const ext = path.extname(name).toLowerCase();
  const mime = MIME[ext];
  if (!mime) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const dir = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "data", "uploads");
  try {
    const buf = await readFile(path.join(dir, name));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
}
