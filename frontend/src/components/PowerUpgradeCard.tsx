import React from 'react';
import { Clock, Timer } from 'lucide-react';
import { PowerInfo } from '../types';

export interface PowerUpgradeCardProps {
  powerInfo: PowerInfo;
  score: number;
  onUpgrade: () => void;
  formatTime: (seconds: number) => string;
}

const PowerUpgradeCard: React.FC<PowerUpgradeCardProps> = ({ powerInfo, score, onUpgrade, formatTime }) => {
  const canAfford = score >= (powerInfo.price ?? 0);
  const disabled = !canAfford || powerInfo.is_building;

  return (
    <div className="bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-cyan-500/30 transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs font-light tracking-widest text-gray-500 mb-1">CLICK POWER</div>
          <div className="text-3xl font-extralight text-cyan-400 flex items-center gap-3">
            {powerInfo.power}
            {powerInfo.build_time > 0 && (
              <span className="text-sm text-gray-400 flex items-center gap-1">
                <Timer className="w-4 h-4" />
                {formatTime(powerInfo.build_time)}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-light tracking-widest text-gray-500 mb-1">COST</div>
          <div className="text-xl font-extralight text-purple-400">{(powerInfo.price ?? 0).toLocaleString()}</div>
        </div>
      </div>

      <button
        onClick={onUpgrade}
        disabled={disabled}
        className={`w-full py-3 rounded-xl font-light text-sm tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${
          canAfford && !powerInfo.is_building
            ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-400/30 hover:border-cyan-400/50 text-cyan-400 hover:scale-105 active:scale-95'
            : powerInfo.is_building
            ? 'bg-yellow-500/20 border border-yellow-400/30 text-yellow-400 cursor-not-allowed'
            : 'bg-white/5 border border-white/10 text-gray-600 cursor-not-allowed'
        }`}
      >
        {powerInfo.is_building ? (
          <>
            <Clock className="w-4 h-4 animate-pulse" />
            BUILDING... {formatTime(powerInfo.build_time_left)}
          </>
        ) : canAfford ? (
          'UPGRADE'
        ) : (
          'INSUFFICIENT'
        )}
      </button>
    </div>
  );
};

export default PowerUpgradeCard;
