import React from 'react';

export type LeaderboardMode = 'richest' | 'per_second' | 'clicks';

interface LeaderboardTabsProps {
  mode: LeaderboardMode;
  onChange: (mode: LeaderboardMode) => void;
}

const LeaderboardTabs: React.FC<LeaderboardTabsProps> = ({ mode, onChange }) => {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      <button
        className={`px-3 py-1 rounded text-xs transition-all duration-200 ${
          mode === 'richest'
            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-400/30'
            : 'text-gray-500 hover:text-gray-400'
        }`}
        onClick={() => {
          if (mode !== 'richest') onChange('richest');
        }}
      >
        RICHEST
      </button>
      <button
        className={`px-3 py-1 rounded text-xs transition-all duration-200 ${
          mode === 'per_second'
            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-400/30'
            : 'text-gray-500 hover:text-gray-400'
        }`}
        onClick={() => {
          if (mode !== 'per_second') onChange('per_second');
        }}
      >
        PER SECOND
      </button>
      <button
        className={`px-3 py-1 rounded text-xs transition-all duration-200 ${
          mode === 'clicks'
            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-400/30'
            : 'text-gray-500 hover:text-gray-400'
        }`}
        onClick={() => {
          if (mode !== 'clicks') onChange('clicks');
        }}
      >
        CLICKS
      </button>
    </div>
  );
};

export default LeaderboardTabs;
