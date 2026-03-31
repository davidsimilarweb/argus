'use client';

import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { deviceApi, accountApi, getDeviceSlot, type Device, type DeviceType, type DeviceStatus } from '../../lib/api';
import { compileDeviceExpression } from '../../lib/deviceExpressionFilter';
import Modal from '../../components/Modal';
import Timeline from '../../components/Timeline';
import { useToast } from '../../hooks/useToast';
import { useSettings } from '../../contexts/SettingsContext';
import { QRCodeSVG } from 'qrcode.react';
import type { AxiosError } from 'axios';

export default function Devices() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [detailTab, setDetailTab] = useState<'info' | 'history' | 'qr'>('info');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);
  const [advancedFilterDraft, setAdvancedFilterDraft] = useState('');
  const [advancedFilterExpression, setAdvancedFilterExpression] = useState('');
  const [advancedFilterEnabled, setAdvancedFilterEnabled] = useState(false);
  const [advancedFilterError, setAdvancedFilterError] = useState<string | null>(null);
  const [advancedFilterPredicate, setAdvancedFilterPredicate] = useState<((device: Device) => boolean) | null>(null);
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast, ToastContainer } = useToast();
  const { availableModels, baseIp } = useSettings();

  const combineIp = (suffix: string): string | null => {
    if (!suffix) return null;
    if (!baseIp) return suffix;
    return `${baseIp}.${suffix}`;
  };

  const extractIpSuffix = (fullIp: string | null): string => {
    if (!fullIp) return '';
    if (!baseIp) return fullIp;
    const prefix = baseIp + '.';
    if (fullIp.startsWith(prefix)) {
      return fullIp.slice(prefix.length);
    }
    return fullIp;
  };

  const deviceIdFromUrl = searchParams?.get('device') ?? null;

  const { data: devices = [], isLoading, error } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const res = await deviceApi.getAll();
      return res.data;
    },
  });

  const { data: deviceDetail } = useQuery({
    queryKey: ['device', selectedDevice?.id],
    queryFn: async () => {
      if (!selectedDevice?.id) return null;
      const res = await deviceApi.getById(selectedDevice.id);
      return res.data;
    },
    enabled: !!selectedDevice?.id && isDetailsOpen,
  });

  const { data: deviceHistory, isLoading: isHistoryLoading, error: historyError } = useQuery({
    queryKey: ['device-history', selectedDevice?.id],
    queryFn: async () => {
      if (!selectedDevice?.id) return null;
      const res = await deviceApi.getHistory(selectedDevice.id);
      return res.data;
    },
    enabled: !!selectedDevice?.id && isDetailsOpen && detailTab === 'history',
  });

  const historyErrorMessage = (() => {
    if (!historyError) return null;
    const err = historyError as AxiosError<any>;
    const status = err.response?.status;
    const detail = err.response?.data?.detail || err.response?.data?.message || err.message;
    return status ? `${status}: ${detail}` : detail;
  })();

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await accountApi.getAll();
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof deviceApi.create>[0]) => deviceApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setIsModalOpen(false);
      showToast('Device created successfully!', 'success');
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || error.message;
      showToast(`Error creating device: ${message}`, 'error');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof deviceApi.update>[1] }) =>
      deviceApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['device', selectedDevice?.id] });
      setIsEditModalOpen(false);
      showToast('Device updated successfully!', 'success');
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || error.message;
      showToast(`Error updating device: ${message}`, 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deviceApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setIsDetailsOpen(false);
      setSelectedDevice(null);
      showToast('Device deleted successfully!', 'success');
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || error.message;
      showToast(`Error deleting device: ${message}`, 'error');
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const ipSuffix = (formData.get('static_ip_suffix') as string) || '';
    const extraDataStr = (formData.get('extra_data') as string) || '';
    const hostValue = (formData.get('host') as string) || '';
    const slotRaw = (formData.get('slot') as string) || '';
    
    let extra_data: Record<string, unknown> | null = null;
    if (extraDataStr.trim()) {
      try {
        extra_data = JSON.parse(extraDataStr);
      } catch {
        showToast('Invalid JSON in extra_data field', 'error');
        return;
      }
    }

    if (hostValue.trim()) {
      extra_data = { ...(extra_data ?? {}), host: hostValue.trim() };
    }

    const slotNum = slotRaw.trim() ? parseInt(slotRaw.trim(), 10) : NaN;
    if (!isNaN(slotNum)) {
      extra_data = { ...(extra_data ?? {}), slot: slotNum };
    }
    
    const data = {
      id: formData.get('id') as string,
      device_type: formData.get('device_type') as DeviceType,
      device_model: (formData.get('device_model') as string) || null,
      ios_version: (formData.get('ios_version') as string) || null,
      static_ip: combineIp(ipSuffix),
      status: (formData.get('status') as DeviceStatus) || 'pending',
      account_id: (formData.get('account_id') as string) || null,
      notes: (formData.get('notes') as string) || null,
      extra_data,
    };
    createMutation.mutate(data);
  };

  const handleEditSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedDevice) return;
    const formData = new FormData(e.currentTarget);
    const ipSuffix = (formData.get('static_ip_suffix') as string) || '';
    const extraDataStr = (formData.get('extra_data') as string) || '';
    const hostValue = (formData.get('host') as string) || '';
    const slotRaw = (formData.get('slot') as string) || '';
    
    let extra_data: Record<string, unknown> | null = null;
    if (extraDataStr.trim()) {
      try {
        extra_data = JSON.parse(extraDataStr);
      } catch {
        showToast('Invalid JSON in extra_data field', 'error');
        return;
      }
    }

    if (hostValue.trim()) {
      extra_data = { ...(extra_data ?? {}), host: hostValue.trim() };
    } else if (extra_data && 'host' in extra_data) {
      const { host: _removed, ...rest } = extra_data;
      extra_data = Object.keys(rest).length > 0 ? rest : null;
    }

    const slotNum = slotRaw.trim() ? parseInt(slotRaw.trim(), 10) : NaN;
    if (!isNaN(slotNum)) {
      extra_data = { ...(extra_data ?? {}), slot: slotNum };
    } else if (extra_data && 'slot' in extra_data) {
      const { slot: _removed, ...rest } = extra_data;
      extra_data = Object.keys(rest).length > 0 ? rest : null;
    }
    
    const data = {
      device_type: formData.get('device_type') as DeviceType,
      device_model: (formData.get('device_model') as string) || null,
      ios_version: (formData.get('ios_version') as string) || null,
      static_ip: combineIp(ipSuffix),
      status: formData.get('status') as DeviceStatus,
      account_id: (formData.get('account_id') as string) || null,
      notes: (formData.get('notes') as string) || null,
      extra_data,
    };
    updateMutation.mutate({ id: selectedDevice.id, data });
  };

  const handleDelete = () => {
    if (!selectedDevice) return;
    if (window.confirm(`Are you sure you want to delete device "${selectedDevice.id}"? This action cannot be undone.`)) {
      deleteMutation.mutate(selectedDevice.id);
    }
  };

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

    const { predicate, error: compileError } = compileDeviceExpression(expression);
    if (!predicate || compileError) {
      const message = compileError || 'Invalid expression.';
      setAdvancedFilterError(message);
      showToast(`Advanced filter error: ${message}`, 'error');
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

  useEffect(() => {
    if (deviceIdFromUrl && devices.length > 0) {
      const device = devices.find(d => d.id === deviceIdFromUrl);
      if (device) {
        setSelectedDevice(device);
        setIsDetailsOpen(true);
      } else {
        showToast(`Device with ID "${deviceIdFromUrl}" not found`, 'error');
        router.replace('/devices');
      }
    }
  }, [deviceIdFromUrl, devices, router, showToast]);

  const normalizedSearchQuery = searchQuery.toLowerCase();

  const matchesFiltersExceptCountry = (device: Device) => {
    const matchesSearch = searchQuery === '' ||
      device.id.toLowerCase().includes(normalizedSearchQuery) ||
      device.device_model?.toLowerCase().includes(normalizedSearchQuery) ||
      device.static_ip?.toLowerCase().includes(normalizedSearchQuery);

    const matchesStatus = statusFilter === 'all' || device.status === statusFilter;
    const matchesType = typeFilter === 'all' || device.device_type === typeFilter;
    const matchesAdvancedExpression =
      !advancedFilterEnabled ||
      !advancedFilterPredicate ||
      advancedFilterPredicate(device);

    return matchesSearch && matchesStatus && matchesType && matchesAdvancedExpression;
  };

  const uniqueCountries = Array.from(
    new Set(
      devices
        .map((device) => device.account?.country)
        .filter((country): country is string => Boolean(country))
    )
  ).sort();

  const devicesMatchingNonCountryFilters = devices.filter(matchesFiltersExceptCountry);

  const countryCounts = devicesMatchingNonCountryFilters.reduce((acc, device) => {
    const country = device.account?.country;
    if (country) {
      acc[country] = (acc[country] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const noCountryCount = devicesMatchingNonCountryFilters.filter((device) => !device.account?.country).length;

  const filteredDevices = devicesMatchingNonCountryFilters.filter((device) => {
    const matchesCountry = countryFilter === 'all' ||
      (countryFilter === 'none' ? !device.account?.country : device.account?.country === countryFilter);
    return matchesCountry;
  });

  const sortedDevices = [...filteredDevices].sort((a, b) => {
    const slotA = getDeviceSlot(a);
    const slotB = getDeviceSlot(b);
    if (slotA !== null && slotB !== null) return slotA - slotB;
    if (slotA !== null) return -1;
    if (slotB !== null) return 1;
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });

  const computeNextSerial = () => {
    let maxNum = 0;
    for (const d of devices) {
      const match = /^ARG-(\d+)$/.exec(d.id);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!Number.isNaN(num) && num > maxNum) maxNum = num;
      }
    }
    const next = String(maxNum + 1).padStart(3, '0');
    return `ARG-${next}`;
  };

  const buildTimelineEvents = () => {
    if (!deviceHistory?.history) return [];

    return deviceHistory.history.map((entry) => {
      let icon = '📝';
      let title = `${entry.change_type} changed`;

      switch (entry.change_type) {
        case 'created':
          icon = '✨';
          title = 'Device created';
          break;
        case 'status':
          icon = '📊';
          title = `Status changed to ${entry.new_value}`;
          break;
        case 'account_id':
          icon = '👤';
          title = entry.new_value ? `Account assigned: ${entry.new_value}` : 'Account unassigned';
          break;
        case 'ios_version':
          icon = '📱';
          title = `iOS version changed to ${entry.new_value}`;
          break;
        case 'device_model':
          icon = '🔧';
          title = `Model changed to ${entry.new_value}`;
          break;
        case 'notes':
          icon = '📝';
          title = 'Notes updated';
          break;
      }

      return {
        type: entry.change_type,
        timestamp: entry.changed_at,
        title,
        description: entry.notes || (entry.old_value ? `Previous: ${entry.old_value}` : undefined),
        icon,
      };
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  if (isLoading) return <div>Loading devices...</div>;
  if (error) return <div>Error loading devices: {(error as Error).message}</div>;

  return (
    <>
      <ToastContainer />
      <div className="devices-page">
        <div className="page-header">
          <h2>Devices</h2>
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>Add Device</button>
        </div>

        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <input
            type="text"
            placeholder="Search by serial, model, or IP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: '1 1 300px',
              padding: '0.65rem 0.9rem',
              border: 'var(--border)',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--text)',
              fontSize: '0.95rem'
            }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '0.65rem 0.9rem',
              border: 'var(--border)',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--text)',
              fontSize: '0.95rem'
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
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{
              padding: '0.65rem 0.9rem',
              border: 'var(--border)',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--text)',
              fontSize: '0.95rem'
            }}
          >
            <option value="all">All Types</option>
            <option value="iPhone">iPhone</option>
            <option value="iPad">iPad</option>
          </select>
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            style={{
              padding: '0.65rem 0.9rem',
              border: 'var(--border)',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--text)',
              fontSize: '0.95rem'
            }}
          >
            <option value="all">All Countries</option>
            <option value="none">No Country ({noCountryCount})</option>
            {uniqueCountries.map((country) => (
              <option key={country} value={country}>{country} ({countryCounts[country] ?? 0})</option>
            ))}
          </select>
          <button
            onClick={openAdvancedFilterModal}
            style={{
              padding: '0.65rem 0.9rem',
              border: advancedFilterEnabled ? '1px solid rgba(0,229,255,0.35)' : 'var(--border)',
              borderRadius: 'var(--radius-sm)',
              background: advancedFilterEnabled ? 'rgba(0,229,255,0.12)' : 'rgba(255,255,255,0.04)',
              color: advancedFilterEnabled ? '#00e5ff' : 'var(--text)',
              fontSize: '0.95rem',
              cursor: 'pointer'
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
                maxWidth: '320px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {advancedFilterExpression}
            </span>
          )}
          {(searchQuery || statusFilter !== 'all' || typeFilter !== 'all' || countryFilter !== 'all' || advancedFilterEnabled) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setTypeFilter('all');
                setCountryFilter('all');
                setAdvancedFilterEnabled(false);
                setAdvancedFilterExpression('');
                setAdvancedFilterDraft('');
                setAdvancedFilterPredicate(null);
                setAdvancedFilterError(null);
              }}
              style={{
                padding: '0.65rem 0.9rem',
                border: '1px solid rgba(255,85,99,0.35)',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255,85,99,0.10)',
                color: '#ff5563',
                fontSize: '0.95rem',
                cursor: 'pointer'
              }}
            >
              Clear Filters
            </button>
          )}
          <span style={{ color: '#888', fontSize: '0.9rem' }}>
          {sortedDevices.length} of {devices.length} devices
          </span>
        </div>

        <Modal
          isOpen={isAdvancedFilterOpen}
          onClose={() => {
            setIsAdvancedFilterOpen(false);
            setAdvancedFilterError(null);
          }}
          title="Advanced Filter (Unsafe JS)"
        >
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{
              padding: '0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(255,85,99,0.35)',
              background: 'rgba(255,85,99,0.12)',
              color: '#ff9aa3',
              fontSize: '0.88rem'
            }}>
              This mode executes raw JavaScript in your browser. Use only trusted expressions.
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="advanced_filter_expression">Expression (runs against each device object)</label>
              <textarea
                id="advanced_filter_expression"
                value={advancedFilterDraft}
                onChange={(e) => setAdvancedFilterDraft(e.target.value)}
                placeholder={`extra_data?.flag1 == 1\nstatus === 'ready' && extra_data?.region === 'US'`}
                rows={5}
                style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              />
              <small>
                Examples: <code>extra_data?.flag1 == 1</code>, <code>status === 'ready'</code>, <code>account?.country === 'US'</code>
              </small>
            </div>

            {advancedFilterError && (
              <div style={{
                padding: '0.65rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(255,85,99,0.35)',
                background: 'rgba(255,85,99,0.12)',
                color: '#ff9aa3',
                fontSize: '0.88rem'
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
              color: '#9aa3ad'
            }}>
              Available fields: <code>id</code>, <code>status</code>, <code>device_type</code>, <code>device_model</code>, <code>static_ip</code>, <code>account</code>, <code>extra_data</code>, <code>created_at</code>, <code>updated_at</code>.
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setIsAdvancedFilterOpen(false);
                  setAdvancedFilterError(null);
                }}
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

        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Device">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="id">Device Serial *</label>
              <input type="text" id="id" name="id" required placeholder="ARG-001" defaultValue={computeNextSerial()} />
              <small>Unique identifier for this device</small>
            </div>

            <div className="form-group">
              <label htmlFor="device_type">Device Type *</label>
              <select id="device_type" name="device_type" required defaultValue="iPhone">
                <option value="iPhone">iPhone</option>
                <option value="iPad">iPad</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="device_model">Model</label>
              <select id="device_model" name="device_model">
                <option value="">Select model...</option>
                {availableModels.map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="ios_version">iOS Version</label>
              <input type="text" id="ios_version" name="ios_version" placeholder="17.4.1" />
            </div>

            <div className="form-group">
              <label htmlFor="static_ip_suffix">Static IP</label>
              {baseIp ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--muted)', fontFamily: 'monospace' }}>{baseIp}.</span>
                  <input 
                    type="text" 
                    id="static_ip_suffix" 
                    name="static_ip_suffix" 
                    placeholder={baseIp.split('.').length === 3 ? '100' : baseIp.split('.').length === 2 ? '0.100' : '168.0.100'}
                    style={{ flex: 1 }}
                  />
                </div>
              ) : (
                <input type="text" id="static_ip_suffix" name="static_ip_suffix" placeholder="192.168.1.100" />
              )}
              <small>
                {baseIp 
                  ? `Full IP will be: ${baseIp}.[your input]` 
                  : 'Configure base IP in Settings for faster entry'}
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue="pending">
                <option value="pending">Pending</option>
                <option value="ready">Ready</option>
                <option value="deployed">Deployed</option>
                <option value="broken">Broken</option>
                <option value="testing">Testing</option>
                <option value="lab_support">Lab Support</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="account_id">Account</label>
              <select id="account_id" name="account_id">
                <option value="">No account assigned</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.id} ({account.country || 'No country'})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="host">Host</label>
              <input type="text" id="host" name="host" placeholder="mac-lab-1" />
              <small>Mac or machine this device is connected to (stored in extra_data.host)</small>
            </div>

            <div className="form-group">
              <label htmlFor="slot">Slot</label>
              <input type="number" id="slot" name="slot" placeholder="5" min="1" />
              <small>Physical slot number for this device (stored in extra_data.slot)</small>
            </div>

            <div className="form-group">
              <label htmlFor="notes">Notes</label>
              <textarea id="notes" name="notes" placeholder="Additional notes..."></textarea>
            </div>

            <div className="form-group">
              <label htmlFor="extra_data">Extra data (JSON)</label>
              <textarea 
                id="extra_data" 
                name="extra_data" 
                placeholder='{"sslkilswitch_enabled": true, "hardware_revision": "v2.1"}'
                rows={4}
                style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              ></textarea>
              <small>Optional JSON object for custom fields</small>
            </div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Device'}
              </button>
            </div>
          </form>
        </Modal>

        <div className="card-grid">
          {sortedDevices.map((device) => (
            <div
              key={device.id}
              className="device-card"
              onClick={() => { setSelectedDevice(device); setIsDetailsOpen(true); }}
            >
              <div className="device-card-header">
                <div className="device-id">
                  {getDeviceSlot(device) !== null ? (
                    <>
                      <span>#{getDeviceSlot(device)}</span>
                      <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 400, color: '#888', marginTop: '0.1rem' }}>{device.id}</span>
                    </>
                  ) : device.id}
                </div>
                <span className={`status-badge status-${device.status}`}>{device.status}</span>
              </div>
              <div className="device-meta" style={{ marginTop: '0.5rem' }}>
                <span className={`pill ${device.device_type === 'iPhone' ? 'pill-iphone' : 'pill-ipad'}`}>
                  {device.device_type}
                </span>
                {device.device_model && (
                  <span className="pill">{device.device_model}</span>
                )}
              </div>
            </div>
          ))}
          {sortedDevices.length === 0 && (
            <div className="device-card" style={{ gridColumn: '1/-1', textAlign: 'center' }}>
              {devices.length === 0 ? 'No devices found. Add your first device to get started.' : 'No devices match the current filters.'}
            </div>
          )}
        </div>

        <Modal
          isOpen={isDetailsOpen && !!selectedDevice}
          onClose={() => { setIsDetailsOpen(false); setDetailTab('info'); }}
          title={selectedDevice ? (getDeviceSlot(selectedDevice) !== null ? `Slot #${getDeviceSlot(selectedDevice)} — ${selectedDevice.id}` : `Device ${selectedDevice.id}`) : 'Device'}
        >
          {selectedDevice && (
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                {(['info', 'history', 'qr'] as const).map((tab) => (
                  <button
                    key={tab}
                    className={`tab-button ${detailTab === tab ? 'active' : ''}`}
                    onClick={() => setDetailTab(tab)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: detailTab === tab ? 'rgba(0,255,159,0.1)' : 'transparent',
                      border: 'none',
                      borderBottom: detailTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                      color: detailTab === tab ? 'var(--accent)' : '#888',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                    }}
                  >
                    {tab === 'info' ? 'Details' : tab === 'history' ? 'History' : 'QR Code'}
                  </button>
                ))}
              </div>

              {detailTab === 'info' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <div className="device-meta"><strong>Status:</strong>&nbsp;<span className={`status-badge status-${deviceDetail?.status || selectedDevice.status}`}>{deviceDetail?.status || selectedDevice.status}</span></div>
                      <div className="device-meta"><strong>Serial:</strong>&nbsp;{selectedDevice.id}</div>
                      <div className="device-meta"><strong>Slot:</strong>&nbsp;{getDeviceSlot(deviceDetail ?? selectedDevice) !== null ? `#${getDeviceSlot(deviceDetail ?? selectedDevice)}` : '—'}</div>
                      <div className="device-meta"><strong>Type:</strong>&nbsp;{deviceDetail?.device_type || selectedDevice.device_type}</div>
                      <div className="device-meta"><strong>Model:</strong>&nbsp;{deviceDetail?.device_model || selectedDevice.device_model || '-'}</div>
                      <div className="device-meta"><strong>iOS:</strong>&nbsp;{deviceDetail?.ios_version || selectedDevice.ios_version || '-'}</div>
                      <div className="device-meta"><strong>Static IP:</strong>&nbsp;{deviceDetail?.static_ip || selectedDevice.static_ip || '-'}</div>
                    </div>
                    <div>
                      <div className="device-meta">
                        <strong>Account:</strong>&nbsp;
                        {(deviceDetail?.account || selectedDevice.account) ? (
                          <span
                            style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={() => router.push(`/accounts?account=${deviceDetail?.account?.id || selectedDevice.account?.id}`)}
                          >
                            {deviceDetail?.account?.id || selectedDevice.account?.id}
                          </span>
                        ) : '-'}
                      </div>
                      <div className="device-meta">
                        <strong>Host:</strong>&nbsp;
                        {((deviceDetail?.extra_data ?? selectedDevice.extra_data) as Record<string, unknown> | null)?.host as string | undefined || '-'}
                      </div>
                      <div className="device-meta"><strong>Notes:</strong>&nbsp;{deviceDetail?.notes || selectedDevice.notes || '-'}</div>
                      <div className="device-meta"><strong>Created:</strong>&nbsp;{new Date(selectedDevice.created_at).toLocaleString()}</div>
                      <div className="device-meta"><strong>Updated:</strong>&nbsp;{new Date(selectedDevice.updated_at).toLocaleString()}</div>
                    </div>
                  </div>

                  {(deviceDetail?.extra_data || selectedDevice.extra_data) && Object.keys(deviceDetail?.extra_data || selectedDevice.extra_data || {}).length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                      <div className="device-meta" style={{ marginBottom: '0.5rem' }}><strong>Extra data:</strong></div>
                      <pre style={{
                        background: 'rgba(0,0,0,0.3)',
                        padding: '1rem',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.85rem',
                        overflow: 'auto',
                        maxHeight: '200px',
                        color: 'var(--text)',
                        fontFamily: 'monospace',
                      }}>
                        {JSON.stringify(deviceDetail?.extra_data || selectedDevice.extra_data, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div className="form-actions" style={{ marginTop: '1.5rem' }}>
                    <button type="button" className="btn-primary" onClick={() => { setIsDetailsOpen(false); setIsEditModalOpen(true); }}>
                      Edit Device
                    </button>
                    <button
                      type="button"
                      className="btn-action"
                      style={{ background: 'rgba(255,85,99,0.15)', borderColor: '#ff5563', color: '#ff5563' }}
                      onClick={handleDelete}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? 'Deleting...' : '🗑️ Delete Device'}
                    </button>
                  </div>
                </>
              )}

              {detailTab === 'history' && (
                <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                  {isHistoryLoading && (
                    <div style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>
                      Loading history…
                    </div>
                  )}

                  {historyErrorMessage && (
                    <div style={{
                      padding: '1rem',
                      marginBottom: '1rem',
                      background: 'rgba(255,85,99,0.15)',
                      border: '1px solid rgba(255,85,99,0.4)',
                      borderRadius: 'var(--radius-sm)',
                      color: '#ff5563',
                      fontSize: '0.9rem',
                    }}>
                      <strong>Failed to load history.</strong>
                      <div style={{ marginTop: '0.5rem', color: '#ff9aa3' }}>{historyErrorMessage}</div>
                    </div>
                  )}

                  {!isHistoryLoading && !historyErrorMessage && (
                    <>
                      <Timeline events={buildTimelineEvents()} />
                      {(!deviceHistory?.history || deviceHistory.history.length === 0) && (
                        <div style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>
                          No history available for this device.
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {detailTab === 'qr' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', padding: '2rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{ color: 'var(--accent)', marginBottom: '0.5rem' }}>
                      {selectedDevice.id}
                    </h3>
                    <p style={{ color: '#888', fontSize: '0.9rem' }}>
                      Scan this QR code to open this device's details
                    </p>
                  </div>

                  <div
                    id={`qr-code-${selectedDevice.id}`}
                    style={{
                      padding: '2rem',
                      background: 'white',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                    }}
                  >
                    <QRCodeSVG
                      value={selectedDevice.id}
                      size={256}
                      level="H"
                      includeMargin={false}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                      className="btn-primary"
                      onClick={() => {
                        const qrElement = document.getElementById(`qr-code-${selectedDevice.id}`);
                        if (qrElement) {
                          const svg = qrElement.querySelector('svg');
                          if (svg) {
                            const svgData = new XMLSerializer().serializeToString(svg);
                            const canvas = document.createElement('canvas');
                            canvas.width = 256;
                            canvas.height = 256;
                            const ctx = canvas.getContext('2d');
                            const img = new Image();
                            img.onload = () => {
                              ctx!.fillStyle = 'white';
                              ctx!.fillRect(0, 0, 256, 256);
                              ctx!.drawImage(img, 0, 0);
                              const pngFile = canvas.toDataURL('image/png');
                              const downloadLink = document.createElement('a');
                              downloadLink.download = `qr-${selectedDevice.id}.png`;
                              downloadLink.href = pngFile;
                              downloadLink.click();
                            };
                            img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
                          }
                        }
                      }}
                    >
                      Download QR Code
                    </button>

                    <button
                      className="btn-action"
                      onClick={() => {
                        const printWindow = window.open('', '', 'width=600,height=600');
                        if (printWindow) {
                          printWindow.document.write(`
                            <html>
                              <head>
                                <title>QR Code - ${selectedDevice.id}</title>
                                <style>
                                  body {
                                    display: flex;
                                    flex-direction: column;
                                    align-items: center;
                                    justify-content: center;
                                    height: 100vh;
                                    margin: 0;
                                    font-family: system-ui, -apple-system, sans-serif;
                                  }
                                  h1 { font-size: 2rem; margin-bottom: 0.5rem; color: #000; }
                                  .qr-container { padding: 1rem; background: white; border: 2px solid #000; }
                                  @media print { body { height: auto; } }
                                </style>
                              </head>
                              <body>
                                <h1>${selectedDevice.id}</h1>
                                <div class="qr-container">
                                  ${document.getElementById(`qr-code-${selectedDevice.id}`)?.innerHTML || ''}
                                </div>
                              </body>
                            </html>
                          `);
                          printWindow.document.close();
                          printWindow.focus();
                          setTimeout(() => {
                            printWindow.print();
                            printWindow.close();
                          }, 250);
                        }
                      }}
                    >
                      Print QR Label
                    </button>
                  </div>

                  <div style={{
                    padding: '1rem',
                    background: 'rgba(0,229,255,0.1)',
                    border: '1px solid rgba(0,229,255,0.3)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    color: '#00e5ff',
                    maxWidth: '400px',
                    textAlign: 'center'
                  }}>
                    💡 Tip: Print this QR code and stick it on the physical device. Use the Scan page to scan and open this device's details.
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>

        <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Device">
          <form onSubmit={handleEditSubmit}>
            <div className="form-group">
              <label>Device Serial</label>
              <input type="text" value={selectedDevice?.id || ''} disabled style={{ opacity: 0.6 }} />
              <small>Device serial cannot be changed</small>
            </div>

            <div className="form-group">
              <label htmlFor="device_type">Device Type *</label>
              <select id="device_type" name="device_type" required defaultValue={selectedDevice?.device_type || 'iPhone'}>
                <option value="iPhone">iPhone</option>
                <option value="iPad">iPad</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="status">Status *</label>
              <select id="status" name="status" required defaultValue={selectedDevice?.status || 'pending'}>
                <option value="pending">Pending</option>
                <option value="ready">Ready</option>
                <option value="deployed">Deployed</option>
                <option value="broken">Broken</option>
                <option value="testing">Testing</option>
                <option value="lab_support">Lab Support</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="account_id">Account</label>
              <select
                id="account_id"
                name="account_id"
                defaultValue={selectedDevice?.account_id ?? selectedDevice?.account?.id ?? ''}
              >
                <option value="">No account assigned</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.id}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="device_model">Model</label>
              <select id="device_model" name="device_model" defaultValue={selectedDevice?.device_model || ''}>
                <option value="">Select model...</option>
                {availableModels.map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="ios_version">iOS Version</label>
              <input type="text" id="ios_version" name="ios_version" placeholder="17.4.1" defaultValue={selectedDevice?.ios_version || ''} />
            </div>

            <div className="form-group">
              <label htmlFor="static_ip_suffix">Static IP</label>
              {baseIp ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--muted)', fontFamily: 'monospace' }}>{baseIp}.</span>
                  <input 
                    type="text" 
                    id="static_ip_suffix" 
                    name="static_ip_suffix" 
                    placeholder={baseIp.split('.').length === 3 ? '100' : baseIp.split('.').length === 2 ? '0.100' : '168.0.100'}
                    defaultValue={extractIpSuffix(selectedDevice?.static_ip || null)}
                    style={{ flex: 1 }}
                  />
                </div>
              ) : (
                <input 
                  type="text" 
                  id="static_ip_suffix" 
                  name="static_ip_suffix" 
                  placeholder="192.168.1.100" 
                  defaultValue={selectedDevice?.static_ip || ''} 
                />
              )}
            </div>

            <div className="form-group">
              <label htmlFor="host">Host</label>
              <input
                type="text"
                id="host"
                name="host"
                placeholder="mac-lab-1"
                defaultValue={(selectedDevice?.extra_data as Record<string, unknown> | null)?.host as string | undefined || ''}
              />
              <small>Mac or machine this device is connected to (stored in extra_data.host)</small>
            </div>

            <div className="form-group">
              <label htmlFor="slot">Slot</label>
              <input
                type="number"
                id="slot"
                name="slot"
                placeholder="5"
                min="1"
                defaultValue={getDeviceSlot(selectedDevice ?? {}) ?? ''}
              />
              <small>Physical slot number for this device (stored in extra_data.slot)</small>
            </div>

            <div className="form-group">
              <label htmlFor="notes">Notes</label>
              <textarea id="notes" name="notes" placeholder="Additional notes..." defaultValue={selectedDevice?.notes || ''}></textarea>
            </div>

            <div className="form-group">
              <label htmlFor="extra_data">Extra data (JSON)</label>
              <textarea 
                id="extra_data" 
                name="extra_data" 
                placeholder='{"sslkilswitch_enabled": true}'
                defaultValue={selectedDevice?.extra_data ? JSON.stringify(selectedDevice.extra_data, null, 2) : ''}
                rows={5}
                style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              ></textarea>
            </div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </>
  );
}
