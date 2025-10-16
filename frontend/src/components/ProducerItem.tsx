import React from 'react';
import { Clock, Timer } from 'lucide-react';

export type Producer = {
  id: number | string;
  name: string;
  emoji: string;
  rate: number;
  owned: number;
  cost: number;
  build_time: number;
  build_time_left: number;
  is_building: boolean;
};

export interface ProducerItemProps {
  producer: any;
  score: number;
  onBuy: (producer: any) => void;
  formatTime: (seconds: number) => string;
  compact?: boolean;
}

const ProducerItem: React.FC<ProducerItemProps> = ({ producer, score, onBuy, formatTime, compact = false }) => {
  const cost = producer.cost;
  const disabled = score < cost || producer.is_building;

  if (compact) {
    return (
      <div
        className="bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:border-cyan-500/30 transition-all duration-300"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className={`text-3xl ${producer.owned > 0 ? '' : 'grayscale opacity-60'}`}
              style={
                producer.owned === 0
                  ? {
                      filter:
                        'grayscale(100%) brightness(0.8) drop-shadow(0 0 8px rgba(6,182,212,0.4)) drop-shadow(0 0 16px rgba(6,182,212,0.2))',
                      color: '#06b6d4',
                    }
                  : {}
              }
            >
              {producer.emoji}
            </div>
            <div>
              <div className="text-sm font-light text-white">{producer.name}</div>
              <div className="text-xs text-gray-500 flex items-center gap-2">
                +{producer.rate}/sec
                {producer.build_time > 0 && (
                  <span className="flex items-center gap-1 text-gray-400">
                    <Timer className="w-3 h-3" />
                    {formatTime(producer.build_time)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-light text-cyan-400">{producer.owned}</div>
            <div className="text-xs text-gray-500">owned</div>
          </div>
        </div>

        <button
          onClick={() => onBuy(producer)}
          disabled={disabled}
          className={`w-full py-2 rounded-xl text-xs font-light tracking-widest transition-all flex items-center justify-center gap-2 ${
            !disabled
              ? 'bg-cyan-500/20 border border-cyan-400/30 text-cyan-400 hover:bg-cyan-500/30'
              : producer.is_building
              ? 'bg-yellow-500/20 border border-yellow-400/30 text-yellow-400 cursor-not-allowed'
              : 'bg-white/5 border border-white/10 text-gray-600 cursor-not-allowed'
          }`}
        >
          {producer.is_building ? (
            <>
              <Clock className="w-3 h-3 animate-pulse" />
              BUILDING... {formatTime(producer.build_time_left)}
            </>
          ) : (
            `BUY - ${cost.toLocaleString()}`
          )}
        </button>
      </div>
    );
  }

  return (
    <div
      className="bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-cyan-500/30 transition-all duration-300"
    >
      <div className="flex items-start gap-4 mb-4">
        <div
          className={`text-5xl ${producer.owned > 0 ? '' : 'grayscale opacity-60'}`}
          style={
            producer.owned === 0
              ? {
                  filter:
                    'grayscale(100%) brightness(0.8) drop-shadow(0 0 12px rgba(6,182,212,0.5)) drop-shadow(0 0 24px rgba(6,182,212,0.3))',
                  color: '#06b6d4',
                }
              : {}
          }
        >
          {producer.emoji}
        </div>
        <div className="flex-1">
          <div className="text-lg font-light text-white mb-1">{producer.name}</div>
          <div className="text-sm text-gray-400 flex items-center gap-2">
            +{producer.rate} per second
            {producer.build_time > 0 && (
              <span className="flex items-center gap-1 text-gray-500">
                <Timer className="w-3 h-3" />
                {formatTime(producer.build_time)}
              </span>
            )}
          </div>
        </div>
      </div>

      {producer.owned > 0 && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs text-gray-500">Owned</div>
            <div className="text-2xl font-mono font-extralight text-cyan-400">{producer.owned}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Total Production</div>
            <div className="text-2xl font-mono font-extralight text-purple-400">
              {(producer.rate * producer.owned).toLocaleString()}/s
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => onBuy(producer)}
        disabled={disabled}
        className={`w-full py-3 rounded-xl font-light text-sm tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${
          !disabled
            ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-400/30 hover:border-cyan-400/50 text-cyan-400'
            : producer.is_building
            ? 'bg-yellow-500/20 border border-yellow-400/30 text-yellow-400 cursor-not-allowed'
            : 'bg-white/5 border border-white/10 text-gray-600 cursor-not-allowed'
        }`}
      >
        {producer.is_building ? (
          <>
            <Clock className="w-4 h-4 animate-pulse" />
            BUILDING... {formatTime(producer.build_time_left)}
          </>
        ) : (
          `BUY - ${cost.toLocaleString()}`
        )}
      </button>
    </div>
  );
};

export default ProducerItem;
