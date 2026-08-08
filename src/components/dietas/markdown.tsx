// Render mínimo de markdown para notas de fase/reglas (**negrita**, líneas "- item").
// No se usa ninguna librería externa: el formato en la DB es siempre simple
// (ver Apéndice A del spec y prisma/seed.mjs).
import { Fragment, ReactNode } from 'react';

function renderInline(text: string, key: number): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((p) => p !== '');
  return (
    <Fragment key={key}>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </Fragment>
  );
}

export function MiniMarkdown({ text, className }: { text: string; className?: string }) {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const blocks: Array<{ type: 'ul'; items: string[] } | { type: 'p'; text: string }> = [];
  for (const line of lines) {
    const isItem = line.startsWith('- ');
    const content = isItem ? line.slice(2) : line;
    const last = blocks[blocks.length - 1];
    if (isItem && last && last.type === 'ul') {
      last.items.push(content);
    } else if (isItem) {
      blocks.push({ type: 'ul', items: [content] });
    } else {
      blocks.push({ type: 'p', text: content });
    }
  }
  return (
    <div className={className}>
      {blocks.map((b, i) =>
        b.type === 'ul' ? (
          <ul key={i} className="ml-[18px] list-disc space-y-1">
            {b.items.map((item, j) => (
              <li key={j}>{renderInline(item, j)}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{renderInline(b.text, i)}</p>
        )
      )}
    </div>
  );
}
