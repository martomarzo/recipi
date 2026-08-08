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
      className={`mt-3 rounded-lg border p-3 ${
        isDone
          ? 'border-green-300 bg-green-50'
          : 'border-amber-200 bg-amber-50'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500 truncate">{label}</p>
          <p
            className={`text-2xl font-mono font-bold tabular-nums ${
              isDone ? 'text-green-600' : 'text-amber-700'
            }`}
          >
            {isDone ? 'Done!' : formatTime(remaining)}
          </p>
          <div className="mt-1 h-1.5 w-full rounded-full bg-amber-200">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                isDone ? 'bg-green-500' : 'bg-amber-500'
              }`}
              style={{ width: `${isDone ? 100 : progress}%` }}
            />
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          {!isDone && (
            <button
              onClick={isRunning ? pause : start}
              className={`rounded-md px-3 py-1.5 text-sm font-medium text-white transition-colors ${
                isRunning
                  ? 'bg-amber-500 hover:bg-amber-600'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {isRunning ? 'Pause' : status === 'paused' ? 'Resume' : 'Start'}
            </button>
          )}
          <button
            onClick={reset}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
