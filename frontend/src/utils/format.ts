export const formatTime = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours < 10) {
      return `${hours}:${minutes.toString().padStart(2, '0')}h`;
    } else {
      return `${hours}h ${minutes}m`;
    }
  }
};

export const formatCompact = (n: number | bigint): string => {
  const num = typeof n === 'bigint' ? Number(n) : (n ?? 0);
  const abs = Math.abs(num);
  if (abs >= 1_000_000_000_000) return `${Math.round(num / 1_000_000_000_000)}T`;
  if (abs >= 1_000_000_000) return `${Math.round(num / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${Math.round(num / 1_000_000)}M`;
  if (abs >= 1_000) return `${Math.round(num / 1_000)}K`;
  return num.toLocaleString();
};

export const formatPercent = (p: number): string => {
  if (!isFinite(p) || p <= 0) return '0%';
  if (p >= 1) {
    const val = p % 1 === 0 ? p.toFixed(0) : p.toFixed(2);
    return `${val}%`;
  }
  const minShown = 0.00001;
  if (p > 0 && p < minShown) return `${minShown}%`;
  const fixed = p.toFixed(5);
  return `${fixed.replace(/0+$/, '').replace(/\.$/, '')}%`;
};
