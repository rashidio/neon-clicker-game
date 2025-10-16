import React from 'react';
import { Zap, ShoppingCart, Trophy } from 'lucide-react';

export type TabId = 'game' | 'shop' | 'donations' | 'leaderboard';

interface TabsBarProps {
  activeTab: TabId;
  onSelect: (tab: TabId) => void;
}

const tabs: Array<{ id: TabId; label: string; icon?: React.ComponentType<any> }> = [
  { id: 'game', label: 'TAP', icon: Zap },
  { id: 'shop', label: 'PRODUCE', icon: ShoppingCart },
  { id: 'donations', label: 'DONATE', icon: Trophy },
  { id: 'leaderboard', label: 'RANKS' },
];

const TabsBar: React.FC<TabsBarProps> = ({ activeTab, onSelect }) => {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 mt-6 sm:mt-8 mb-4 sm:mb-6">
      <div className="flex justify-center sm:justify-start gap-5 sm:gap-8 border-b border-white/10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={`pb-2 sm:pb-3 text-xs sm:text-sm font-light tracking-normal sm:tracking-wide transition-all relative flex items-center gap-2 sm:gap-2 ${
              activeTab === tab.id ? 'text-cyan-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.id === 'leaderboard' ? (
              <span className="relative inline-flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]"></span>
                {tab.label}
              </span>
            ) : (
              <>
                {tab.icon && <tab.icon className="w-4 h-4" strokeWidth={1.5} />}
                {tab.label}
              </>
            )}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent"></div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TabsBar;
