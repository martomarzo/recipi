'use client';

import StepTimer from './StepTimer';
import { extractTimers } from '@/lib/timeParser';

interface StepListProps {
  /** Pasos de preparación, ya separados de Dish.recipeMd (una línea = un paso). */
  steps: string[];
}

export default function StepList({ steps }: StepListProps) {
  return (
    <ol className="space-y-5">
      {steps.map((step, i) => {
        const timers = extractTimers(step);
        return (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-terra-bg text-sm font-bold text-terra-osc">
              {i + 1}
            </span>
            <div className="flex-1 pt-1">
              <p className="leading-relaxed text-tinta">{step}</p>
              {timers.map((timer, ti) => (
                <StepTimer key={ti} label={timer.label} initialSeconds={timer.seconds} />
              ))}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
