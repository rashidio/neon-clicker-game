import React from 'react';

export type LeaderboardMode = 'richest' | 'per_second' | 'clicks';

export interface LeaderboardItemProps {
  index: number;
  entry: any;
  mode: LeaderboardMode;
}

const LeaderboardItem: React.FC<LeaderboardItemProps> = ({ index, entry, mode }) => {
  const isSelf = !!entry.is_self;

  const rankBadgeClass =
    index === 0
      ? 'bg-gradient-to-br from-yellow-400/30 to-yellow-400/10 text-yellow-400 border border-yellow-400/30'
      : index === 1
      ? 'bg-gradient-to-br from-gray-300/30 to-gray-300/10 text-gray-300 border border-gray-300/30'
      : index === 2
      ? 'bg-gradient-to-br from-orange-400/30 to-orange-400/10 text-orange-400 border border-orange-400/30'
      : 'bg-white/5 text-gray-500 border border-white/10';

  const containerClass = `flex items-center justify-between bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:border-cyan-500/30 transition-all duration-300 ${
    isSelf ? 'border-yellow-400/40 bg-yellow-400/5' : ''
  }`;

  let right;
  if (mode === 'richest') {
    right = (
      <div className="text-2xl font-extralight text-cyan-400">
        {Number(entry.score || 0).toLocaleString()}
      </div>
    );
  } else if (mode === 'per_second') {
    right = (
      <div className="text-2xl font-extralight text-green-400">
        +{Number(entry.production_rate || 0).toLocaleString()}/s
      </div>
    );
  } else {
    right = (
      <div className="text-2xl font-extralight text-purple-400">
        {Number(entry.clicks || 0).toLocaleString()}
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <div className="flex items-center gap-5">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-light ${rankBadgeClass}`}>
          {index + 1}
        </div>
        <div className={`font-light ${isSelf ? 'text-yellow-400' : 'text-gray-300'}`}>
          {isSelf ? 'You' : entry.user_id}
        </div>
      </div>
      {right}
    </div>
  );
};

export default LeaderboardItem;
