
'use client';

import React, { useState, useEffect } from 'react';

interface ConfettiPiece {
  id: number;
  style: React.CSSProperties;
}

const Confetti = ({ trigger, onComplete }: { trigger: boolean, onComplete: () => void }) => {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    if (trigger) {
      const newPieces: ConfettiPiece[] = Array.from({ length: 150 }).map((_, i) => {
        const colors = [
          '#F97316', // deep orange
          '#ef4444', // red
          '#22c55e', // green
          '#3b82f6', // blue
          '#a855f7', // purple
          '#eab308', // yellow
          '#ec4899', // pink
          '#14b8a6', // teal
        ];

        // Random drift direction
        const driftLeft = Math.random() > 0.5;

        return {
          id: i,
          style: {
            left: `${Math.random() * 100}%`,
            top: '-10%',
            animationName: driftLeft ? 'confetti-fall-left' : 'confetti-fall-right',
            animationTimingFunction: 'linear',
            animationFillMode: 'forwards',
            animationDuration: `${Math.random() * 3 + 2}s`, // 2-5s fall
            animationDelay: `${Math.random() * 2}s`,
            backgroundColor: colors[Math.floor(Math.random() * colors.length)],
            transform: `rotate(${Math.random() * 360}deg)`
          },
        }
      });
      setPieces(newPieces);

      const longestDuration = 5000;
      const timer = setTimeout(() => {
        setPieces([]);
        onComplete();
      }, longestDuration);

      return () => clearTimeout(timer);
    }
  }, [trigger, onComplete]);

  if (!trigger) return null;

  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none z-[9999] overflow-hidden">
      {pieces.map(piece => (
        <div
          key={piece.id}
          className="confetti-piece"
          style={piece.style}
        />
      ))}
    </div>
  );
};

export default Confetti;
