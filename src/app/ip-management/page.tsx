'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { deviceApi, getDeviceSlot, type Device } from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import { useSettings } from '../../contexts/SettingsContext';

type SortField = 'ip' | 'device_id' | 'status' | 'model';
type SortDir = 'asc' | 'desc';

function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => acc * 256 + parseInt(octet, 10), 0);
}

export default function IpManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showUnassigned, setShowUnassigned] = useState(true);
  const [showAssigned, setShowAssigned] = useState(true);
  const [sortField, setSortField] = useState<SortField>('ip');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [editingIpValue, setEditingIpValue] = useState('');

  const queryClient = useQueryClient();
  const router = useRouter();
  const { showToast, ToastContainer } = useToast();
  const { baseIp } = useSettings();

  const { data: devices = [], isLoading, error } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const res = await deviceApi.getAll();
      return res.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, static_ip }: { id: string; static_ip: string | null }) =>
      deviceApi.update(id, { static_ip }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setEditingDeviceId(null);
      showToast(
        vars.static_ip
          ? `IP updated to ${vars.static_ip}`
          : 'IP address removed',
        'success'
      );
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || error.message;
      showToast(`Error updating IP: ${message}`, 'error');
    },
  });

  const extractIpSuffix = (fullIp: string | null): string => {
    if (!fullIp) return '';
    if (!baseIp) return fullIp;
    const prefix = baseIp + '.';
    return fullIp.startsWith(prefix) ? fullIp.slice(prefix.length) : fullIp;
  };

  const combineIp = (suffix: string): string | null => {
    if (!suffix.trim()) return null;
    if (!baseIp) return suffix.trim();
    return `${baseIp}.${suffix.trim()}`;
  };

  const handleEditStart = (device: Device) => {
    setEditingDeviceId(device.id);
    setEditingIpValue(extractIpSuffix(device.static_ip));
  };

  const handleEditSave = () => {
    if (!editingDeviceId) return;
    const newIp = combineIp(editingIpValue);
    updateMutation.mutate({ id: editingDeviceId, static_ip: newIp });
  };

  const handleEditCancel = () => {
    setEditingDeviceId(null);
    setEditingIpValue('');
  };

  const handleRemoveIp = (device: Device) => {
    if (!window.confirm(`Remove IP address from ${device.id}?`)) return;
    updateMutation.mutate({ id: device.id, static_ip: null });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedDevices = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const filtered = devices.filter(device => {
      const hasIp = !!device.static_ip;
      if (!showAssigned && hasIp) return false;
      if (!showUnassigned && !hasIp) return false;
      if (statusFilter !== 'all' && device.status !== statusFilter) return false;
      if (!q) return true;
      return (
        device.id.toLowerCase().includes(q) ||
        (device.static_ip ?? '').toLowerCase().includes(q) ||
        (device.device_model ?? '').toLowerCase().includes(q) ||
        (device.status ?? '').toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'ip') {
        const aIp = a.static_ip ?? '';
        const bIp = b.static_ip ?? '';
        if (!aIp && !bIp) cmp = 0;
        else if (!aIp) cmp = 1;
        else if (!bIp) cmp = -1;
        else {
          try { cmp = ipToInt(aIp) - ipToInt(bIp); } catch { cmp = aIp.localeCompare(bIp); }
        }
      } else if (sortField === 'device_id') {
        cmp = a.id.localeCompare(b.id, undefined, { numeric: true });
      } else if (sortField === 'status') {
        cmp = a.status.localeCompare(b.status);
      } else if (sortField === 'model') {
        cmp = (a.device_model ?? '').localeCompare(b.device_model ?? '');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [devices, searchQuery, statusFilter, showAssigned, showUnassigned, sortField, sortDir]);

  const stats = useMemo(() => {
    const withIp = devices.filter(d => d.static_ip).length;
    const withoutIp = devices.length - withIp;
    const uniqueIps = new Set(devices.map(d => d.static_ip).filter(Boolean));
    const duplicates = withIp - uniqueIps.size;
    return { withIp, withoutIp, total: devices.length, duplicates };
  }, [devices]);

  const duplicateIps = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of devices) {
      if (d.static_ip) counts[d.static_ip] = (counts[d.static_ip] ?? 0) + 1;
    }
    return new Set(Object.entries(counts).filter(([, c]) => c > 1).map(([ip]) => ip));
  }, [devices]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span style={{ opacity: 0.3, marginLeft: '0.3rem' }}>↕</span>;
    return <span style={{ color: 'var(--accent)', marginLeft: '0.3rem' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  if (isLoading) return <div>Loading devices...</div>;
  if (error) return <div>Error loading devices: {(error as Error).message}</div>;

  return (
    <>
      <ToastContainer />
      <div className="devices-page">
        <div className="page-header">
          <h2>IP Management</h2>
          <span style={{ color: '#888', fontSize: '0.9rem' }}>
            {stats.withIp} / {stats.total} devices with IPs assigned
          </span>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div style={statCardStyle('#00ff9f')}>
            <span style={{ fontSize: '1.6rem', fontWeight: 700, color: '#00ff9f' }}>{stats.withIp}</span>
            <span style={{ fontSize: '0.78rem', color: '#888', marginTop: '0.2rem' }}>Assigned</span>
          </div>
          <div style={statCardStyle('#ff9aa3')}>
            <span style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ff9aa3' }}>{stats.withoutIp}</span>
            <span style={{ fontSize: '0.78rem', color: '#888', marginTop: '0.2rem' }}>Unassigned</span>
          </div>
          {stats.duplicates > 0 && (
            <div style={statCardStyle('#ffb347')}>
              <span style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ffb347' }}>{stats.duplicates}</span>
              <span style={{ fontSize: '0.78rem', color: '#888', marginTop: '0.2rem' }}>Duplicate IPs</span>
            </div>
          )}
          {baseIp && (
            <div style={statCardStyle('rgba(0,229,255,0.7)')}>
              <span style={{ fontSize: '1rem', fontWeight: 600, color: '#00e5ff', fontFamily: 'monospace' }}>{baseIp}.*</span>
              <span style={{ fontSize: '0.78rem', color: '#888', marginTop: '0.2rem' }}>Base IP</span>
            </div>
          )}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search by device ID, IP, model..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={inputStyle}
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={selectStyle}
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
            onClick={() => setShowAssigned(v => !v)}
            style={{
              padding: '0.65rem 0.9rem',
              border: showAssigned ? '1px solid rgba(0,255,159,0.4)' : 'var(--border)',
              borderRadius: 'var(--radius-sm)',
              background: showAssigned ? 'rgba(0,255,159,0.08)' : 'rgba(255,255,255,0.04)',
              color: showAssigned ? '#00ff9f' : '#888',
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            With IP
          </button>
          <button
            onClick={() => setShowUnassigned(v => !v)}
            style={{
              padding: '0.65rem 0.9rem',
              border: showUnassigned ? '1px solid rgba(255,154,163,0.4)' : 'var(--border)',
              borderRadius: 'var(--radius-sm)',
              background: showUnassigned ? 'rgba(255,154,163,0.08)' : 'rgba(255,255,255,0.04)',
              color: showUnassigned ? '#ff9aa3' : '#888',
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            No IP
          </button>

          {(searchQuery || statusFilter !== 'all' || !showAssigned || !showUnassigned) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setShowAssigned(true);
                setShowUnassigned(true);
              }}
              style={{
                padding: '0.65rem 0.9rem',
                border: '1px solid rgba(255,85,99,0.35)',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255,85,99,0.10)',
                color: '#ff5563',
                fontSize: '0.88rem',
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          )}

          <span style={{ color: '#888', fontSize: '0.88rem', marginLeft: 'auto' }}>
            {sortedDevices.length} of {devices.length} devices
          </span>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle} onClick={() => handleSort('device_id')}>
                  Device <SortIcon field="device_id" />
                </th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Slot</th>
                <th style={thStyle} onClick={() => handleSort('ip')}>
                  IP Address <SortIcon field="ip" />
                </th>
                <th style={thStyle} onClick={() => handleSort('status')}>
                  Status <SortIcon field="status" />
                </th>
                <th style={thStyle} onClick={() => handleSort('model')}>
                  Model <SortIcon field="model" />
                </th>
                <th style={thStyle}>Account</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedDevices.map(device => {
                const isEditing = editingDeviceId === device.id;
                const isDuplicate = device.static_ip ? duplicateIps.has(device.static_ip) : false;
                const isSaving = updateMutation.isPending && editingDeviceId === device.id;

                return (
                  <tr key={device.id} style={rowStyle}>
                    <td style={tdStyle}>
                      <button
                        onClick={() => router.push(`/devices?device=${device.id}`)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent)',
                          cursor: 'pointer',
                          fontFamily: 'monospace',
                          fontSize: '0.92rem',
                          fontWeight: 600,
                          padding: 0,
                          textDecoration: 'underline dotted',
                        }}
                      >
                        {device.id}
                      </button>
                      <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.15rem' }}>
                        {device.device_type}
                      </div>
                    </td>

                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {getDeviceSlot(device) !== null ? (
                        <span style={{
                          fontFamily: 'monospace',
                          fontSize: '0.88rem',
                          color: '#aaa',
                        }}>
                          #{getDeviceSlot(device)}
                        </span>
                      ) : (
                        <span style={{ color: '#444', fontSize: '0.85rem' }}>—</span>
                      )}
                    </td>

                    <td style={tdStyle}>
                      {isEditing ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {baseIp && (
                            <span style={{ color: 'var(--muted)', fontFamily: 'monospace', fontSize: '0.88rem', whiteSpace: 'nowrap' }}>
                              {baseIp}.
                            </span>
                          )}
                          <input
                            autoFocus
                            value={editingIpValue}
                            onChange={e => setEditingIpValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleEditSave();
                              if (e.key === 'Escape') handleEditCancel();
                            }}
                            placeholder={baseIp ? '100' : '192.168.1.100'}
                            style={{
                              width: '100px',
                              padding: '0.3rem 0.5rem',
                              fontFamily: 'monospace',
                              fontSize: '0.88rem',
                              border: '1px solid var(--accent)',
                              borderRadius: 'var(--radius-sm)',
                              background: 'rgba(0,255,159,0.06)',
                              color: 'var(--text)',
                            }}
                          />
                        </div>
                      ) : device.static_ip ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.92rem', color: isDuplicate ? '#ffb347' : 'var(--text)' }}>
                            {device.static_ip}
                          </span>
                          {isDuplicate && (
                            <span title="Duplicate IP address" style={{
                              fontSize: '0.72rem',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '9999px',
                              background: 'rgba(255,179,71,0.18)',
                              border: '1px solid rgba(255,179,71,0.4)',
                              color: '#ffb347',
                            }}>
                              dup
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#555', fontSize: '0.85rem', fontStyle: 'italic' }}>—</span>
                      )}
                    </td>

                    <td style={tdStyle}>
                      <span className={`status-badge status-${device.status}`}>{device.status}</span>
                    </td>

                    <td style={tdStyle}>
                      <span style={{ color: '#aaa', fontSize: '0.88rem' }}>{device.device_model || '—'}</span>
                    </td>

                    <td style={tdStyle}>
                      {device.account ? (
                        <button
                          onClick={() => router.push(`/accounts?account=${device.account?.id}`)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#aaa',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            padding: 0,
                            textDecoration: 'underline dotted',
                          }}
                        >
                          {device.account.id}
                        </button>
                      ) : (
                        <span style={{ color: '#444', fontSize: '0.85rem' }}>—</span>
                      )}
                    </td>

                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <button
                            onClick={handleEditSave}
                            disabled={isSaving}
                            style={actionBtnStyle('#00ff9f')}
                          >
                            {isSaving ? '…' : 'Save'}
                          </button>
                          <button onClick={handleEditCancel} style={actionBtnStyle('#888')}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleEditStart(device)}
                            style={actionBtnStyle('rgba(0,229,255,0.8)')}
                          >
                            {device.static_ip ? 'Edit IP' : 'Assign IP'}
                          </button>
                          {device.static_ip && (
                            <button
                              onClick={() => handleRemoveIp(device)}
                              style={actionBtnStyle('#ff5563')}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sortedDevices.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: '#555', padding: '2.5rem' }}>
                    {devices.length === 0 ? 'No devices found.' : 'No devices match the current filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

const statCardStyle = (color: string) => ({
  display: 'flex' as const,
  flexDirection: 'column' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  padding: '0.85rem 1.25rem',
  borderRadius: 'var(--radius-sm)',
  border: `1px solid ${color}28`,
  background: `${color}08`,
  minWidth: '90px',
});

const inputStyle: React.CSSProperties = {
  flex: '1 1 260px',
  padding: '0.65rem 0.9rem',
  border: 'var(--border)',
  borderRadius: 'var(--radius-sm)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--text)',
  fontSize: '0.92rem',
};

const selectStyle: React.CSSProperties = {
  padding: '0.65rem 0.9rem',
  border: 'var(--border)',
  borderRadius: 'var(--radius-sm)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--text)',
  fontSize: '0.92rem',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.9rem',
};

const thStyle: React.CSSProperties = {
  padding: '0.7rem 1rem',
  textAlign: 'left',
  color: '#888',
  fontWeight: 600,
  fontSize: '0.8rem',
  letterSpacing: '0.04em',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  userSelect: 'none',
};

const tdStyle: React.CSSProperties = {
  padding: '0.7rem 1rem',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  verticalAlign: 'middle',
};

const rowStyle: React.CSSProperties = {
  transition: 'background 0.12s',
};

const actionBtnStyle = (color: string): React.CSSProperties => ({
  padding: '0.3rem 0.7rem',
  border: `1px solid ${color}55`,
  borderRadius: 'var(--radius-sm)',
  background: `${color}12`,
  color: color,
  fontSize: '0.82rem',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
});
