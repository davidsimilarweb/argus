'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { deviceApi, getDeviceSlot, type Device, type DeviceCrawlerLogs } from '../../lib/api';

type SortKey = 'device' | 'country' | 'successes';

export default function Throughput() {
  const [sortKey, setSortKey] = useState<SortKey>('successes');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const res = await deviceApi.getAll();
      return res.data;
    },
  });

  const { data: crawlerLogs = [], isLoading } = useQuery<DeviceCrawlerLogs[]>({
    queryKey: ['crawler-logs-throughput'],
    queryFn: async () => {
      const res = await deviceApi.getCrawlerLogsAll({ days: 2 });
      const data = res.data ?? [];
      if (!Array.isArray(data)) throw new Error('Invalid crawler logs response');
      return data;
    },
  });

  const rows = useMemo(() => {
    const deviceMap = new Map<string, Device>();
    for (const d of devices) deviceMap.set(d.id, d);
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;

    return crawlerLogs
      .filter((entry) => entry?.device_id)
      .map((entry) => {
        const logs = Array.isArray(entry.logs) ? entry.logs : [];
        const successes = logs.filter((l) => {
          if ((l.log_type ?? '').toLowerCase() !== 'success') return false;
          const ts = new Date(l.log_ts).getTime();
          return !Number.isNaN(ts) && ts >= cutoff;
        }).length;
        const device = deviceMap.get(entry.device_id);
        return {
          deviceId: entry.device_id,
          slot: device ? getDeviceSlot(device) : null,
          country: device?.account?.country ?? '',
          successes,
        };
      });
  }, [devices, crawlerLogs]);

  const totalSuccesses = useMemo(
    () => rows.reduce((sum, r) => sum + r.successes, 0),
    [rows],
  );

  const sortedRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      switch (sortKey) {
        case 'device': {
          const aLabel = a.slot !== null ? String(a.slot) : a.deviceId;
          const bLabel = b.slot !== null ? String(b.slot) : b.deviceId;
          return aLabel.localeCompare(bLabel, undefined, { numeric: true });
        }
        case 'country':
          return a.country.localeCompare(b.country);
        case 'successes':
          return a.successes - b.successes;
        default:
          return 0;
      }
    });
    return sortDir === 'desc' ? sorted.reverse() : sorted;
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'successes' ? 'desc' : 'asc');
    }
  };

  const SortIndicator = ({ col }: { col: SortKey }) => (
    <span
      style={{
        opacity: sortKey === col ? 0.9 : 0.3,
        marginLeft: '4px',
        fontSize: '0.75rem',
      }}
    >
      {sortKey === col ? (sortDir === 'asc' ? '▲' : '▼') : '▲'}
    </span>
  );

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <h2>Throughput</h2>
      </div>

      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card status-ready">
          <h3>Total Successes (24h)</h3>
          <p className="stat-number">
            {isLoading ? '…' : totalSuccesses.toLocaleString()}
          </p>
          <div className="stat-meta">{rows.length} devices reporting</div>
        </div>
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>
          Loading throughput data…
        </div>
      )}

      {!isLoading && (
        <div
          style={{
            overflowX: 'auto',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'separate',
              borderSpacing: 0,
            }}
          >
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '0.7rem 0.75rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                  onClick={() => toggleSort('device')}
                >
                  Device <SortIndicator col="device" />
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '0.7rem 0.75rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                  onClick={() => toggleSort('country')}
                >
                  Country <SortIndicator col="country" />
                </th>
                <th
                  style={{
                    textAlign: 'right',
                    padding: '0.7rem 0.75rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                  onClick={() => toggleSort('successes')}
                >
                  Successes (24h) <SortIndicator col="successes" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    style={{
                      padding: '2rem',
                      textAlign: 'center',
                      color: '#666',
                    }}
                  >
                    No throughput data available.
                  </td>
                </tr>
              )}
              {sortedRows.map((row) => (
                <tr key={row.deviceId}>
                  <td
                    style={{
                      padding: '0.6rem 0.75rem',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.slot !== null ? (
                      <>
                        <span>#{row.slot}</span>
                        <span
                          style={{
                            display: 'block',
                            fontSize: '0.75rem',
                            fontWeight: 400,
                            color: '#888',
                            marginTop: '0.05rem',
                          }}
                        >
                          {row.deviceId}
                        </span>
                      </>
                    ) : (
                      row.deviceId
                    )}
                  </td>
                  <td
                    style={{
                      padding: '0.6rem 0.75rem',
                      color: '#aaa',
                      fontSize: '0.88rem',
                    }}
                  >
                    {row.country || (
                      <span style={{ color: '#555' }}>—</span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: '0.6rem 0.75rem',
                      textAlign: 'right',
                      fontWeight: 600,
                      fontSize: '1.1rem',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <span
                      style={{
                        color:
                          row.successes > 0
                            ? 'rgba(0,255,159,0.85)'
                            : '#555',
                      }}
                    >
                      {row.successes}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
