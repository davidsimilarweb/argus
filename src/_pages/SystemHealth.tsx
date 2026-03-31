'use client';

import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { deviceApi, getDeviceSlot, type Device, type DeviceCrawlerLogs } from '../lib/api';
import { computeHealthScore, scoreColor, scoreLabel, scoreBucket } from '../lib/healthScoring';
import type { DeviceHealthScore } from '../lib/healthScoring';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../hooks/useToast';
import HealthGraph from '../components/HealthGraph';

type HealthRow = {
  device: Device;
  host: string;
  score: DeviceHealthScore;
};

type SortKey = 'device' | 'host' | 'score' | 'checks' | 'lastCheck' | 'lastSuccess';

const SERVER_CLOCK_OFFSET_MS = 60 * 60 * 1000;

const formatTimeAgo = (date?: Date | null): string => {
  if (!date) return '—';
  const adjustedTs = date.getTime() + SERVER_CLOCK_OFFSET_MS;
  const diffMs = Date.now() - adjustedTs;
  if (diffMs < 0) return 'just now';
  const totalMinutes = Math.floor(diffMs / 60000);
  if (totalMinutes < 1) return 'just now';
  if (totalMinutes < 60) return `${totalMinutes}m ago`;
  const totalHours = Math.floor(totalMinutes / 60);
  const remMinutes = totalMinutes % 60;
  if (totalHours < 24) return `${totalHours}h ${remMinutes}m ago`;
  const totalDays = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;
  return `${totalDays}d ${remHours}h ago`;
};

const getDeviceHost = (device: Device): string => {
  const ed = device.extra_data as Record<string, unknown> | null;
  return typeof ed?.host === 'string' ? ed.host : '';
};

const BUCKET_ORDER = { attention: 0, watch: 1, healthy: 2, unknown: 3 };

function ScoreBadge({ score, stale }: { score: number; stale: boolean }) {
  const color = scoreColor(score, stale);
  const label = scoreLabel(score, stale);
  const bucket = scoreBucket(score, stale);
  const bgAlpha = bucket === 'attention' ? 0.15 : bucket === 'watch' ? 0.12 : 0.1;
  const baseColor =
    bucket === 'attention'
      ? '255,85,99'
      : bucket === 'watch'
        ? '255,179,71'
        : bucket === 'healthy'
          ? '0,255,159'
          : '150,150,150';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.2rem 0.65rem',
        borderRadius: '999px',
        border: `1px solid ${color}`,
        background: `rgba(${baseColor},${bgAlpha})`,
        color,
        fontWeight: 600,
        fontSize: '0.88rem',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: color,
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}

function SummaryCard({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? `rgba(${color},0.15)` : 'rgba(255,255,255,0.04)',
        border: active ? `1px solid rgba(${color},0.5)` : '1px solid rgba(255,255,255,0.1)',
        borderRadius: '10px',
        padding: '0.9rem 1.2rem',
        cursor: 'pointer',
        textAlign: 'left',
        minWidth: '120px',
        transition: 'all 0.15s ease',
      }}
    >
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: `rgba(${color},0.95)`, lineHeight: 1 }}>
        {count}
      </div>
      <div style={{ fontSize: '0.82rem', color: '#888', marginTop: '0.3rem' }}>{label}</div>
    </button>
  );
}

function HostGroupHeader({
  host,
  rows,
  windowHours,
}: {
  host: string;
  rows: HealthRow[];
  windowHours: number;
}) {
  const attentionCount = rows.filter((r) => scoreBucket(r.score.score, r.score.stale) === 'attention').length;
  const watchCount = rows.filter((r) => scoreBucket(r.score.score, r.score.stale) === 'watch').length;
  const isHostProblem = attentionCount >= 2 && attentionCount / rows.length >= 0.5;
  const label = host || 'No host';

  return (
    <tr>
      <td
        colSpan={6}
        style={{
          padding: '0.6rem 0.75rem',
          background: isHostProblem ? 'rgba(255,85,99,0.12)' : 'rgba(255,255,255,0.04)',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: '0.88rem',
            color: isHostProblem ? '#ff5563' : '#aaa',
          }}
        >
          {isHostProblem ? '⚠ ' : ''}
          {label}
        </span>
        <span style={{ color: '#666', fontSize: '0.82rem', marginLeft: '0.75rem' }}>
          {rows.length} device{rows.length !== 1 ? 's' : ''}
          {attentionCount > 0 && (
            <span style={{ color: 'rgba(255,85,99,0.85)', marginLeft: '0.5rem' }}>
              · {attentionCount} need{attentionCount === 1 ? 's' : ''} attention
            </span>
          )}
          {watchCount > 0 && (
            <span style={{ color: 'rgba(255,179,71,0.85)', marginLeft: '0.5rem' }}>
              · {watchCount} to watch
            </span>
          )}
          {isHostProblem && (
            <span style={{ color: '#ff9aa3', marginLeft: '0.5rem' }}>
              — possible host issue
            </span>
          )}
        </span>
        {/* Mini per-host health bar */}
        <span
          style={{
            display: 'inline-flex',
            gap: '2px',
            marginLeft: '1rem',
            verticalAlign: 'middle',
          }}
        >
          {rows.slice(0, 20).map((r) => {
            const b = scoreBucket(r.score.score, r.score.stale);
            const c =
              b === 'healthy'
                ? 'rgba(0,255,159,0.7)'
                : b === 'watch'
                  ? 'rgba(255,179,71,0.7)'
                  : b === 'attention'
                    ? 'rgba(255,85,99,0.7)'
                    : 'rgba(150,150,150,0.4)';
            return (
              <span
                key={r.device.id}
                title={`${getDeviceSlot(r.device) !== null ? `#${getDeviceSlot(r.device)} (${r.device.id})` : r.device.id}: ${scoreLabel(r.score.score, r.score.stale)}`}
                style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: c }}
              />
            );
          })}
        </span>
      </td>
    </tr>
  );
}

export default function SystemHealth() {
  const queryClient = useQueryClient();
  const { ToastContainer, showToast } = useToast();
  const { healthGraceMinutes, healthWindowHours, healthDecayHours } = useSettings();

  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [hostFilter, setHostFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('deployed');
  const [bucketFilter, setBucketFilter] = useState<'all' | 'attention' | 'watch' | 'healthy' | 'unknown'>('all');
  const [groupByHost, setGroupByHost] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data: devices = [], isLoading: isDevicesLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const res = await deviceApi.getAll();
      return res.data;
    },
  });

  const deviceIdsKey = useMemo(
    () => (devices.length ? devices.map((d) => d.id).sort().join('|') : 'none'),
    [devices],
  );

  const windowDays = Math.ceil(healthWindowHours / 24);
  // Request enough logs to cover the full window. Assuming crawls run at most
  // every ~15 min, 24h = ~96 checks; 7d = ~672. Cap at 1000 to stay sane.
  const logLimit = Math.min(1000, windowDays * 100);

  const {
    data: crawlerLogs = [],
    isLoading: isLogsLoading,
    isRefetching: isLogsRefetching,
    error: logsError,
  } = useQuery<DeviceCrawlerLogs[]>({
    queryKey: ['crawler-logs-health', deviceIdsKey, windowDays, logLimit],
    enabled: devices.length > 0,
    queryFn: async () => {
      const res = await deviceApi.getCrawlerLogsAll({ days: windowDays, limit: logLimit });
      const data = res.data ?? [];
      if (!Array.isArray(data)) throw new Error('Invalid crawler logs response');
      return data;
    },
  });

  const healthRows = useMemo<HealthRow[]>(() => {
    if (!devices.length) return [];
    const logMap = new Map<string, DeviceCrawlerLogs['logs']>();
    for (const entry of crawlerLogs) {
      if (!entry?.device_id) continue;
      logMap.set(entry.device_id, Array.isArray(entry.logs) ? entry.logs : []);
    }
    return devices.map((device) => {
      const logs = logMap.get(device.id) ?? [];
      const score = computeHealthScore(logs, {
        decayHours: healthDecayHours,
        graceMinutes: healthGraceMinutes,
      });
      return { device, host: getDeviceHost(device), score };
    });
  }, [crawlerLogs, devices, healthDecayHours, healthGraceMinutes]);

  const uniqueHosts = useMemo(
    () => Array.from(new Set(healthRows.map((r) => r.host).filter(Boolean))).sort(),
    [healthRows],
  );

  const uniqueCountries = useMemo(
    () =>
      Array.from(new Set(healthRows.map((r) => r.device.account?.country).filter((c): c is string => Boolean(c)))).sort(),
    [healthRows],
  );

  const bucketCounts = useMemo(() => {
    const counts = { all: healthRows.length, attention: 0, watch: 0, healthy: 0, unknown: 0 };
    for (const row of healthRows) {
      counts[scoreBucket(row.score.score, row.score.stale)]++;
    }
    return counts;
  }, [healthRows]);

  // Deployed device counts for summary bar
  const deployedRows = useMemo(() => healthRows.filter((r) => r.device.status === 'deployed'), [healthRows]);
  const deployedCounts = useMemo(() => {
    const counts = { total: deployedRows.length, attention: 0, watch: 0, healthy: 0, unknown: 0 };
    for (const row of deployedRows) counts[scoreBucket(row.score.score, row.score.stale)]++;
    return counts;
  }, [deployedRows]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchQuery.toLowerCase();
    return healthRows.filter((row) => {
      if (statusFilter !== 'all' && row.device.status !== statusFilter) return false;
      if (bucketFilter !== 'all' && scoreBucket(row.score.score, row.score.stale) !== bucketFilter) return false;
      if (hostFilter !== 'all') {
        if (hostFilter === '__none__' ? row.host : row.host !== hostFilter) return false;
      }
      if (countryFilter !== 'all') {
        const c = row.device.account?.country || '';
        if (countryFilter === 'none' ? c : c !== countryFilter) return false;
      }
      if (normalizedSearch) {
        const id = row.device.id.toLowerCase();
        const host = row.host.toLowerCase();
        const model = (row.device.device_model || '').toLowerCase();
        const ip = (row.device.static_ip || '').toLowerCase();
        const country = (row.device.account?.country || '').toLowerCase();
        if (!id.includes(normalizedSearch) && !host.includes(normalizedSearch) && !model.includes(normalizedSearch) && !ip.includes(normalizedSearch) && !country.includes(normalizedSearch)) return false;
      }
      return true;
    });
  }, [healthRows, searchQuery, statusFilter, bucketFilter, hostFilter, countryFilter]);

  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows].sort((a, b) => {
      switch (sortKey) {
        case 'device':
          return a.device.id.localeCompare(b.device.id);
        case 'host':
          return a.host.localeCompare(b.host) || a.device.id.localeCompare(b.device.id);
        case 'score':
          return a.score.score - b.score.score;
        case 'checks':
          return a.score.failureCount - b.score.failureCount;
        case 'lastCheck': {
          const at = a.score.lastCheck ? new Date(a.score.lastCheck.log_ts).getTime() : 0;
          const bt = b.score.lastCheck ? new Date(b.score.lastCheck.log_ts).getTime() : 0;
          return bt - at;
        }
        case 'lastSuccess': {
          const at = a.score.lastSuccess ? new Date(a.score.lastSuccess.log_ts).getTime() : 0;
          const bt = b.score.lastSuccess ? new Date(b.score.lastSuccess.log_ts).getTime() : 0;
          return bt - at;
        }
        default:
          return 0;
      }
    });
    // For score sort: worst first by default (asc = worst to best), so we keep as-is for asc
    // For other sorts: standard asc/desc
    if (sortKey === 'score') {
      return sortDir === 'asc' ? sorted : sorted.reverse();
    }
    return sortDir === 'desc' ? sorted.reverse() : sorted;
  }, [filteredRows, sortKey, sortDir]);

  // Group rows by host when toggle is on
  const groupedRows = useMemo(() => {
    if (!groupByHost) return null;
    const groups = new Map<string, HealthRow[]>();
    for (const row of sortedRows) {
      const key = row.host || '__none__';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }
    // Sort groups: worst-scoring first (lowest avg score)
    return Array.from(groups.entries()).sort(([, a], [, b]) => {
      const avgScore = (rows: HealthRow[]) => {
        const valid = rows.filter((r) => r.score.score >= 0);
        if (!valid.length) return 0;
        return valid.reduce((sum, r) => sum + r.score.score, 0) / valid.length;
      };
      return avgScore(a) - avgScore(b);
    });
  }, [sortedRows, groupByHost]);

  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['devices'] }),
      queryClient.invalidateQueries({ queryKey: ['crawler-logs-health'] }),
    ]);
    showToast('Health data refreshed', 'success');
  };

  const SortIndicator = ({ col }: { col: SortKey }) => (
    <span style={{ opacity: sortKey === col ? 0.9 : 0.3, marginLeft: '4px', fontSize: '0.75rem' }}>
      {sortKey === col ? (sortDir === 'asc' ? '▲' : '▼') : '▲'}
    </span>
  );

  const isLoading = isDevicesLoading || isLogsLoading;

  const renderRow = (row: HealthRow) => {
    const isExpanded = expandedRows.has(row.device.id);
    const bucket = scoreBucket(row.score.score, row.score.stale);
    const rowBg =
      bucket === 'attention'
        ? 'rgba(255,85,99,0.05)'
        : bucket === 'watch'
          ? 'rgba(255,179,71,0.04)'
          : 'transparent';

    const lastCheckDate = row.score.lastCheck
      ? new Date(new Date(row.score.lastCheck.log_ts).getTime() + SERVER_CLOCK_OFFSET_MS)
      : null;
    const lastSuccessDate = row.score.lastSuccess
      ? new Date(new Date(row.score.lastSuccess.log_ts).getTime() + SERVER_CLOCK_OFFSET_MS)
      : null;

    return (
      <React.Fragment key={row.device.id}>
        <tr
          style={{ background: rowBg, cursor: 'pointer' }}
          onClick={() => toggleExpand(row.device.id)}
        >
          <td style={{ padding: '0.7rem 0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
            <span style={{ marginRight: '0.4rem', opacity: 0.5, fontSize: '0.75rem' }}>
              {isExpanded ? '▼' : '▶'}
            </span>
            {getDeviceSlot(row.device) !== null ? (
              <>
                <span>#{getDeviceSlot(row.device)}</span>
                <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 400, color: '#888', marginTop: '0.05rem' }}>{row.device.id}</span>
              </>
            ) : row.device.id}
          </td>
          <td style={{ padding: '0.7rem 0.75rem', color: '#aaa', fontSize: '0.88rem' }}>
            {row.host || <span style={{ color: '#555' }}>—</span>}
          </td>
          <td style={{ padding: '0.7rem 0.75rem' }}>
            <ScoreBadge score={row.score.score} stale={row.score.stale} />
          </td>
          <td style={{ padding: '0.7rem 0.75rem', fontSize: '0.88rem', color: '#ccc', whiteSpace: 'nowrap' }}>
            {row.score.totalChecks > 0 ? (
              <>
                <span style={{ color: row.score.failureCount > 0 ? 'rgba(255,85,99,0.8)' : '#888' }}>
                  {row.score.failureCount}F
                </span>
                <span style={{ color: '#555' }}> / </span>
                <span style={{ color: '#888' }}>{row.score.totalChecks}</span>
              </>
            ) : (
              <span style={{ color: '#555' }}>—</span>
            )}
          </td>
          <td style={{ padding: '0.7rem 0.75rem', color: '#aaa', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
            {formatTimeAgo(lastCheckDate)}
          </td>
          <td style={{ padding: '0.7rem 0.75rem', color: '#aaa', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
            {formatTimeAgo(lastSuccessDate)}
          </td>
        </tr>

        {isExpanded && (
          <tr key={`${row.device.id}-expanded`}>
            <td
              colSpan={6}
              style={{
                padding: '0 0.75rem 1rem 2rem',
                background: 'rgba(0,0,0,0.18)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div style={{ maxWidth: '900px', paddingTop: '0.75rem' }}>
                {/* Stale warning */}
                {row.score.stale && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.3rem 0.75rem',
                    marginBottom: '0.6rem',
                    borderRadius: '6px',
                    background: 'rgba(255,85,99,0.12)',
                    border: '1px solid rgba(255,85,99,0.3)',
                    color: '#ff9aa3',
                    fontSize: '0.82rem',
                  }}>
                    No checks received in the last 24h — device may be offline or disconnected
                  </div>
                )}
                {/* Graph */}
                <HealthGraph checks={row.score.checks} windowHours={healthWindowHours} />

                {/* Failure reasons */}
                {row.score.failureReasons.size > 0 && (
                  <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ color: '#666', fontSize: '0.82rem' }}>Failure reasons:</span>
                    {Array.from(row.score.failureReasons.entries())
                      .sort((a, b) => b[1] - a[1])
                      .map(([reason, count]) => (
                        <span
                          key={reason}
                          style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '999px',
                            background: 'rgba(255,85,99,0.12)',
                            border: '1px solid rgba(255,85,99,0.25)',
                            color: '#ff9aa3',
                            fontSize: '0.8rem',
                          }}
                        >
                          {reason} <span style={{ opacity: 0.65 }}>×{count}</span>
                        </span>
                      ))}
                  </div>
                )}

                {/* Device metadata line */}
                <div style={{ marginTop: '0.6rem', color: '#666', fontSize: '0.8rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {row.device.device_model && <span>{row.device.device_model}</span>}
                  {row.device.ios_version && <span>iOS {row.device.ios_version}</span>}
                  {row.device.static_ip && <span>{row.device.static_ip}</span>}
                  {row.device.account?.country && <span>{row.device.account.country}</span>}
                  <span className={`status-badge status-${row.device.status}`} style={{ fontSize: '0.78rem' }}>{row.device.status}</span>
                </div>
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  if (isDevicesLoading) return <div>Loading devices…</div>;

  return (
    <>
      <ToastContainer />
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <h2>System Health</h2>
        <button
          className="btn-primary"
          onClick={handleRefresh}
          disabled={isLogsLoading || isLogsRefetching}
        >
          {isLogsLoading || isLogsRefetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Summary bar */}
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <SummaryCard
          label="Deployed"
          count={deployedCounts.total}
          color="150,150,150"
          active={statusFilter === 'deployed' && bucketFilter === 'all'}
          onClick={() => { setStatusFilter('deployed'); setBucketFilter('all'); }}
        />
        <SummaryCard
          label="Need attention"
          count={deployedCounts.attention}
          color="255,85,99"
          active={bucketFilter === 'attention'}
          onClick={() => { setStatusFilter('deployed'); setBucketFilter('attention'); }}
        />
        <SummaryCard
          label="To watch"
          count={deployedCounts.watch}
          color="255,179,71"
          active={bucketFilter === 'watch'}
          onClick={() => { setStatusFilter('deployed'); setBucketFilter('watch'); }}
        />
        <SummaryCard
          label="Healthy"
          count={deployedCounts.healthy}
          color="0,255,159"
          active={bucketFilter === 'healthy'}
          onClick={() => { setStatusFilter('deployed'); setBucketFilter('healthy'); }}
        />
        <div style={{ color: '#555', fontSize: '0.82rem', marginLeft: '0.5rem', alignSelf: 'center' }}>
          window: {healthWindowHours}h · decay: {healthDecayHours}h · grace: {healthGraceMinutes}m
        </div>
      </div>

      {/* Filter / controls bar */}
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search device, host, model, IP…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: '1 1 220px',
            padding: '0.5rem 0.75rem',
            border: 'var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(255,255,255,0.04)',
            color: 'var(--text)',
            fontSize: '0.9rem',
          }}
        />
        <select
          value={hostFilter}
          onChange={(e) => setHostFilter(e.target.value)}
          style={{
            padding: '0.5rem 0.75rem',
            border: 'var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(255,255,255,0.04)',
            color: 'var(--text)',
            fontSize: '0.9rem',
          }}
        >
          <option value="all">All Hosts</option>
          <option value="__none__">No Host</option>
          {uniqueHosts.map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        <select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          style={{
            padding: '0.5rem 0.75rem',
            border: 'var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(255,255,255,0.04)',
            color: 'var(--text)',
            fontSize: '0.9rem',
          }}
        >
          <option value="all">All Countries</option>
          <option value="none">No Country</option>
          {uniqueCountries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '0.5rem 0.75rem',
            border: 'var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(255,255,255,0.04)',
            color: 'var(--text)',
            fontSize: '0.9rem',
          }}
        >
          <option value="all">All Statuses</option>
          <option value="deployed">Deployed</option>
          <option value="pending">Pending</option>
          <option value="ready">Ready</option>
          <option value="broken">Broken</option>
          <option value="testing">Testing</option>
          <option value="lab_support">Lab Support</option>
        </select>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.5rem 0.75rem',
            border: groupByHost ? '1px solid rgba(0,229,255,0.4)' : 'var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: groupByHost ? 'rgba(0,229,255,0.08)' : 'rgba(255,255,255,0.04)',
            color: groupByHost ? '#00e5ff' : 'var(--text)',
            fontSize: '0.9rem',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={groupByHost}
            onChange={(e) => setGroupByHost(e.target.checked)}
            style={{ margin: 0 }}
          />
          Group by host
        </label>
        <span style={{ color: '#666', fontSize: '0.88rem' }}>
          {sortedRows.length} / {devices.length} devices
        </span>
      </div>

      {/* Score bucket pills */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.9rem', flexWrap: 'wrap' }}>
        {(
          [
            { value: 'all', label: 'All', color: '150,150,150' },
            { value: 'attention', label: 'Needs attention', color: '255,85,99' },
            { value: 'watch', label: 'To watch', color: '255,179,71' },
            { value: 'healthy', label: 'Healthy', color: '0,255,159' },
            { value: 'unknown', label: 'Unknown', color: '150,150,150' },
          ] as const
        ).map(({ value, label, color }) => {
          const isActive = bucketFilter === value;
          const count = value === 'all' ? filteredRows.length : filteredRows.filter((r) => scoreBucket(r.score.score, r.score.stale) === value).length;
          return (
            <button
              key={value}
              onClick={() => setBucketFilter(value)}
              style={{
                padding: '0.3rem 0.8rem',
                borderRadius: '999px',
                border: isActive ? `1px solid rgba(${color},0.7)` : '1px solid transparent',
                background: isActive ? `rgba(${color},0.15)` : `rgba(${color},0.06)`,
                color: isActive ? `rgba(${color},0.95)` : '#777',
                cursor: 'pointer',
                fontSize: '0.83rem',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {label} <span style={{ opacity: 0.7 }}>({count})</span>
            </button>
          );
        })}
      </div>

      {logsError && (
        <div style={{
          padding: '0.85rem 1rem',
          marginBottom: '1rem',
          background: 'rgba(255,85,99,0.12)',
          border: '1px solid rgba(255,85,99,0.35)',
          borderRadius: 'var(--radius-sm)',
          color: '#ff9aa3',
        }}>
          <strong>Failed to load crawler logs.</strong>{' '}
          {(logsError as Error).message}
        </div>
      )}

      {isLoading && (
        <div style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>
          Loading health data…
        </div>
      )}

      {!isLoading && (
        <div style={{
          overflowX: 'auto',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                <th
                  style={{ textAlign: 'left', padding: '0.7rem 0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  onClick={() => toggleSort('device')}
                >
                  Device <SortIndicator col="device" />
                </th>
                <th
                  style={{ textAlign: 'left', padding: '0.7rem 0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  onClick={() => toggleSort('host')}
                >
                  Host <SortIndicator col="host" />
                </th>
                <th
                  style={{ textAlign: 'left', padding: '0.7rem 0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  onClick={() => toggleSort('score')}
                >
                  Score <SortIndicator col="score" />
                </th>
                <th
                  style={{ textAlign: 'left', padding: '0.7rem 0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  onClick={() => toggleSort('checks')}
                >
                  Checks <SortIndicator col="checks" />
                </th>
                <th
                  style={{ textAlign: 'left', padding: '0.7rem 0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  onClick={() => toggleSort('lastCheck')}
                >
                  Last check <SortIndicator col="lastCheck" />
                </th>
                <th
                  style={{ textAlign: 'left', padding: '0.7rem 0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  onClick={() => toggleSort('lastSuccess')}
                >
                  Last success <SortIndicator col="lastSuccess" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                    No devices match the current filters.
                  </td>
                </tr>
              )}

              {groupByHost && groupedRows
                ? groupedRows.map(([hostKey, rows]) => (
                    <React.Fragment key={hostKey}>
                      <HostGroupHeader
                        host={hostKey === '__none__' ? '' : hostKey}
                        rows={rows}
                        windowHours={healthWindowHours}
                      />
                      {rows.map((row) => renderRow(row))}
                    </React.Fragment>
                  ))
                : sortedRows.map((row) => renderRow(row))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
