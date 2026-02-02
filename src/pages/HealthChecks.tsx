import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { deviceApi, type Device, type CrawlerLog, type DeviceCrawlerLogs } from '../lib/api';
import { useToast } from '../hooks/useToast';

type HealthRow = {
  device: Device;
  lastLog?: CrawlerLog;
  lastSuccess?: CrawlerLog;
  lastAssignment?: CrawlerLog;
  healthState: 'success' | 'failure' | 'unknown';
  error?: string;
};

type SortKey =
  | 'device'
  | 'country'
  | 'lastLogType'
  | 'lastLogTime'
  | 'timeSinceSuccess'
  | 'timeSinceAssignment';

// Server clock is off by ~1h; adjust forward to avoid inflated "ago" values.
const SERVER_CLOCK_OFFSET_MS = 60 * 60 * 1000;

const formatTimeAgo = (timestamp?: string | number | null) => {
  if (!timestamp) return '–';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return String(timestamp);
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
  if (totalDays < 7) return `${totalDays}d ${remHours}h ago`;

  const totalWeeks = Math.floor(totalDays / 7);
  if (totalWeeks < 4) return `${totalWeeks}w ${totalDays % 7}d ago`;

  const totalMonths = Math.floor(totalDays / 30);
  if (totalMonths < 12) return `${totalMonths}mo ${totalWeeks % 4}w ago`;

  const years = Math.floor(totalDays / 365);
  return `${years}y ${totalMonths % 12}mo ago`;
};

const formatShortTimestamp = (timestamp?: string | number | null) => {
  if (!timestamp) return '–';
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return String(timestamp);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
};

const computeHealth = (logs: CrawlerLog[] | null | undefined) => {
  if (!logs) {
    return {
      lastLog: undefined,
      lastSuccess: undefined,
      lastAssignment: undefined,
      healthState: 'unknown' as const,
    };
  }
  const normalize = (value?: string) => (value || '').toLowerCase();
  const sorted = [...logs].sort((a, b) => new Date(b.log_ts).getTime() - new Date(a.log_ts).getTime());
  const lastNonAssignment = sorted.find((log) => !normalize(log.log_type).includes('assignment'));
  const lastLog = lastNonAssignment; // show only non-assignment types (e.g., success/failure)
  const lastSuccess = sorted.find((log) => normalize(log.log_type).includes('success'));
  const lastAssignment = sorted.find((log) => normalize(log.log_type).includes('assignment'));

  const state: HealthRow['healthState'] = lastNonAssignment
    ? normalize(lastNonAssignment.log_type).includes('success')
      ? 'success'
      : normalize(lastNonAssignment.log_type).includes('fail')
        ? 'failure'
        : 'unknown'
    : 'unknown';

  return { lastLog, lastSuccess, lastAssignment, healthState: state };
};

export default function HealthChecks() {
  const queryClient = useQueryClient();
  const { ToastContainer, showToast } = useToast();
  const [sortKey, setSortKey] = useState<SortKey>('device');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data: devices = [], isLoading: isDevicesLoading, error: devicesError } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const res = await deviceApi.getAll();
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
    isRefetching: isLogsRefetching,
    error: logsError,
  } = useQuery<DeviceCrawlerLogs[]>({
    queryKey: ['crawler-logs', deviceIdsKey],
    enabled: devices.length > 0,
    queryFn: async () => {
      const res = await deviceApi.getCrawlerLogsAll({ limit: 6 });
      const data = res.data ?? [];
      if (!Array.isArray(data)) {
        throw new Error('Invalid crawler logs response');
      }
      return data;
    },
  });

  const healthRows = useMemo<HealthRow[]>(() => {
    if (!devices.length) return [];
    const logMap = new Map<string, CrawlerLog[]>();
    for (const entry of crawlerLogs) {
      if (!entry?.device_id) continue;
      const logs = Array.isArray(entry.logs) ? entry.logs : [];
      logMap.set(entry.device_id, logs);
    }
    return devices.map((device) => {
      const logs = logMap.get(device.id);
      const health = computeHealth(logs);
      return { device, ...health };
    });
  }, [crawlerLogs, devices]);

  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['devices'] }),
      queryClient.invalidateQueries({ queryKey: ['crawler-logs'] }),
    ]);
    showToast('Health checks refreshed', 'success');
  };

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedRows = useMemo(() => {
    const normalize = (v: unknown) => (v === null || v === undefined ? '' : String(v).toLowerCase());
    const getVal = (row: HealthRow, key: SortKey) => {
      switch (key) {
        case 'device':
          return row.device.id;
        case 'country':
          return row.device.account?.country || '';
        case 'lastLogType':
          return row.lastLog?.log_type || '';
        case 'lastLogTime':
          return row.lastLog?.log_ts || '';
        case 'timeSinceSuccess':
          return row.lastSuccess?.log_ts || '';
        case 'timeSinceAssignment':
          return row.lastAssignment?.log_ts || '';
      }
    };

    // Rows with any health data stay in the main sort; rows with no info go to the bottom.
    const hasInfo = (row: HealthRow) =>
      Boolean(row.lastLog || row.lastSuccess || row.lastAssignment);

    const withInfo = healthRows.filter(hasInfo);
    const withoutInfo = healthRows.filter((row) => !hasInfo(row));

    const sortedWithInfo = [...withInfo].sort((a, b) => {
      const va = normalize(getVal(a, sortKey));
      const vb = normalize(getVal(b, sortKey));
      if (va < vb) return -1;
      if (va > vb) return 1;
      return 0;
    });

    const orderedWithInfo = sortDir === 'asc' ? sortedWithInfo : sortedWithInfo.reverse();

    // Keep unknowns stable (by device id) but always after known rows.
    const stableWithoutInfo = [...withoutInfo].sort((a, b) => a.device.id.localeCompare(b.device.id));

    return [...orderedWithInfo, ...stableWithoutInfo];
  }, [healthRows, sortDir, sortKey]);

  const renderRowStyle = (state: HealthRow['healthState']) => {
    switch (state) {
      case 'success':
        return { background: 'rgba(0,255,159,0.06)', border: '1px solid rgba(0,255,159,0.2)' };
      case 'failure':
        return { background: 'rgba(255,85,99,0.08)', border: '1px solid rgba(255,85,99,0.25)' };
      default:
        return { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' };
    }
  };

  if (isDevicesLoading) return <div>Loading devices…</div>;
  if (devicesError) return <div>Error loading devices: {(devicesError as Error).message}</div>;

  return (
    <>
      <ToastContainer />
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <h2>Health Checks</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn-primary" onClick={handleRefresh} disabled={isLogsLoading || isLogsRefetching}>
            {isLogsLoading || isLogsRefetching ? 'Refreshing…' : 'Refresh'}
          </button>
          <span style={{ color: '#888', fontSize: '0.9rem' }}>
            {devices.length} devices
          </span>
        </div>
      </div>

      {logsError && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          background: 'rgba(255,85,99,0.15)',
          border: '1px solid rgba(255,85,99,0.4)',
          borderRadius: 'var(--radius-sm)',
          color: '#ff5563',
        }}>
          <strong>Failed to load some health checks.</strong>
          <div style={{ marginTop: '0.35rem', color: '#ff9aa3' }}>{(logsError as Error).message}</div>
        </div>
      )}

      {isLogsLoading && (
        <div style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>
          Loading health checks…
        </div>
      )}

      {!isLogsLoading && (
        <div style={{
          overflowX: 'auto',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                <th style={{ textAlign: 'left', padding: '0.75rem', cursor: 'pointer' }} onClick={() => toggleSort('device')}>Device</th>
                <th style={{ textAlign: 'left', padding: '0.75rem', cursor: 'pointer' }} onClick={() => toggleSort('country')}>Country</th>
                <th style={{ textAlign: 'left', padding: '0.75rem', cursor: 'pointer' }} onClick={() => toggleSort('lastLogType')}>Last log type</th>
                <th style={{ textAlign: 'left', padding: '0.75rem', cursor: 'pointer' }} onClick={() => toggleSort('lastLogTime')}>Last log time</th>
                <th style={{ textAlign: 'left', padding: '0.75rem', cursor: 'pointer' }} onClick={() => toggleSort('timeSinceSuccess')}>Time since success</th>
                <th style={{ textAlign: 'left', padding: '0.75rem', cursor: 'pointer' }} onClick={() => toggleSort('timeSinceAssignment')}>Time since assignment</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.device.id} style={{ ...renderRowStyle(row.healthState) }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>{row.device.id}</td>
                  <td style={{ padding: '0.75rem', color: '#ccc' }}>{row.device.account?.country || '—'}</td>
                  <td style={{ padding: '0.75rem', color: '#fff' }}>
                    {row.lastLog?.log_type ? (
                      <>
                        <div>{row.lastLog.log_type}</div>
                        {row.lastLog.reason && (
                          <div style={{ color: '#ff9aa3', fontSize: '0.85em', marginTop: '0.1rem' }}>
                            {row.lastLog.reason}
                          </div>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ padding: '0.75rem', color: '#aaa' }}>
                    {row.lastLog?.log_ts
                      ? `${formatTimeAgo(row.lastLog.log_ts)} (${formatShortTimestamp(row.lastLog.log_ts)})`
                      : '—'}
                  </td>
                  <td style={{ padding: '0.75rem', color: '#aaa' }}>
                    {row.lastSuccess?.log_ts
                      ? `${formatTimeAgo(row.lastSuccess.log_ts)} (${formatShortTimestamp(row.lastSuccess.log_ts)})`
                      : '—'}
                  </td>
                  <td style={{ padding: '0.75rem', color: '#aaa' }}>
                    {row.lastAssignment?.log_ts
                      ? `${formatTimeAgo(row.lastAssignment.log_ts)} (${formatShortTimestamp(row.lastAssignment.log_ts)})`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
