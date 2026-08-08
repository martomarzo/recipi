'use client';

import { useState } from 'react';

interface StarRatingProps {
  recipeId: string;
  avgRating: number | null;
  ratingCount: number;
  onRated?: (avg: number | null, count: number) => void;
}

export default function StarRating({ recipeId, avgRating, ratingCount, onRated }: StarRatingProps) {
  const [hovered, setHovered] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [currentAvg, setCurrentAvg] = useState(avgRating);
  const [currentCount, setCurrentCount] = useState(ratingCount);
  const [loading, setLoading] = useState(false);

  async function handleRate(stars: number) {
    if (submitted || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId, stars }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentAvg(data.avgRating);
        setCurrentCount(data.ratingCount);
        setSubmitted(true);
        onRated?.(data.avgRating, data.ratingCount);
      }
    } finally {
      setLoading(false);
    }
  }

  const displayRating = currentAvg ?? 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = submitted ? star <= Math.round(displayRating) : star <= hovered;
          return (
            <button
              key={star}
              disabled={submitted || loading}
              onMouseEnter={() => !submitted && setHovered(star)}
              onMouseLeave={() => !submitted && setHovered(0)}
              onClick={() => handleRate(star)}
              className={`text-2xl transition-colors ${
                submitted ? 'cursor-default' : 'cursor-pointer hover:scale-110'
              } ${filled ? 'text-amber-400' : 'text-gray-300'}`}
            >
              ★
            </button>
          );
        })}
        {currentCount > 0 && (
          <span className="text-sm text-gray-500 ml-1">
            {displayRating.toFixed(1)} ({currentCount} {currentCount === 1 ? 'rating' : 'ratings'})
          </span>
        )}
      </div>
      {submitted && (
        <p className="text-sm text-green-600 font-medium">Thanks for rating!</p>
      )}
      {!submitted && !loading && (
        <p className="text-xs text-gray-400">Click to rate this recipe</p>
      )}
    </div>
  );
}
