'use client';

import { useTimer } from '@/hooks/useTimer';
import { formatTime } from '@/lib/timeParser';

interface StepTimerProps {
  label: string;
  initialSeconds: number;
}

export default function StepTimer({ label, initialSeconds }: StepTimerProps) {
  const { status, remaining, initial, start, pause, reset } = useTimer(initialSeconds);

  const progress = initial > 0 ? (remaining / initial) * 100 : 0;
  const isDone = status === 'done';
  const isRunning = status === 'running';

  return (
    <div
      className={`mt-3 rounded-xl border p-3 ${
        isDone ? 'border-salvia bg-salvia-bg' : 'border-terra bg-terra-bg'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-tinta-suave">{label}</p>
          <p
            className={`font-mono text-2xl font-bold tabular-nums ${
              isDone ? 'text-salvia-osc' : 'text-terra-osc'
            }`}
          >
            {isDone ? '¡Listo!' : formatTime(remaining)}
          </p>
          <div className="mt-1 h-1.5 w-full rounded-full bg-white/70">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                isDone ? 'bg-salvia' : 'bg-terra'
              }`}
              style={{ width: `${isDone ? 100 : progress}%` }}
            />
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          {!isDone && (
            <button
              onClick={isRunning ? pause : start}
              className="min-h-[38px] rounded-full bg-tinta px-3 py-1.5 text-sm font-semibold text-crema transition-colors hover:bg-tinta/90"
            >
              {isRunning ? 'Pausar' : status === 'paused' ? 'Seguir' : 'Iniciar'}
            </button>
          )}
          <button
            onClick={reset}
            className="min-h-[38px] rounded-full border border-linea bg-white px-3 py-1.5 text-sm font-medium text-tinta-suave transition-colors hover:border-tinta-suave"
          >
            Reiniciar
          </button>
        </div>
      </div>
    </div>
  );
}
