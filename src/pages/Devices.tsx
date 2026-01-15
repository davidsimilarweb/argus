import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { deviceApi, accountApi, type Device, type DeviceType, type DeviceStatus } from '../lib/api';
import Modal from '../components/Modal';
import Timeline from '../components/Timeline';
import { useToast } from '../hooks/useToast';
import { useSettings } from '../contexts/SettingsContext';
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
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast, ToastContainer } = useToast();
  const { availableModels, baseIp } = useSettings();

  // Helper to combine base IP with suffix
  const combineIp = (suffix: string): string | null => {
    if (!suffix) return null;
    if (!baseIp) return suffix; // No base IP configured, use full value
    return `${baseIp}.${suffix}`;
  };

  // Helper to extract suffix from full IP
  const extractIpSuffix = (fullIp: string | null): string => {
    if (!fullIp) return '';
    if (!baseIp) return fullIp; // No base IP configured, return full value
    const prefix = baseIp + '.';
    if (fullIp.startsWith(prefix)) {
      return fullIp.slice(prefix.length);
    }
    return fullIp; // IP doesn't match base, return full value
  };

  // Check if we should open a specific device from URL params
  const deviceIdFromUrl = searchParams.get('device');

  // Fetch all devices
  const { data: devices = [], isLoading, error } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const res = await deviceApi.getAll();
      return res.data;
    },
  });

  // Fetch device detail with full info when selected
  const { data: deviceDetail } = useQuery({
    queryKey: ['device', selectedDevice?.id],
    queryFn: async () => {
      if (!selectedDevice?.id) return null;
      const res = await deviceApi.getById(selectedDevice.id);
      return res.data;
    },
    enabled: !!selectedDevice?.id && isDetailsOpen,
  });

  // Fetch device history
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

  // Fetch all accounts for the dropdown
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
    
    // Parse extra_data JSON if provided
    let extra_data = null;
    if (extraDataStr.trim()) {
      try {
        extra_data = JSON.parse(extraDataStr);
      } catch {
        showToast('Invalid JSON in extra_data field', 'error');
        return;
      }
    }
    
    const data = {
      id: formData.get('id') as string,
      device_type: formData.get('device_type') as DeviceType,
      device_model: (formData.get('device_model') as string) || null,
      ios_version: (formData.get('ios_version') as string) || null,
      static_ip: combineIp(ipSuffix),
      current_status: (formData.get('current_status') as DeviceStatus) || 'pending',
      current_account_id: (formData.get('current_account_id') as string) || null,
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
    
    // Parse extra_data JSON if provided
    let extra_data = null;
    if (extraDataStr.trim()) {
      try {
        extra_data = JSON.parse(extraDataStr);
      } catch {
        showToast('Invalid JSON in extra_data field', 'error');
        return;
      }
    }
    
    const data = {
      device_type: formData.get('device_type') as DeviceType,
      device_model: (formData.get('device_model') as string) || null,
      ios_version: (formData.get('ios_version') as string) || null,
      static_ip: combineIp(ipSuffix),
      current_status: formData.get('current_status') as DeviceStatus,
      current_account_id: (formData.get('current_account_id') as string) || null,
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

  // Open device modal if device ID is in URL
  useEffect(() => {
    if (deviceIdFromUrl && devices.length > 0) {
      const device = devices.find(d => d.id === deviceIdFromUrl);
      if (device) {
        setSelectedDevice(device);
        setIsDetailsOpen(true);
      } else {
        showToast(`Device with ID "${deviceIdFromUrl}" not found`, 'error');
        navigate('/devices', { replace: true });
      }
    }
  }, [deviceIdFromUrl, devices, navigate, showToast]);

  // Get unique countries from devices' assigned accounts with counts
  const countryCounts = devices.reduce((acc, device) => {
    const country = device.account?.country;
    if (country) {
      acc[country] = (acc[country] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const uniqueCountries = Object.keys(countryCounts).sort();
  const noCountryCount = devices.filter(d => !d.account?.country).length;

  // Filter devices based on search and filter criteria
  const filteredDevices = devices.filter((device) => {
    const matchesSearch = searchQuery === '' ||
      device.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.device_model?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.static_ip?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || device.current_status === statusFilter;
    const matchesType = typeFilter === 'all' || device.device_type === typeFilter;
    const matchesCountry = countryFilter === 'all' ||
      (countryFilter === 'none' ? !device.account?.country : device.account?.country === countryFilter);

    return matchesSearch && matchesStatus && matchesType && matchesCountry;
  });

  // Compute next serial number suggestion
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

  // Build timeline events from history
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
        case 'account':
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

        {/* Search and Filter Controls */}
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
              <option key={country} value={country}>{country} ({countryCounts[country]})</option>
            ))}
          </select>
          {(searchQuery || statusFilter !== 'all' || typeFilter !== 'all' || countryFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setTypeFilter('all');
                setCountryFilter('all');
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
            {filteredDevices.length} of {devices.length} devices
          </span>
        </div>

        {/* Add Device Modal */}
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
              <label htmlFor="current_status">Status</label>
              <select id="current_status" name="current_status" defaultValue="pending">
                <option value="pending">Pending</option>
                <option value="ready">Ready</option>
                <option value="deployed">Deployed</option>
                <option value="broken">Broken</option>
                <option value="testing">Testing</option>
                <option value="lab_support">Lab Support</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="current_account_id">Account</label>
              <select id="current_account_id" name="current_account_id">
                <option value="">No account assigned</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.id} ({account.country || 'No country'})
                  </option>
                ))}
              </select>
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

        {/* Device Cards Grid */}
        <div className="card-grid">
          {filteredDevices.map((device) => (
            <div
              key={device.id}
              className="device-card"
              onClick={() => { setSelectedDevice(device); setIsDetailsOpen(true); }}
            >
              <div className="device-card-header">
                <div className="device-id">{device.id}</div>
                <span className={`status-badge status-${device.current_status}`}>{device.current_status}</span>
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
          {filteredDevices.length === 0 && (
            <div className="device-card" style={{ gridColumn: '1/-1', textAlign: 'center' }}>
              {devices.length === 0 ? 'No devices found. Add your first device to get started.' : 'No devices match the current filters.'}
            </div>
          )}
        </div>

        {/* Device Details Modal */}
        <Modal
          isOpen={isDetailsOpen && !!selectedDevice}
          onClose={() => { setIsDetailsOpen(false); setDetailTab('info'); }}
          title={selectedDevice ? `Device ${selectedDevice.id}` : 'Device'}
        >
          {selectedDevice && (
            <div>
              {/* Tabs */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <button
                  className={`tab-button ${detailTab === 'info' ? 'active' : ''}`}
                  onClick={() => setDetailTab('info')}
                  style={{
                    padding: '0.5rem 1rem',
                    background: detailTab === 'info' ? 'rgba(0,255,159,0.1)' : 'transparent',
                    border: 'none',
                    borderBottom: detailTab === 'info' ? '2px solid var(--accent)' : '2px solid transparent',
                    color: detailTab === 'info' ? 'var(--accent)' : '#888',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  Details
                </button>
                <button
                  className={`tab-button ${detailTab === 'history' ? 'active' : ''}`}
                  onClick={() => setDetailTab('history')}
                  style={{
                    padding: '0.5rem 1rem',
                    background: detailTab === 'history' ? 'rgba(0,255,159,0.1)' : 'transparent',
                    border: 'none',
                    borderBottom: detailTab === 'history' ? '2px solid var(--accent)' : '2px solid transparent',
                    color: detailTab === 'history' ? 'var(--accent)' : '#888',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  History
                </button>
                <button
                  className={`tab-button ${detailTab === 'qr' ? 'active' : ''}`}
                  onClick={() => setDetailTab('qr')}
                  style={{
                    padding: '0.5rem 1rem',
                    background: detailTab === 'qr' ? 'rgba(0,255,159,0.1)' : 'transparent',
                    border: 'none',
                    borderBottom: detailTab === 'qr' ? '2px solid var(--accent)' : '2px solid transparent',
                    color: detailTab === 'qr' ? 'var(--accent)' : '#888',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  QR Code
                </button>
              </div>

              {/* Info Tab */}
              {detailTab === 'info' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <div className="device-meta"><strong>Status:</strong>&nbsp;<span className={`status-badge status-${deviceDetail?.current_status || selectedDevice.current_status}`}>{deviceDetail?.current_status || selectedDevice.current_status}</span></div>
                      <div className="device-meta"><strong>Serial:</strong>&nbsp;{selectedDevice.id}</div>
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
                            onClick={() => navigate(`/accounts?account=${deviceDetail?.account?.id || selectedDevice.account?.id}`)}
                          >
                            {deviceDetail?.account?.id || selectedDevice.account?.id}
                          </span>
                        ) : '-'}
                      </div>
                      <div className="device-meta"><strong>Notes:</strong>&nbsp;{deviceDetail?.notes || selectedDevice.notes || '-'}</div>
                      <div className="device-meta"><strong>Created:</strong>&nbsp;{new Date(selectedDevice.created_at).toLocaleString()}</div>
                      <div className="device-meta"><strong>Updated:</strong>&nbsp;{new Date(selectedDevice.updated_at).toLocaleString()}</div>
                    </div>
                  </div>

                  {/* Extra Data Section */}
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

              {/* History Tab */}
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

              {/* QR Code Tab */}
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
                                  h1 {
                                    font-size: 2rem;
                                    margin-bottom: 0.5rem;
                                    color: #000;
                                  }
                                  .qr-container {
                                    padding: 1rem;
                                    background: white;
                                    border: 2px solid #000;
                                  }
                                  @media print {
                                    body { height: auto; }
                                  }
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
                    💡 Tip: Print this QR code and stick it on the physical device. Use the Scan page in Argus to scan and open this device's details.
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>

        {/* Edit Device Modal */}
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
              <label htmlFor="current_status">Status *</label>
              <select id="current_status" name="current_status" required defaultValue={selectedDevice?.current_status || 'pending'}>
                <option value="pending">Pending</option>
                <option value="ready">Ready</option>
                <option value="deployed">Deployed</option>
                <option value="broken">Broken</option>
                <option value="testing">Testing</option>
                <option value="lab_support">Lab Support</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="current_account_id">Account</label>
              <select id="current_account_id" name="current_account_id" defaultValue={selectedDevice?.current_account_id || ''}>
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
              <small>
                {baseIp 
                  ? `Full IP will be: ${baseIp}.[your input]` 
                  : 'Configure base IP in Settings for faster entry'}
              </small>
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
                placeholder='{"sslkilswitch_enabled": true, "hardware_revision": "v2.1"}'
                defaultValue={selectedDevice?.extra_data ? JSON.stringify(selectedDevice.extra_data, null, 2) : ''}
                rows={5}
                style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              ></textarea>
              <small>Optional JSON object for custom fields (e.g., feature_flags, sslkilswitch_enabled, etc.)</small>
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
