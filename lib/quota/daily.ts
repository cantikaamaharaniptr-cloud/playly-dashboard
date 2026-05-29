// Daily upload quota helper — phase Penyimpanan-User (2026-05-29).
//
// Source of truth tunggal untuk batas upload harian per tier.
// Free = 2 GB/hari, Premium = 10 GB/hari. Reset 00:00 UTC.

import type { SupabaseClient } from '@supabase/supabase-js';

export const DAILY_QUOTA_BYTES = {
  free: 2 * 1024 * 1024 * 1024,    // 2 GB
  premium: 10 * 1024 * 1024 * 1024, // 10 GB
} as const;

export type Tier = keyof typeof DAILY_QUOTA_BYTES;

export function quotaForTier(tier: string | null | undefined): number {
  return tier === 'premium' ? DAILY_QUOTA_BYTES.premium : DAILY_QUOTA_BYTES.free;
}

export function startOfTodayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export type QuotaStatus = {
  tier: Tier;
  quotaBytes: number;
  usedBytes: number;
  remainingBytes: number;
};

// Bytes upload user hari ini (UTC) — sum dari videos.file_size_bytes.
// Pakai SSR client dengan cookie auth: RLS membatasi ke owner_id = auth.uid().
export async function getDailyQuotaStatus(
  supabase: SupabaseClient,
  userId: string,
): Promise<QuotaStatus> {
  const sinceISO = startOfTodayUTC().toISOString();

  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from('profiles').select('tier').eq('id', userId).maybeSingle(),
    supabase
      .from('videos')
      .select('file_size_bytes')
      .eq('owner_id', userId)
      .gte('created_at', sinceISO),
  ]);

  const tier: Tier = profile?.tier === 'premium' ? 'premium' : 'free';
  const quotaBytes = quotaForTier(tier);
  const usedBytes = (rows || []).reduce(
    (s, r) => s + (Number(r.file_size_bytes) || 0),
    0,
  );
  return {
    tier,
    quotaBytes,
    usedBytes,
    remainingBytes: Math.max(0, quotaBytes - usedBytes),
  };
}
