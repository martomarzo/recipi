// Export a PDF server-side de la vista de resumen (§6 SPECS.md).
// No se instala Chromium propio (más liviano para self-hosting): se busca un
// binario ya presente en la imagen/host. Si no hay ninguno, el caller (route
// handler) debe devolver 501 y la UI cae a window.print() como alternativa.

import { existsSync } from 'fs';

const CANDIDATE_PATHS = [
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/snap/bin/chromium',
];

/** Busca un ejecutable de Chromium/Chrome disponible en el servidor, o null si no hay ninguno. */
export function findChromiumExecutable(): string | null {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  for (const path of CANDIDATE_PATHS) {
    if (existsSync(path)) return path;
  }
  return null;
}

export class ChromiumNotFoundError extends Error {
  constructor() {
    super('No se encontró un ejecutable de Chromium en el servidor.');
    this.name = 'ChromiumNotFoundError';
  }
}

/**
 * Renderiza `url` a PDF (A4, con fondos) usando Chromium headless.
 * Reenvía la cookie de sesión del pedido original (header Cookie) para que
 * la página server-rendered pase el chequeo de auth del middleware.
 * Cierra el browser siempre, incluso si el render falla.
 */
export async function renderUrlToPdf(url: string, cookieHeader: string | null): Promise<Buffer> {
  const executablePath = findChromiumExecutable();
  if (!executablePath) throw new ChromiumNotFoundError();

  const puppeteer = await import('puppeteer-core');
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const page = await browser.newPage();
    if (cookieHeader) {
      // Header simple en vez de browser.setCookie: no requiere parsear
      // nombre/valor/dominio y alcanza para que el middleware vea la sesión.
      await page.setExtraHTTPHeaders({ Cookie: cookieHeader });
    }
    await page.goto(url, { waitUntil: 'networkidle0' });
    const pdfBytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
    });
    return Buffer.from(pdfBytes);
  } finally {
    if (browser) await browser.close();
  }
}
