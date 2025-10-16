import React from 'react';

export interface GameHeaderStatsProps {
  totalProduction: number;
  isHighlighted: boolean;
  loading: boolean;
  prevScore: number;
  displayScore: number;
  title?: string;
}

const GameHeaderStats: React.FC<GameHeaderStatsProps> = ({
  totalProduction,
  isHighlighted,
  loading,
  prevScore,
  displayScore,
  title = 'NEON CLICKER',
}) => {
  return (
    <div className="border-b border-cyan-500/20 bg-black/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 flex items-center justify-between">
        <div>
          <div className="text-sm font-light tracking-widest text-cyan-400 mb-1">{title}</div>
          <div className="flex items-center gap-3">
            {totalProduction > 0 && (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-cyan-400 drop-shadow-[0_0_4px_rgba(6,182,212,0.8)] animate-pulse"
                    style={{
                      filter:
                        'drop-shadow(0 0 2px #06b6d4) drop-shadow(0 0 4px #06b6d4) drop-shadow(0 0 6px #06b6d4)',
                      animation: 'neon-flicker 2s ease-in-out infinite alternate',
                    }}
                  >
                    <path
                      d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
                      fill="currentColor"
                      stroke="currentColor"
                      strokeWidth="0.5"
                    />
                  </svg>
                </div>
                <div
                  className={`text-xs font-light tracking-widest transition-all duration-300 ${
                    isHighlighted
                      ? 'text-cyan-400 scale-125 font-semibold'
                      : 'text-cyan-400'
                  }`}
                  style={{ textShadow: '0 0 2px #06b6d4, 0 0 4px #06b6d4' }}
                >
                  +{totalProduction.toLocaleString()}/sec
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-2 mb-1">
            <div className="relative">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                className="text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse"
                style={{
                  filter:
                    'drop-shadow(0 0 4px #06b6d4) drop-shadow(0 0 8px #06b6d4) drop-shadow(0 0 12px #06b6d4)',
                  animation: 'neon-flicker 2s ease-in-out infinite alternate',
                }}
              >
                <path
                  d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth="0.5"
                />
              </svg>
            </div>
            <div
              className="text-xs text-cyan-400 font-light tracking-widest drop-shadow-[0_0_4px_rgba(6,182,212,0.6)]"
              style={{ textShadow: '0 0 4px #06b6d4, 0 0 8px #06b6d4' }}
            >
              NEON POWER
            </div>
          </div>
          <div className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-mono font-bold text-cyan-400 break-all">
            {loading
              ? Math.floor(prevScore).toLocaleString()
              : Math.floor(displayScore).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameHeaderStats;
