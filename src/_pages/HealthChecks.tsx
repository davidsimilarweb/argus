'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { deviceApi, getDeviceSlot, type Device, type CrawlerLog, type DeviceCrawlerLogs } from '../lib/api';
import { compileExpression } from '../lib/expressionFilter';
import Modal from '../components/Modal';
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
  const [stateFilter, setStateFilter] = useState<'all' | HealthRow['healthState']>('all');

  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('deployed');
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);
  const [advancedFilterDraft, setAdvancedFilterDraft] = useState('');
  const [advancedFilterExpression, setAdvancedFilterExpression] = useState('');
  const [advancedFilterEnabled, setAdvancedFilterEnabled] = useState(false);
  const [advancedFilterError, setAdvancedFilterError] = useState<string | null>(null);
  const [advancedFilterPredicate, setAdvancedFilterPredicate] = useState<((row: HealthRow) => boolean) | null>(null);

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

  const openAdvancedFilterModal = () => {
    setAdvancedFilterDraft(advancedFilterExpression);
    setAdvancedFilterError(null);
    setIsAdvancedFilterOpen(true);
  };

  const applyAdvancedFilter = () => {
    const expression = advancedFilterDraft.trim();
    if (!expression) {
      setAdvancedFilterError('Expression cannot be empty.');
      return;
    }
    const { predicate, error: compileError } = compileExpression<HealthRow>(expression);
    if (!predicate || compileError) {
      setAdvancedFilterError(compileError || 'Invalid expression.');
      showToast(`Advanced filter error: ${compileError || 'Invalid expression.'}`, 'error');
      return;
    }
    setAdvancedFilterExpression(expression);
    setAdvancedFilterPredicate(() => predicate);
    setAdvancedFilterEnabled(true);
    setAdvancedFilterError(null);
    setIsAdvancedFilterOpen(false);
  };

  const disableAdvancedFilter = () => {
    setAdvancedFilterEnabled(false);
    setAdvancedFilterPredicate(null);
    setAdvancedFilterError(null);
    setIsAdvancedFilterOpen(false);
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setStateFilter('all');
    setCountryFilter('all');
    setTypeFilter('all');
    setStatusFilter('all');
    setAdvancedFilterEnabled(false);
    setAdvancedFilterExpression('');
    setAdvancedFilterDraft('');
    setAdvancedFilterPredicate(null);
    setAdvancedFilterError(null);
  };

  const hasActiveFilters =
    searchQuery !== '' ||
    stateFilter !== 'all' ||
    countryFilter !== 'all' ||
    typeFilter !== 'all' ||
    statusFilter !== 'all' ||
    advancedFilterEnabled;

  const normalizedSearch = searchQuery.toLowerCase();

  const uniqueCountries = useMemo(
    () =>
      Array.from(
        new Set(
          healthRows
            .map((r) => r.device.account?.country)
            .filter((c): c is string => Boolean(c)),
        ),
      ).sort(),
    [healthRows],
  );

  const filteredRows = useMemo(() => {
    return sortedRows.filter((row) => {
      if (stateFilter !== 'all' && row.healthState !== stateFilter) return false;

      if (normalizedSearch) {
        const id = row.device.id.toLowerCase();
        const model = (row.device.device_model || '').toLowerCase();
        const ip = (row.device.static_ip || '').toLowerCase();
        const country = (row.device.account?.country || '').toLowerCase();
        const slot = getDeviceSlot(row.device);
        const slotStr = slot !== null ? String(slot) : '';
        if (
          !id.includes(normalizedSearch) &&
          !model.includes(normalizedSearch) &&
          !ip.includes(normalizedSearch) &&
          !country.includes(normalizedSearch) &&
          !slotStr.includes(normalizedSearch)
        )
          return false;
      }

      if (countryFilter !== 'all') {
        const deviceCountry = row.device.account?.country || '';
        if (countryFilter === 'none' ? deviceCountry : deviceCountry !== countryFilter) return false;
      }

      if (typeFilter !== 'all' && row.device.device_type !== typeFilter) return false;
      if (statusFilter !== 'all' && row.device.status !== statusFilter) return false;

      if (advancedFilterEnabled && advancedFilterPredicate && !advancedFilterPredicate(row))
        return false;

      return true;
    });
  }, [
    sortedRows,
    stateFilter,
    normalizedSearch,
    countryFilter,
    typeFilter,
    statusFilter,
    advancedFilterEnabled,
    advancedFilterPredicate,
  ]);

  const stateCounts = useMemo(() => {
    const counts = { all: healthRows.length, success: 0, failure: 0, unknown: 0 };
    for (const row of healthRows) counts[row.healthState]++;
    return counts;
  }, [healthRows]);

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
        </div>
      </div>

      {/* Health state pills */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        {(['all', 'success', 'failure', 'unknown'] as const).map((value) => {
          const isActive = stateFilter === value;
          const colorMap: Record<string, string> = {
            all: '#888',
            success: 'rgba(0,255,159,0.85)',
            failure: 'rgba(255,85,99,0.85)',
            unknown: 'rgba(255,255,255,0.5)',
          };
          const bgMap: Record<string, string> = {
            all: 'rgba(255,255,255,0.08)',
            success: 'rgba(0,255,159,0.12)',
            failure: 'rgba(255,85,99,0.12)',
            unknown: 'rgba(255,255,255,0.06)',
          };
          const activeBgMap: Record<string, string> = {
            all: 'rgba(255,255,255,0.18)',
            success: 'rgba(0,255,159,0.25)',
            failure: 'rgba(255,85,99,0.25)',
            unknown: 'rgba(255,255,255,0.15)',
          };
          return (
            <button
              key={value}
              onClick={() => setStateFilter(value)}
              style={{
                padding: '0.35rem 0.85rem',
                borderRadius: '999px',
                border: isActive ? `1px solid ${colorMap[value]}` : '1px solid transparent',
                background: isActive ? activeBgMap[value] : bgMap[value],
                color: isActive ? colorMap[value] : '#888',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: isActive ? 600 : 400,
                transition: 'all 0.15s ease',
              }}
            >
              {value === 'all' ? 'All' : value.charAt(0).toUpperCase() + value.slice(1)}{' '}
              <span style={{ opacity: 0.7 }}>({stateCounts[value]})</span>
            </button>
          );
        })}
      </div>

      {/* Filters bar */}
      <div style={{
        display: 'flex',
        gap: '0.75rem',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <input
          type="text"
          placeholder="Search by device, model, IP, country…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: '1 1 240px',
            padding: '0.55rem 0.8rem',
            border: 'var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(255,255,255,0.04)',
            color: 'var(--text)',
            fontSize: '0.9rem',
          }}
        />
        <select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          style={{
            padding: '0.55rem 0.8rem',
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
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{
            padding: '0.55rem 0.8rem',
            border: 'var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(255,255,255,0.04)',
            color: 'var(--text)',
            fontSize: '0.9rem',
          }}
        >
          <option value="all">All Types</option>
          <option value="iPhone">iPhone</option>
          <option value="iPad">iPad</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '0.55rem 0.8rem',
            border: 'var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(255,255,255,0.04)',
            color: 'var(--text)',
            fontSize: '0.9rem',
          }}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="ready">Ready</option>
          <option value="deployed">Deployed</option>
          <option value="broken">Broken</option>
          <option value="testing">Testing</option>
          <option value="lab_support">Lab Support</option>
        </select>
        <button
          onClick={openAdvancedFilterModal}
          style={{
            padding: '0.55rem 0.8rem',
            border: advancedFilterEnabled ? '1px solid rgba(0,229,255,0.35)' : 'var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: advancedFilterEnabled ? 'rgba(0,229,255,0.12)' : 'rgba(255,255,255,0.04)',
            color: advancedFilterEnabled ? '#00e5ff' : 'var(--text)',
            fontSize: '0.9rem',
            cursor: 'pointer',
          }}
        >
          {advancedFilterEnabled ? 'Advanced Filter On' : 'Advanced Filter'}
        </button>
        {advancedFilterEnabled && (
          <span
            title={advancedFilterExpression}
            style={{
              color: '#00e5ff',
              fontSize: '0.82rem',
              maxWidth: '280px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {advancedFilterExpression}
          </span>
        )}
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            style={{
              padding: '0.55rem 0.8rem',
              border: '1px solid rgba(255,85,99,0.35)',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255,85,99,0.10)',
              color: '#ff5563',
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Clear Filters
          </button>
        )}
        <span style={{ color: '#888', fontSize: '0.9rem' }}>
          {filteredRows.length} / {devices.length} devices
        </span>
      </div>

      {/* Advanced Filter Modal */}
      <Modal
        isOpen={isAdvancedFilterOpen}
        onClose={() => { setIsAdvancedFilterOpen(false); setAdvancedFilterError(null); }}
        title="Advanced Filter (JS Expression)"
      >
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{
            padding: '0.75rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(255,85,99,0.35)',
            background: 'rgba(255,85,99,0.12)',
            color: '#ff9aa3',
            fontSize: '0.88rem',
          }}>
            This mode executes raw JavaScript in your browser. Use only trusted expressions.
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="hc_advanced_filter_expression">Expression (runs against each health row)</label>
            <textarea
              id="hc_advanced_filter_expression"
              value={advancedFilterDraft}
              onChange={(e) => setAdvancedFilterDraft(e.target.value)}
              placeholder={`device.extra_data?.flag1 == 1\nhealthState === 'failure' && !lastSuccess\ndevice.status === 'deployed' && healthState !== 'success'`}
              rows={5}
              style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
            />
            <small>
              Examples: <code>device.status === 'deployed'</code>, <code>healthState === 'failure'</code>, <code>device.account?.country === 'US'</code>
            </small>
          </div>

          {advancedFilterError && (
            <div style={{
              padding: '0.65rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(255,85,99,0.35)',
              background: 'rgba(255,85,99,0.12)',
              color: '#ff9aa3',
              fontSize: '0.88rem',
            }}>
              {advancedFilterError}
            </div>
          )}

          <div style={{
            padding: '0.75rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(0,0,0,0.22)',
            fontSize: '0.82rem',
            color: '#9aa3ad',
          }}>
            Available fields: <code>device</code> (full device object), <code>healthState</code> (<code>'success'</code> | <code>'failure'</code> | <code>'unknown'</code>),
            {' '}<code>lastLog</code>, <code>lastSuccess</code>, <code>lastAssignment</code> (CrawlerLog objects with <code>log_ts</code>, <code>log_type</code>, <code>reason</code>).
            <br />
            Device sub-fields: <code>device.id</code>, <code>device.status</code>, <code>device.device_type</code>, <code>device.device_model</code>,
            {' '}<code>device.static_ip</code>, <code>device.account</code>, <code>device.extra_data</code>.
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { setIsAdvancedFilterOpen(false); setAdvancedFilterError(null); }}
            >
              Cancel
            </button>
            {advancedFilterEnabled && (
              <button
                type="button"
                className="btn-action"
                style={{ borderColor: '#ffb347', color: '#ffb347', background: 'rgba(255,179,71,0.15)' }}
                onClick={disableAdvancedFilter}
              >
                Disable Filter
              </button>
            )}
            <button type="button" className="btn-primary" onClick={applyAdvancedFilter}>
              Apply Filter
            </button>
          </div>
        </div>
      </Modal>

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
              {filteredRows.map((row) => (
                <tr key={row.device.id} style={{ ...renderRowStyle(row.healthState) }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                    {getDeviceSlot(row.device) !== null ? (
                      <>
                        <div>#{getDeviceSlot(row.device)}</div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 400, color: '#888', marginTop: '0.1rem' }}>{row.device.id}</div>
                      </>
                    ) : row.device.id}
                  </td>
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
