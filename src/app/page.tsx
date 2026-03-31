'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { deviceApi, accountApi, type DeviceCrawlerLogs, type StatsResponse } from '../lib/api';
import { useSettings } from '../contexts/SettingsContext';

const HEALTH_LOG_LIMIT = 12;
const SERVER_CLOCK_OFFSET_MS = 60 * 60 * 1000;

const TREND_DAYS = 7;

export default function Dashboard() {
  const { healthGraceMinutes } = useSettings();
  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const res = await deviceApi.getAll();
      return res.data;
    },
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await accountApi.getAll();
      return res.data;
    },
  });

  const deviceIdsKey = useMemo(
    () => (devices.length ? devices.map((d) => d.id).sort().join('|') : 'none'),
    [devices]
  );

  const {
    data: crawlerLogs = [],
    isLoading: isLogsLoading,
    error: logsError,
  } = useQuery<DeviceCrawlerLogs[]>({
    queryKey: ['crawler-logs', deviceIdsKey, HEALTH_LOG_LIMIT],
    enabled: devices.length > 0,
    queryFn: async () => {
      const res = await deviceApi.getCrawlerLogsAll({ limit: HEALTH_LOG_LIMIT });
      const data = res.data ?? [];
      if (!Array.isArray(data)) {
        throw new Error('Invalid crawler logs response');
      }
      return data;
    },
  });

  const { data: statsData } = useQuery<StatsResponse>({
    queryKey: ['stats', TREND_DAYS],
    queryFn: async () => {
      const res = await deviceApi.getStats({ days: TREND_DAYS });
      return res.data;
    },
    staleTime: 5 * 60_000,
  });

  const trendData = useMemo(() => {
    if (!statsData) return { bars: [], maxCount: 1, rolling24h: 0 };

    const days = [...statsData.agg_daily]
      .slice(0, TREND_DAYS)
      .reverse();

    const todayStr = new Date().toISOString().slice(0, 10);

    const bars = days.map((d) => ({
      date: d.date,
      label: d.date === todayStr ? 'Today' : new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' }),
      count: d.num_success,
      failures: d.num_failure,
      failureRate: d.failure_rate,
    }));

    const maxCount = Math.max(1, ...bars.map((b) => b.count));

    const rolling24h = statsData.today.num_success;

    return { bars, maxCount, rolling24h };
  }, [statsData]);

  const healthSnapshot = useMemo(() => {
    const graceMs = Math.max(0, healthGraceMinutes) * 60_000;
    const normalizeType = (value?: string | null) => (value ?? '').toLowerCase();
    const logMap = new Map<string, DeviceCrawlerLogs['logs']>();
    for (const entry of crawlerLogs) {
      if (!entry?.device_id) continue;
      logMap.set(entry.device_id, Array.isArray(entry.logs) ? entry.logs : []);
    }

    let successes = 0;
    let failures = 0;
    const failureReasonCounts = new Map<string, number>();
    let devicesWithoutLogs = 0;
    let skippedAssignmentsOnly = 0;
    let skippedFreshOnly = 0;
    let skippedNoChosen = 0;
    const perDeviceDebug: Array<{
      device: string;
      chosenType?: string;
      chosenTs?: string;
      chosenAgeMs?: number;
      reason?: string | null;
      skippedFreshFail: boolean;
      firstLogType?: string;
      sortedLen: number;
    }> = [];

    for (const device of devices) {
      const logs = logMap.get(device.id) ?? [];
      if (!logs.length) {
        devicesWithoutLogs += 1;
        continue;
      }

      const sorted = [...logs]
        .sort((a, b) => new Date(b.log_ts).getTime() - new Date(a.log_ts).getTime())
        .filter((log) => !normalizeType(log.log_type).includes('assignment'));

      if (!sorted.length) {
        skippedAssignmentsOnly += 1;
        continue;
      }

      let chosen = null as (typeof logs)[number] | null;
      let skippedFreshFail = false;
      for (const log of sorted) {
        const type = normalizeType(log.log_type);
        if (type.includes('fail')) {
          const adjustedTs = new Date(log.log_ts).getTime() + SERVER_CLOCK_OFFSET_MS;
          const ageMs = Date.now() - adjustedTs;
          if (ageMs < graceMs) {
            skippedFreshFail = true;
            continue;
          }
        }
        chosen = log;
        break;
      }

      if (!chosen) {
        if (skippedFreshFail) skippedFreshOnly += 1;
        else skippedNoChosen += 1;
        continue;
      }

      const type = normalizeType(chosen.log_type);
      if (type.includes('success')) {
        successes += 1;
      } else if (type.includes('fail')) {
        failures += 1;
        const rawReason = (chosen.reason ?? '').trim();
        const reason = rawReason || chosen.log_type || 'Unknown failure';
        failureReasonCounts.set(reason, (failureReasonCounts.get(reason) ?? 0) + 1);
      }

      perDeviceDebug.push({
        device: device.id,
        chosenType: chosen.log_type,
        chosenTs: chosen.log_ts,
        chosenAgeMs: (() => {
          const ts = new Date(chosen.log_ts).getTime();
          if (Number.isNaN(ts)) return undefined;
          return Date.now() - (ts + SERVER_CLOCK_OFFSET_MS);
        })(),
        reason: chosen.reason,
        skippedFreshFail,
        firstLogType: sorted[0]?.log_type,
        sortedLen: sorted.length,
      });
    }

    const [topReason, topReasonCount] =
      Array.from(failureReasonCounts.entries()).sort((a, b) => b[1] - a[1])[0] ?? [null, 0];

    if (process.env.NODE_ENV === 'development') {
      console.log('[Health snapshot]', {
        graceMinutes: healthGraceMinutes,
        totals: { successes, failures },
        skips: {
          devicesWithoutLogs,
          skippedAssignmentsOnly,
          skippedFreshOnly,
          skippedNoChosen,
        },
        sampled: perDeviceDebug,
      });
    }

    return { successes, failures, topReason, topReasonCount };
  }, [crawlerLogs, devices, healthGraceMinutes]);

  const stats = {
    totalDevices: devices.length,
    pending: devices.filter(d => d.status === 'pending').length,
    ready: devices.filter(d => d.status === 'ready').length,
    deployed: devices.filter(d => d.status === 'deployed').length,
    broken: devices.filter(d => d.status === 'broken').length,
    testing: devices.filter(d => d.status === 'testing').length,
    labSupport: devices.filter(d => d.status === 'lab_support').length,
    totalAccounts: accounts.length,
  };

  return (
    <div className="dashboard">
      <h2>Dashboard</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Devices</h3>
          <p className="stat-number">{stats.totalDevices}</p>
        </div>
        <div className="stat-card status-pending">
          <h3>Pending</h3>
          <p className="stat-number">{stats.pending}</p>
        </div>
        <div className="stat-card status-ready">
          <h3>Ready</h3>
          <p className="stat-number">{stats.ready}</p>
        </div>
        <div className="stat-card status-deployed">
          <h3>Deployed</h3>
          <p className="stat-number">{stats.deployed}</p>
        </div>
        <div className="stat-card status-broken">
          <h3>Broken</h3>
          <p className="stat-number">{stats.broken}</p>
        </div>
        <div className="stat-card status-testing">
          <h3>Testing</h3>
          <p className="stat-number">{stats.testing}</p>
        </div>
        <div className="stat-card status-lab_support">
          <h3>Lab Support</h3>
          <p className="stat-number">{stats.labSupport}</p>
        </div>
        <div className="stat-card">
          <h3>Accounts</h3>
          <p className="stat-number">{stats.totalAccounts}</p>
        </div>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <div className="page-header" style={{ marginBottom: '0.8rem' }}>
          <h3 style={{ margin: 0 }}>Health checks snapshot</h3>
          <span style={{ color: '#888', fontSize: '0.9rem' }}>
            Based on recent crawler logs (limit {HEALTH_LOG_LIMIT}) · Grace: {healthGraceMinutes}m
          </span>
        </div>

        {logsError && (
          <div
            className="stat-card"
            style={{ borderColor: 'rgba(255,85,99,0.35)', color: '#ff9aa3' }}
          >
            <h3>Health data</h3>
            <p style={{ margin: 0 }}>{(logsError as Error).message}</p>
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card status-ready">
            <h3>Successes</h3>
            <p className="stat-number">
              {isLogsLoading ? '…' : healthSnapshot.successes}
            </p>
            <div className="stat-meta">Latest healthcheck outcomes</div>
          </div>
          <div className="stat-card status-broken">
            <h3>Failures</h3>
            <p className="stat-number">
              {isLogsLoading ? '…' : healthSnapshot.failures}
            </p>
            <div className="stat-meta">Devices with recent failures</div>
          </div>
          <div className="stat-card status-ready">
            <h3>Successes (24h)</h3>
            <p className="stat-number">{trendData.rolling24h.toLocaleString()}</p>
            <div className="stat-meta">All checks across all devices</div>
          </div>
          <div className="stat-card">
            <h3>Top failure reason</h3>
            <p className="stat-number" style={{ fontSize: '1.8rem' }}>
              {isLogsLoading
                ? '…'
                : healthSnapshot.topReason
                  ? healthSnapshot.topReason
                  : 'None'}
            </p>
            <div className="stat-meta">
              {isLogsLoading
                ? 'Loading…'
                : healthSnapshot.topReason
                  ? `${healthSnapshot.topReasonCount} device${healthSnapshot.topReasonCount === 1 ? '' : 's'}`
                  : 'No failure reasons yet'}
            </div>
          </div>
        </div>
      </div>

      {/* Successes per day bar chart */}
      <div style={{ marginTop: '2rem' }}>
        <div className="page-header" style={{ marginBottom: '0.8rem' }}>
          <h3 style={{ margin: 0 }}>Successes per day</h3>
          <span style={{ color: '#888', fontSize: '0.9rem' }}>Last {TREND_DAYS} days · all devices</span>
        </div>
        <div
          className="stat-card"
          style={{ padding: '1.25rem 1.5rem' }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px' }}>
            {trendData.bars.map(({ date, label, count, failures: f, failureRate }) => {
              const heightPct = count / trendData.maxCount;
              const isToday = label === 'Today';
              return (
                <div
                  key={date}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}
                  title={`${label}: ${count.toLocaleString()} successes, ${f.toLocaleString()} failures (${failureRate} failure rate)`}
                >
                  <span style={{ fontSize: '0.72rem', color: isToday ? 'rgba(0,255,159,0.8)' : '#666', lineHeight: 1 }}>
                    {count > 0 ? count.toLocaleString() : ''}
                  </span>
                  <div
                    style={{
                      width: '100%',
                      height: `${Math.max(2, heightPct * 88)}px`,
                      borderRadius: '4px 4px 0 0',
                      background: isToday
                        ? 'rgba(0,255,159,0.6)'
                        : 'rgba(0,255,159,0.25)',
                      border: isToday
                        ? '1px solid rgba(0,255,159,0.4)'
                        : '1px solid rgba(0,255,159,0.12)',
                      transition: 'height 0.3s ease',
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
            {trendData.bars.map(({ date, label }) => (
              <div
                key={date}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  fontSize: '0.75rem',
                  color: label === 'Today' ? 'rgba(0,255,159,0.8)' : '#666',
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
