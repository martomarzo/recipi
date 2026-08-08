const TIME_REGEX =
  /(\d+(?:\.\d+)?)\s*(hour|hr|h|minute|min|second|sec)s?(?:\s+(?:and\s+)?(\d+(?:\.\d+)?)\s*(minute|min|second|sec)s?)?/gi;

function unitToSeconds(value: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u === 'hour' || u === 'hr' || u === 'h') return value * 3600;
  if (u === 'minute' || u === 'min') return value * 60;
  return value; // seconds
}

export function extractTimers(text: string): { label: string; seconds: number }[] {
  const timers: { label: string; seconds: number }[] = [];
  const regex = new RegExp(TIME_REGEX.source, 'gi');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const val1 = parseFloat(match[1]);
    const unit1 = match[2];
    let total = unitToSeconds(val1, unit1);

    if (match[3] && match[4]) {
      const val2 = parseFloat(match[3]);
      total += unitToSeconds(val2, match[4]);
    }

    if (total > 0) {
      timers.push({ label: match[0].trim(), seconds: total });
    }
  }

  return timers;
}

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
