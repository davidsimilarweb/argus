import type { CrawlerLog } from './api';

export type CheckMark = {
  timestamp: Date;
  success: boolean;
  logType: string;
  reason?: string;
};

export type DeviceHealthScore = {
  score: number; // 0-1, time-biased weighted success rate; exactly 0 when stale
  stale: boolean; // true when last check is >24h ago (or no checks at all)
  totalChecks: number;
  successCount: number;
  failureCount: number;
  checks: CheckMark[]; // chronological (oldest first), for the graph
  failureReasons: Map<string, number>; // reason -> count
  lastCheck: CrawlerLog | undefined;
  lastSuccess: CrawlerLog | undefined;
  lastAssignment: CrawlerLog | undefined;
};

const SERVER_CLOCK_OFFSET_MS = 60 * 60 * 1000;

function adjustedNow(): number {
  // Counteract the server clock offset so "age" calculations are accurate
  return Date.now();
}

function adjustedTs(log: CrawlerLog): number {
  return new Date(log.log_ts).getTime() + SERVER_CLOCK_OFFSET_MS;
}

const STALE_THRESHOLD_MS = 24 * 60 * 60_000; // 24 hours

export function computeHealthScore(
  logs: CrawlerLog[],
  options: { decayHours: number; graceMinutes: number },
): DeviceHealthScore {
  const { decayHours, graceMinutes } = options;
  const now = adjustedNow();
  const graceMs = graceMinutes * 60_000;
  const decayMs = decayHours * 60 * 60_000;

  const normalize = (v?: string | null) => (v ?? '').toLowerCase();

  const withAdjustedTs = logs.map((log) => ({
    log,
    ts: adjustedTs(log),
    type: normalize(log.log_type),
  }));

  const lastAssignmentEntry = [...withAdjustedTs]
    .sort((a, b) => b.ts - a.ts)
    .find((e) => e.type.includes('assignment'));
  const lastAssignment = lastAssignmentEntry?.log;

  // Work only with non-assignment logs
  const nonAssignment = withAdjustedTs
    .filter((e) => !e.type.includes('assignment'))
    .sort((a, b) => a.ts - b.ts); // chronological

  const lastSuccessEntry = [...nonAssignment]
    .reverse()
    .find((e) => e.type.includes('success'));
  const lastSuccess = lastSuccessEntry?.log;

  const lastCheckEntry = nonAssignment[nonAssignment.length - 1];
  const lastCheck = lastCheckEntry?.log;

  if (nonAssignment.length === 0) {
    return {
      score: 0,
      stale: true,
      totalChecks: 0,
      successCount: 0,
      failureCount: 0,
      checks: [],
      failureReasons: new Map(),
      lastCheck,
      lastSuccess,
      lastAssignment,
    };
  }

  const checks: CheckMark[] = [];
  const failureReasons = new Map<string, number>();
  let weightedSuccesses = 0;
  let weightedTotal = 0;
  let successCount = 0;
  let failureCount = 0;

  for (const { log, ts, type } of nonAssignment) {
    const ageMs = now - ts;
    // Grace period: skip very recent failures (< graceMs old) for scoring only;
    // still include them in the visual checks array.
    const isSuccess = type.includes('success');
    const isFailure = type.includes('fail');

    if (!isSuccess && !isFailure) continue; // skip unknown/other types for scoring

    const mark: CheckMark = {
      timestamp: new Date(ts), // offset-adjusted timestamp (server clock + 1h)
      success: isSuccess,
      logType: log.log_type,
      reason: log.reason ?? undefined,
    };
    checks.push(mark);

    if (isSuccess) {
      successCount += 1;
    } else {
      failureCount += 1;
      const reason = (log.reason ?? '').trim() || log.log_type || 'Unknown';
      failureReasons.set(reason, (failureReasons.get(reason) ?? 0) + 1);
    }

    // Exclude very recent failures from scoring weight (grace period)
    if (isFailure && ageMs < graceMs) continue;

    // Exponential decay weight: w = e^(-age / decayMs)
    const weight = Math.exp(-ageMs / decayMs);
    weightedTotal += weight;
    if (isSuccess) {
      weightedSuccesses += weight;
    }
  }

  const lastCheckAge = now - (lastCheckEntry?.ts ?? 0);
  const stale = lastCheckAge > STALE_THRESHOLD_MS;

  // If all checks are outside the scoring window (e.g. only grace-skipped failures
  // and the device hasn't been seen in >24h), treat as 0% rather than unknown.
  const score = stale ? 0 : weightedTotal > 0 ? weightedSuccesses / weightedTotal : 0;

  return {
    score,
    stale,
    totalChecks: successCount + failureCount,
    successCount,
    failureCount,
    checks,
    failureReasons,
    lastCheck,
    lastSuccess,
    lastAssignment,
  };
}

export function scoreColor(score: number, stale = false): string {
  if (stale || score <= 0) return 'rgba(255,85,99,0.9)';
  if (score >= 0.85) return 'rgba(0,255,159,0.9)';
  if (score >= 0.5) return 'rgba(255,179,71,0.9)';
  return 'rgba(255,85,99,0.9)';
}

export function scoreLabel(score: number, stale = false): string {
  if (stale && score === 0) return '0%';
  return `${Math.round(score * 100)}%`;
}

export function scoreBucket(score: number, stale = false): 'healthy' | 'watch' | 'attention' | 'unknown' {
  if (stale || score === 0) return 'attention';
  if (score >= 0.85) return 'healthy';
  if (score >= 0.5) return 'watch';
  return 'attention';
}
