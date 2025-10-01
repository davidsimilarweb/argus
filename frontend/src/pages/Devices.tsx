import { useState, FormEvent, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { deviceApi, accountApi, hostApi, type Device } from '../lib/api';
import Modal from '../components/Modal';
import Timeline from '../components/Timeline';
import { useToast } from '../hooks/useToast';
import { QRCodeSVG } from 'qrcode.react';

export default function Devices() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isHostModalOpen, setIsHostModalOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [suggestedSerial, setSuggestedSerial] = useState('');
  const [detailTab, setDetailTab] = useState<'info' | 'history' | 'qr'>('info');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast, ToastContainer } = useToast();

  // Check if we should open a specific device from URL params
  const deviceIdFromUrl = searchParams.get('device');

  // Fetch detailed device information when a device is selected
  const { data: deviceDetailResponse } = useQuery({
    queryKey: ['device', selectedDevice?.id],
    queryFn: async () => {
      if (!selectedDevice?.id) return null;
      const res = await deviceApi.getById(selectedDevice.id);
      return res.data;
    },
    enabled: !!selectedDevice?.id && isDetailsOpen,
  });

  const { data: response, isLoading, error } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const res = await deviceApi.getAll();
      return res.data;
    },
  });

  const { data: accountsResponse } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await accountApi.getAll();
      return res.data;
    },
  });

  const { data: hostsResponse } = useQuery({
    queryKey: ['hosts'],
    queryFn: async () => {
      const res = await hostApi.getAll();
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => deviceApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setIsModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => deviceApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setIsEditModalOpen(false);
      showToast('Device updated successfully!', 'success');
    },
    onError: (error: any) => {
      showToast(`Error updating device: ${error.message}`, 'error');
    },
  });

  const changeStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Device['currentStatus'] }) =>
      deviceApi.changeStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setIsStatusModalOpen(false);
      showToast('Status updated successfully!', 'success');
    },
    onError: (error: any) => {
      showToast(`Error updating status: ${error.message}`, 'error');
    },
  });

  const assignAccountMutation = useMutation({
    mutationFn: ({ id, accountId }: { id: string; accountId: string }) =>
      deviceApi.assignAccount(id, accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setIsAccountModalOpen(false);
      showToast('Account assigned successfully!', 'success');
    },
    onError: (error: any) => {
      showToast(`Error assigning account: ${error.message}`, 'error');
    },
  });

  const assignHostMutation = useMutation({
    mutationFn: ({ id, hostId }: { id: string; hostId: string }) =>
      deviceApi.assignHost(id, hostId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setIsHostModalOpen(false);
      showToast('Host assigned successfully!', 'success');
    },
    onError: (error: any) => {
      showToast(`Error assigning host: ${error.message}`, 'error');
    },
  });

  const unassignAccountMutation = useMutation({
    mutationFn: (id: string) => deviceApi.unassignAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setIsAccountModalOpen(false);
      showToast('Account removed successfully!', 'success');
    },
    onError: (error: any) => {
      showToast(`Error removing account: ${error.message}`, 'error');
    },
  });

  const unassignHostMutation = useMutation({
    mutationFn: (id: string) => deviceApi.unassignHost(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setIsHostModalOpen(false);
      showToast('Host removed successfully!', 'success');
    },
    onError: (error: any) => {
      showToast(`Error removing host: ${error.message}`, 'error');
    },
  });

  const maintenanceEventMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => deviceApi.addMaintenance(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['device', selectedDevice?.id] });
      setIsMaintenanceModalOpen(false);
      showToast('Maintenance event logged successfully!', 'success');
    },
    onError: (error: any) => {
      showToast(`Error logging maintenance: ${error.message}`, 'error');
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const rawDeviceId = (formData.get('deviceId') as string) || '';
    const data = {
      internalSerial: formData.get('internalSerial'),
      deviceId: rawDeviceId ? parseInt(rawDeviceId, 10) : undefined,
      staticIp: formData.get('staticIp') || undefined,
      deviceType: formData.get('deviceType'),
      model: formData.get('model') || undefined,
      iosVersion: formData.get('iosVersion') || undefined,
      notes: formData.get('notes') || undefined,
    };
    createMutation.mutate(data);
  };

  const handleEditSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedDevice) return;
    const formData = new FormData(e.currentTarget);
    const rawId = (formData.get('deviceId') as string) || '';

    // Get current and new values
    const newStatus = formData.get('currentStatus') as string;
    const newAccountId = formData.get('currentAccountId') as string;
    const newHostId = formData.get('currentHostId') as string;

    // Update basic device info
    const data = {
      internalSerial: formData.get('internalSerial') || undefined,
      deviceId: rawId ? parseInt(rawId, 10) : undefined,
      staticIp: formData.get('staticIp') || undefined,
      deviceType: formData.get('deviceType'),
      model: formData.get('model') || undefined,
      iosVersion: formData.get('iosVersion') || undefined,
      notes: formData.get('notes') || undefined,
    };

    try {
      // Update basic device info
      await updateMutation.mutateAsync({ id: selectedDevice.id, data });

      // Handle status change if different
      if (newStatus !== selectedDevice.currentStatus) {
        await changeStatusMutation.mutateAsync({
          id: selectedDevice.id,
          status: newStatus as Device['currentStatus'],
        });
      }

      // Handle account assignment/unassignment
      if (newAccountId && newAccountId !== selectedDevice.currentAccount?.id) {
        await assignAccountMutation.mutateAsync({
          id: selectedDevice.id,
          accountId: newAccountId,
        });
      } else if (!newAccountId && selectedDevice.currentAccount?.id) {
        await unassignAccountMutation.mutateAsync(selectedDevice.id);
      }

      // Handle host assignment/unassignment
      if (newHostId && newHostId !== selectedDevice.currentHost?.id) {
        await assignHostMutation.mutateAsync({
          id: selectedDevice.id,
          hostId: newHostId,
        });
      } else if (!newHostId && selectedDevice.currentHost?.id) {
        await unassignHostMutation.mutateAsync(selectedDevice.id);
      }

      setIsEditModalOpen(false);
      showToast('Device updated successfully!', 'success');
    } catch (error: any) {
      showToast(`Error updating device: ${error.message}`, 'error');
    }
  };

  const handleStatusSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedDevice) return;
    const formData = new FormData(e.currentTarget);
    changeStatusMutation.mutate({
      id: selectedDevice.id,
      status: formData.get('status') as Device['currentStatus'],
    });
  };

  const handleAccountSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedDevice) return;
    const formData = new FormData(e.currentTarget);
    const accountId = formData.get('accountId') as string;
    assignAccountMutation.mutate({
      id: selectedDevice.id,
      accountId,
    });
  };

  const handleHostSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedDevice) return;
    const formData = new FormData(e.currentTarget);
    const hostId = formData.get('hostId') as string;
    assignHostMutation.mutate({
      id: selectedDevice.id,
      hostId,
    });
  };

  const handleMaintenanceSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedDevice) return;
    const formData = new FormData(e.currentTarget);
    const cost = formData.get('cost') as string;
    maintenanceEventMutation.mutate({
      id: selectedDevice.id,
      data: {
        eventType: formData.get('eventType'),
        description: formData.get('description'),
        performedBy: formData.get('performedBy') || undefined,
        cost: cost ? parseFloat(cost) : undefined,
      },
    });
  };

  const devices = response?.data || [];
  const accounts = accountsResponse?.data || [];
  const hosts = hostsResponse?.data || [];

  // Open device modal if device ID is in URL
  useEffect(() => {
    if (deviceIdFromUrl && devices.length > 0) {
      const device = devices.find(d => d.id === deviceIdFromUrl);
      if (device) {
        setSelectedDevice(device);
        setIsDetailsOpen(true);
      }
    }
  }, [deviceIdFromUrl, devices]);

  // Filter devices based on search and filter criteria
  const filteredDevices = devices.filter((device) => {
    const matchesSearch = searchQuery === '' ||
      device.internalSerial?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.deviceId?.toString().includes(searchQuery) ||
      device.model?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || device.currentStatus === statusFilter;
    const matchesType = typeFilter === 'all' || device.deviceType === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  if (isLoading) return <div>Loading devices...</div>;
  if (error) return <div>Error loading devices: {(error as Error).message}</div>;

  const computeNextSerial = () => {
    let maxNum = 0;
    for (const d of devices) {
      const match = /^ARG-(\d+)$/.exec(d.internalSerial || '');
      if (match) {
        const num = parseInt(match[1], 10);
        if (!Number.isNaN(num) && num > maxNum) maxNum = num;
      }
    }
    const next = String(maxNum + 1).padStart(3, '0');
    return `ARG-${next}`;
  };

  const buildTimelineEvents = (deviceData: any) => {
    const events: any[] = [];

    // Status history
    if (deviceData.statusHistory) {
      deviceData.statusHistory.forEach((item: any) => {
        events.push({
          type: 'status',
          timestamp: item.changedAt,
          title: `Status changed to ${item.status}`,
          description: item.notes || undefined,
          icon: '📊',
        });
      });
    }

    // Account history
    if (deviceData.accountHistory) {
      deviceData.accountHistory.forEach((item: any) => {
        if (item.unassignedAt) {
          events.push({
            type: 'account',
            timestamp: item.unassignedAt,
            title: `Account unassigned`,
            description: `${item.account?.appleId}`,
            icon: '👤',
          });
        }
        events.push({
          type: 'account',
          timestamp: item.assignedAt,
          title: `Account assigned`,
          description: `${item.account?.appleId}`,
          icon: '👤',
        });
      });
    }

    // Host history
    if (deviceData.hostHistory) {
      deviceData.hostHistory.forEach((item: any) => {
        if (item.undeployedAt) {
          events.push({
            type: 'host',
            timestamp: item.undeployedAt,
            title: `Removed from host`,
            description: `${item.host?.name}`,
            icon: '🖥️',
          });
        }
        events.push({
          type: 'host',
          timestamp: item.deployedAt,
          title: `Deployed to host`,
          description: `${item.host?.name}`,
          icon: '🖥️',
        });
      });
    }

    // Maintenance events
    if (deviceData.maintenanceEvents) {
      deviceData.maintenanceEvents.forEach((item: any) => {
        events.push({
          type: 'maintenance',
          timestamp: item.performedAt,
          title: `Maintenance: ${item.eventType.replace(/_/g, ' ')}`,
          description: `${item.description}${item.cost ? ` ($${item.cost})` : ''}`,
          icon: '🔧',
        });
      });
    }

    // Health checks
    if (deviceData.healthChecks) {
      deviceData.healthChecks.forEach((item: any) => {
        events.push({
          type: 'health',
          timestamp: item.checkedAt,
          title: `Health check: ${item.status}`,
          description: item.errorMessage || `CPU: ${item.cpuUsage}% | Memory: ${item.memoryUsage}% | Battery: ${item.batteryLevel}%`,
          icon: '❤️',
        });
      });
    }

    // Sort by timestamp descending
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return events;
  };

  return (
    <>
      <ToastContainer />
      <div className="devices-page">
        <div className="page-header">
          <h2>Devices</h2>
        <button className="btn-primary" onClick={() => { setSuggestedSerial(computeNextSerial()); setIsModalOpen(true); }}>Add Device</button>
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
          placeholder="Search by serial, device ID, or model..."
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
          <option value="deployed">Deployed</option>
          <option value="standby">Standby</option>
          <option value="broken">Broken</option>
          <option value="testing">Testing</option>
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
          <option value="iphone">iPhone</option>
          <option value="ipad">iPad</option>
        </select>
        {(searchQuery || statusFilter !== 'all' || typeFilter !== 'all') && (
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setTypeFilter('all');
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Device">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="internalSerial">Internal Serial *</label>
            <input type="text" id="internalSerial" name="internalSerial" required placeholder="ARG-001" defaultValue={suggestedSerial} />
            <small>Unique internal identifier for this device</small>
          </div>

          <div className="form-group">
            <label htmlFor="deviceId">Device ID</label>
            <input type="number" id="deviceId" name="deviceId" placeholder="1" />
            <small>iOS Inspector device number (optional)</small>
          </div>

          <div className="form-group">
            <label htmlFor="deviceType">Device Type *</label>
            <select id="deviceType" name="deviceType" required defaultValue="iphone">
              <option value="">Select type...</option>
              <option value="iphone">iPhone</option>
              <option value="ipad">iPad</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="model">Model</label>
            <input type="text" id="model" name="model" placeholder="iPhone 14 Pro" />
          </div>

          <div className="form-group">
            <label htmlFor="iosVersion">iOS Version</label>
            <input type="text" id="iosVersion" name="iosVersion" placeholder="17.4.1" />
          </div>

          <div className="form-group">
            <label htmlFor="staticIp">Static IP</label>
            <input type="text" id="staticIp" name="staticIp" placeholder="192.168.1.100" />
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" name="notes" placeholder="Additional notes..."></textarea>
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

      <Modal isOpen={isStatusModalOpen} onClose={() => setIsStatusModalOpen(false)} title="Change Device Status">
        <form onSubmit={handleStatusSubmit}>
          <div className="form-group">
            <label htmlFor="status">New Status *</label>
            <select id="status" name="status" required defaultValue={selectedDevice?.currentStatus}>
              <option value="deployed">Deployed</option>
              <option value="standby">Standby</option>
              <option value="broken">Broken</option>
              <option value="testing">Testing</option>
            </select>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setIsStatusModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={changeStatusMutation.isPending}>
              {changeStatusMutation.isPending ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isAccountModalOpen} onClose={() => setIsAccountModalOpen(false)} title="Assign Account">
        {selectedDevice?.currentAccount && (
          <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#333', borderRadius: '4px' }}>
            <strong>Current Account:</strong> {selectedDevice.currentAccount.appleId}
            <button
              type="button"
              className="btn-secondary"
              style={{ marginLeft: '1rem' }}
              onClick={() => {
                if (selectedDevice && window.confirm('Remove current account from this device?')) {
                  unassignAccountMutation.mutate(selectedDevice.id);
                }
              }}
              disabled={unassignAccountMutation.isPending}
            >
              {unassignAccountMutation.isPending ? 'Removing...' : 'Remove Current'}
            </button>
          </div>
        )}
        <form onSubmit={handleAccountSubmit}>
          <div className="form-group">
            <label htmlFor="accountId">Select Account *</label>
            <select id="accountId" name="accountId" required>
              <option value="">Select an account...</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.appleId} ({account.country || 'No country'})
                </option>
              ))}
            </select>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setIsAccountModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={assignAccountMutation.isPending}>
              {assignAccountMutation.isPending ? 'Assigning...' : 'Assign Account'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isHostModalOpen} onClose={() => setIsHostModalOpen(false)} title="Assign to Host">
        {selectedDevice?.currentHost && (
          <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#333', borderRadius: '4px' }}>
            <strong>Current Host:</strong> {selectedDevice.currentHost.name}
            <button
              type="button"
              className="btn-secondary"
              style={{ marginLeft: '1rem' }}
              onClick={() => {
                if (selectedDevice && window.confirm('Remove this device from the current host?')) {
                  unassignHostMutation.mutate(selectedDevice.id);
                }
              }}
              disabled={unassignHostMutation.isPending}
            >
              {unassignHostMutation.isPending ? 'Removing...' : 'Remove Current'}
            </button>
          </div>
        )}
        <form onSubmit={handleHostSubmit}>
          <div className="form-group">
            <label htmlFor="hostId">Select Host *</label>
            <select id="hostId" name="hostId" required>
              <option value="">Select a host...</option>
              {hosts.map((host) => (
                <option key={host.id} value={host.id}>
                  {host.name} ({host.status})
                </option>
              ))}
            </select>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setIsHostModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={assignHostMutation.isPending}>
              {assignHostMutation.isPending ? 'Assigning...' : 'Assign to Host'}
            </button>
          </div>
        </form>
      </Modal>

      <div className="card-grid">
        {filteredDevices.map((device) => (
          <div
            key={device.id}
            className="device-card"
            onClick={() => { setSelectedDevice(device); setIsDetailsOpen(true); }}
          >
              <div className="device-card-header">
              <div className="device-id">{typeof device.deviceId === 'number' ? `#${device.deviceId}` : 'Unassigned'}</div>
              <span className={`status-badge status-${device.currentStatus}`}>{device.currentStatus}</span>
            </div>
            <div className="device-meta">
              <span style={{ opacity: 0.9 }}>Serial: {device.internalSerial}</span>
            </div>
            <div className="device-meta" style={{ marginTop: '0.5rem' }}>
              <span className={`pill ${device.deviceType === 'iphone' ? 'pill-iphone' : 'pill-ipad'}`}>
                {device.deviceType === 'iphone' ? 'iPhone' : 'iPad'}
              </span>
            </div>
          </div>
        ))}
        {filteredDevices.length === 0 && (
          <div className="device-card" style={{ gridColumn: '1/-1', textAlign: 'center' }}>
            {devices.length === 0 ? 'No devices found. Add your first device to get started.' : 'No devices match the current filters.'}
          </div>
        )}
      </div>

      <Modal
        isOpen={isDetailsOpen && !!selectedDevice}
        onClose={() => { setIsDetailsOpen(false); setDetailTab('info'); }}
        title={selectedDevice ? `Device #${selectedDevice.deviceId || selectedDevice.internalSerial}` : 'Device'}
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
                    <div className="device-meta"><strong>Status:</strong>&nbsp;<span className={`status-badge status-${selectedDevice.currentStatus}`}>{selectedDevice.currentStatus}</span></div>
                    <div className="device-meta"><strong>Serial:</strong>&nbsp;{selectedDevice.internalSerial}</div>
                    <div className="device-meta"><strong>Type:</strong>&nbsp;{selectedDevice.deviceType}</div>
                    <div className="device-meta"><strong>Model:</strong>&nbsp;{selectedDevice.model || '-'}</div>
                    <div className="device-meta"><strong>iOS:</strong>&nbsp;{selectedDevice.iosVersion || '-'}</div>
                  </div>
                  <div>
                    <div className="device-meta">
                      <strong>Host:</strong>&nbsp;
                      {selectedDevice.currentHost ? (
                        <span
                          style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() => navigate(`/hosts?host=${selectedDevice.currentHost?.id}`)}
                        >
                          {selectedDevice.currentHost.name}
                        </span>
                      ) : '-'}
                    </div>
                    <div className="device-meta">
                      <strong>Account:</strong>&nbsp;
                      {selectedDevice.currentAccount ? (
                        <span
                          style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() => navigate(`/accounts?account=${selectedDevice.currentAccount?.id}`)}
                        >
                          {selectedDevice.currentAccount.appleId}
                        </span>
                      ) : '-'}
                    </div>
                    <div className="device-meta"><strong>Static IP:</strong>&nbsp;{selectedDevice.staticIp || '-'}</div>
                    <div className="device-meta"><strong>Notes:</strong>&nbsp;{selectedDevice.notes || '-'}</div>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" className="btn-primary" onClick={() => { setIsDetailsOpen(false); setIsEditModalOpen(true); }}>
                    Edit Device
                  </button>
                  <button type="button" className="btn-action" style={{background: 'rgba(255,157,0,0.15)', borderColor: '#ff9d00'}} onClick={() => { setIsDetailsOpen(false); setIsMaintenanceModalOpen(true); }}>
                    🔧 Log Maintenance
                  </button>
                </div>
              </>
            )}

            {/* History Tab */}
            {detailTab === 'history' && (
              <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {deviceDetailResponse?.data && (
                  <Timeline events={buildTimelineEvents(deviceDetailResponse.data)} />
                )}
              </div>
            )}

            {/* QR Code Tab */}
            {detailTab === 'qr' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', padding: '2rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <h3 style={{ color: 'var(--accent)', marginBottom: '0.5rem' }}>
                    {selectedDevice.internalSerial}
                    {selectedDevice.deviceId && ` (#${selectedDevice.deviceId})`}
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
                    value={`${window.location.origin}/devices?device=${selectedDevice.id}`}
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
                            downloadLink.download = `qr-${selectedDevice.internalSerial}.png`;
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
                              <title>QR Code - ${selectedDevice.internalSerial}</title>
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
                                p {
                                  font-size: 1.2rem;
                                  color: #666;
                                  margin-bottom: 2rem;
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
                              <h1>${selectedDevice.internalSerial}</h1>
                              ${selectedDevice.deviceId ? `<p>Device ID: #${selectedDevice.deviceId}</p>` : ''}
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
                  💡 Tip: Print this QR code and stick it on the physical device. Scan it with any phone camera to instantly open this device's details.
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Device">
        <form onSubmit={handleEditSubmit}>
          <div className="form-group">
            <label htmlFor="internalSerial">Internal Serial *</label>
            <input type="text" id="internalSerial" name="internalSerial" required placeholder="ARG-001" defaultValue={selectedDevice?.internalSerial || ''} />
          </div>

          <div className="form-group">
            <label htmlFor="deviceId">Device ID</label>
            <input type="number" id="deviceId" name="deviceId" placeholder="1" defaultValue={selectedDevice?.deviceId ?? ''} />
          </div>

          <div className="form-group">
            <label htmlFor="deviceType">Device Type *</label>
            <select id="deviceType" name="deviceType" required defaultValue={selectedDevice?.deviceType || 'iphone'}>
              <option value="">Select type...</option>
              <option value="iphone">iPhone</option>
              <option value="ipad">iPad</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="currentStatus">Status *</label>
            <select id="currentStatus" name="currentStatus" required defaultValue={selectedDevice?.currentStatus || 'standby'}>
              <option value="deployed">Deployed</option>
              <option value="standby">Standby</option>
              <option value="broken">Broken</option>
              <option value="testing">Testing</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="currentAccountId">Account</label>
            <select id="currentAccountId" name="currentAccountId" defaultValue={selectedDevice?.currentAccount?.id || ''}>
              <option value="">No account assigned</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.appleId}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="currentHostId">Host</label>
            <select id="currentHostId" name="currentHostId" defaultValue={selectedDevice?.currentHost?.id || ''}>
              <option value="">No host assigned</option>
              {hosts.map((host) => (
                <option key={host.id} value={host.id}>{host.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="model">Model</label>
            <input type="text" id="model" name="model" placeholder="iPhone 14 Pro" defaultValue={selectedDevice?.model || ''} />
          </div>

          <div className="form-group">
            <label htmlFor="iosVersion">iOS Version</label>
            <input type="text" id="iosVersion" name="iosVersion" placeholder="17.4.1" defaultValue={selectedDevice?.iosVersion || ''} />
          </div>

          <div className="form-group">
            <label htmlFor="staticIp">Static IP</label>
            <input type="text" id="staticIp" name="staticIp" placeholder="192.168.1.100" defaultValue={selectedDevice?.staticIp || ''} />
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" name="notes" placeholder="Additional notes..." defaultValue={selectedDevice?.notes || ''}></textarea>
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

      <Modal isOpen={isMaintenanceModalOpen} onClose={() => setIsMaintenanceModalOpen(false)} title="Log Maintenance Event">
        <form onSubmit={handleMaintenanceSubmit}>
          <div className="form-group">
            <label htmlFor="eventType">Event Type *</label>
            <select id="eventType" name="eventType" required>
              <option value="">Select type...</option>
              <option value="battery_replacement">Battery Replacement</option>
              <option value="screen_repair">Screen Repair</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description *</label>
            <textarea id="description" name="description" required placeholder="Describe the maintenance performed..."></textarea>
          </div>

          <div className="form-group">
            <label htmlFor="performedBy">Performed By</label>
            <input type="text" id="performedBy" name="performedBy" placeholder="Technician name" />
          </div>

          <div className="form-group">
            <label htmlFor="cost">Cost ($)</label>
            <input type="number" id="cost" name="cost" step="0.01" min="0" placeholder="0.00" />
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setIsMaintenanceModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={maintenanceEventMutation.isPending}>
              {maintenanceEventMutation.isPending ? 'Logging...' : 'Log Event'}
            </button>
          </div>
        </form>
      </Modal>
      </div>
    </>
  );
}