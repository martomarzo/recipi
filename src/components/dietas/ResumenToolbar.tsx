'use client';

// Barra de acciones de la vista general (§6 SPECS.md): exportar PDF server-side
// o imprimir con el CSS de la propia página. Único componente cliente de la
// ruta /dietas/[id]/resumen — el resto es un server component estático.
import { useState } from 'react';

export default function ResumenToolbar({ dietId }: { dietId: string }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onExportarPdf() {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch(`/api/dietas/${dietId}/pdf`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError((data && typeof data.error === 'string' && data.error) || 'No se pudo generar el PDF.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'recipi-resumen.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('No se pudo generar el PDF.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="no-print mb-6 flex flex-col items-center gap-2">
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onExportarPdf}
          disabled={exporting}
          className="btn-primario disabled:opacity-60"
        >
          {exporting ? 'Generando PDF…' : '⬇ Exportar PDF'}
        </button>
        <button type="button" onClick={() => window.print()} className="btn">
          🖨 Imprimir
        </button>
      </div>
      {error && (
        <p className="max-w-[420px] text-center text-[13px] text-mal">
          {error} — probá el botón &quot;Imprimir&quot;.
        </p>
      )}
    </div>
  );
}
