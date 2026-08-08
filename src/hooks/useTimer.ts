'use client';

import { useReducer, useEffect, useRef } from 'react';

type Status = 'idle' | 'running' | 'paused' | 'done';

interface State {
  status: Status;
  remaining: number;
  initial: number;
}

type Action =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESET' }
  | { type: 'TICK' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'START':
      if (state.remaining === 0) return state;
      return { ...state, status: 'running' };
    case 'PAUSE':
      return { ...state, status: 'paused' };
    case 'RESET':
      return { status: 'idle', remaining: state.initial, initial: state.initial };
    case 'TICK':
      if (state.status !== 'running') return state;
      const next = state.remaining - 1;
      return { ...state, remaining: next, status: next <= 0 ? 'done' : 'running' };
    default:
      return state;
  }
}

export function useTimer(initialSeconds: number) {
  const [state, dispatch] = useReducer(reducer, {
    status: 'idle',
    remaining: initialSeconds,
    initial: initialSeconds,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state.status === 'running') {
      intervalRef.current = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.status]);

  return {
    status: state.status,
    remaining: state.remaining,
    initial: state.initial,
    start: () => dispatch({ type: 'START' }),
    pause: () => dispatch({ type: 'PAUSE' }),
    reset: () => dispatch({ type: 'RESET' }),
  };
}
