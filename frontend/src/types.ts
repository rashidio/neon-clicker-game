// Shared domain types

export type ID = number | string;

export interface Producer {
  id: ID;
  name: string;
  emoji: string;
  rate: number; // production per second per unit
  owned: number;
  cost: number; // next purchase cost
  build_time: number; // seconds for next build (if any)
  build_time_left: number; // seconds left for current build
  is_building: boolean;
}

export interface PowerInfo {
  power: number;
  price?: number;
  score?: number;
  build_time: number;
  is_building: boolean;
  build_time_left: number;
}

export interface LeaderboardEntryBase {
  user_id: string;
  is_self?: boolean;
}

export interface LeaderboardEntryRichest extends LeaderboardEntryBase {
  score: number;
}

export interface LeaderboardEntryPerSecond extends LeaderboardEntryBase {
  production_rate: number;
}

export interface LeaderboardEntryClicks extends LeaderboardEntryBase {
  clicks: number;
}

export interface DonationGoal {
  id: number;
  name: string;
  target: number;
  total_donated?: number;
  percent?: number; // 0..100+
}

export interface DonationTopDonor {
  user_id: string;
  amount: number;
  is_self?: boolean;
}

export interface DonationGoalDetail {
  top_donors?: DonationTopDonor[];
}

export type DonationPercent = 10 | 25 | 50 | 100;

export interface DonationConfirmState {
  goalId: number;
  percent: DonationPercent;
}
