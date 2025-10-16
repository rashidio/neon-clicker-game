import React from 'react';
import { Check, Timer } from 'lucide-react';
import {
  DonationGoal,
  DonationGoalDetail,
  DonationConfirmState,
  DonationPercent,
} from '../types';

export interface DonationItemProps {
  goal: DonationGoal;
  selected: boolean;
  detailLoading: boolean;
  detail: DonationGoalDetail | undefined;
  onToggleTopDonors: (goalId: number, next: boolean) => void;
  onRequestDetail: (goalId: number) => void;
  confirm: DonationConfirmState | null;
  submitting: DonationConfirmState | null;
  success: DonationConfirmState | null;
  setConfirm: (c: DonationConfirmState | null) => void;
  onDonate: (goalId: number, percent: DonationPercent) => void;
  score: number;
  formatCompact: (n: number) => string;
  formatPercent: (p: number) => string;
}

const DonationItem: React.FC<DonationItemProps> = ({
  goal,
  selected,
  detailLoading,
  detail,
  onToggleTopDonors,
  onRequestDetail,
  confirm,
  submitting,
  success,
  setConfirm,
  onDonate,
  score,
  formatCompact,
  formatPercent,
}) => {
  const rawPercent = Number(goal.percent || 0);
  const percentBar = Math.max(0, Math.min(100, rawPercent));
  const percentLabel = formatPercent(rawPercent);

  const renderDonateBtn = (
    p: DonationPercent,
    color: string,
    border: string,
    text: string
  ) => {
    const isConfirm = !!(confirm && confirm.goalId === goal.id && confirm.percent === p);
    const isSubmitting = !!(submitting && submitting.goalId === goal.id && submitting.percent === p);
    const isSuccess = !!(success && success.goalId === goal.id && success.percent === p);
    const baseClasses = `${isConfirm ? 'w-full' : ''} py-2 text-xs rounded-xl font-light tracking-widest border ${border} flex items-center justify-center gap-2`;
    const confirmedClasses = 'bg-green-500/20 border border-green-400/40 text-green-400';
    const normalClasses = `${color}`;
    const donateAmount = Math.floor((score * p) / 100);
    const disabled = donateAmount <= 0 || !!isSubmitting;
    return (
      <button
        key={p}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (isConfirm) {
            onDonate(goal.id, p);
          } else {
            setConfirm({ goalId: goal.id, percent: p });
            setTimeout(() => {
              setConfirm(prev => (prev && prev.goalId === goal.id && prev.percent === p ? null : prev));
            }, 2500);
          }
        }}
        className={`${baseClasses} ${disabled && !isConfirm ? 'opacity-40 cursor-not-allowed bg-white/5 text-gray-500 border-white/10' : (isConfirm ? confirmedClasses : normalClasses)}`}
      >
        {isConfirm ? (
          isSubmitting ? (
            <>Donating...</>
          ) : isSuccess ? (
            <>
              <Check className="w-4 h-4" />
              Donated!
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Donate {formatCompact(donateAmount)}?
            </>
          )
        ) : (
          text
        )}
      </button>
    );
  };

  return (
    <div className="bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-cyan-500/30 transition-all duration-300">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm text-white font-light">{goal.name}</div>
          <div className="text-xs text-gray-500">Target {formatCompact(goal.target)}</div>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-2">
            <div className="text-xl font-extralight text-cyan-400">{percentLabel}</div>
            {rawPercent >= 100 && (
              <span className="px-2 py-0.5 rounded bg-green-500/20 border border-green-400/30 text-green-400 text-[10px] uppercase tracking-widest">done!</span>
            )}
          </div>
          <div className="text-xs text-gray-500">{formatCompact(goal.total_donated || 0)}</div>
        </div>
      </div>
      <div className="relative w-full h-2 bg-white/10 rounded-full overflow-hidden mb-4">
        <div className="absolute inset-0 neon-scan"></div>
        <div className="relative h-full bg-cyan-500/60" style={{ width: `${percentBar}%` }}></div>
      </div>
      <div className={`grid ${confirm && confirm.goalId === goal.id ? 'grid-cols-1' : 'grid-cols-4'} gap-3 mb-3`}>
        {(!confirm || confirm.goalId !== goal.id || confirm.percent === 10) && renderDonateBtn(10, 'bg-cyan-500/10 border-cyan-400/30 text-cyan-400 hover:bg-cyan-500/20', 'border-cyan-400/30', '10%')}
        {(!confirm || confirm.goalId !== goal.id || confirm.percent === 25) && renderDonateBtn(25, 'bg-indigo-500/10 border-indigo-400/30 text-indigo-400 hover:bg-indigo-500/20', 'border-indigo-400/30', '25%')}
        {(!confirm || confirm.goalId !== goal.id || confirm.percent === 50) && renderDonateBtn(50, 'bg-purple-500/10 border-purple-400/30 text-purple-400 hover:bg-purple-500/20', 'border-purple-400/30', '50%')}
        {(!confirm || confirm.goalId !== goal.id || confirm.percent === 100) && renderDonateBtn(100, 'bg-pink-500/10 border-pink-400/30 text-pink-400 hover:bg-pink-500/20', 'border-pink-400/30', '100%')}
      </div>
      <div className="flex items-center justify-end">
        <button
          className="text-[11px] px-2 py-1 rounded border border-white/10 text-gray-400 hover:text-gray-200 hover:border-white/20"
          onClick={() => {
            const next = !selected;
            onToggleTopDonors(goal.id, next);
            if (next) {
              onRequestDetail(goal.id);
            }
          }}
        >
          {selected ? 'Hide top donors' : 'Show top donors'}
        </button>
      </div>
      {selected && (
        <div className="mt-3 space-y-2">
          {detailLoading && (
            <div className="text-xs text-gray-500">Loading...</div>
          )}
          {!detailLoading && detail && (
            <>
              {(detail.top_donors || []).length === 0 && (
                <div className="text-xs text-gray-400 italic">No donors yet.</div>
              )}
              {(detail.top_donors || []).slice(0, 5).map((d, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-sm border border-white/10 rounded-xl p-3 ${i === 0 ? 'border-yellow-400/30' : 'hover:border-cyan-500/30'} transition-all`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-light ${i === 0 ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/30' : 'bg-white/5 text-gray-400 border border-white/10'}`}>{i + 1}</div>
                    <div className="font-light text-gray-300">{d.user_id}</div>
                  </div>
                  <div className="text-cyan-400">{Number(d.amount).toLocaleString()}</div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DonationItem;
