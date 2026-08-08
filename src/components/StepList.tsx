'use client';

import StepTimer from './StepTimer';
import { extractTimers } from '@/lib/timeParser';

interface Step {
  id: number;
  position: number;
  text: string;
}

interface StepListProps {
  steps: Step[];
}

export default function StepList({ steps }: StepListProps) {
  return (
    <ol className="space-y-6">
      {steps.map((step) => {
        const timers = extractTimers(step.text);
        return (
          <li key={step.id} className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">
              {step.position}
            </span>
            <div className="flex-1 pt-1">
              <p className="text-gray-800 leading-relaxed">{step.text}</p>
              {timers.map((timer, i) => (
                <StepTimer key={i} label={timer.label} initialSeconds={timer.seconds} />
              ))}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
