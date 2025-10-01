import { useState, FormEvent, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { hostApi } from '../lib/api';
import Modal from '../components/Modal';

export default function Hosts() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedHost, setSelectedHost] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const hostIdFromUrl = searchParams.get('host');

  const { data: response, isLoading, error } = useQuery({
    queryKey: ['hosts'],
    queryFn: async () => {
      const res = await hostApi.getAll();
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => hostApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosts'] });
      setIsModalOpen(false);
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      hostname: formData.get('hostname') || undefined,
      status: formData.get('status') || 'offline',
      notes: formData.get('notes') || undefined,
    };
    createMutation.mutate(data);
  };

  const hosts = response?.data || [];

  // Open host modal if host ID is in URL
  useEffect(() => {
    if (hostIdFromUrl && hosts.length > 0) {
      const host = hosts.find(h => h.id === hostIdFromUrl);
      if (host) {
        setSelectedHost(host);
        setIsDetailsOpen(true);
      }
    }
  }, [hostIdFromUrl, hosts]);

  // Filter hosts based on search and filter criteria
  const filteredHosts = hosts.filter((host) => {
    const matchesSearch = searchQuery === '' ||
      host.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      host.hostname?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || host.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (isLoading) return <div>Loading hosts...</div>;
  if (error) return <div>Error loading hosts: {(error as Error).message}</div>;

  return (
    <div className="hosts-page">
      <div className="page-header">
        <h2>Hosts</h2>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>Add Host</button>
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
          placeholder="Search by name or hostname..."
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
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="maintenance">Maintenance</option>
        </select>
        {(searchQuery || statusFilter !== 'all') && (
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
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
          {filteredHosts.length} of {hosts.length} hosts
        </span>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Host">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Name *</label>
            <input type="text" id="name" name="name" required placeholder="mac-mini-01" />
            <small>Unique name for this Mac Mini host</small>
          </div>

          <div className="form-group">
            <label htmlFor="hostname">Hostname</label>
            <input type="text" id="hostname" name="hostname" placeholder="192.168.1.50" />
            <small>IP address or hostname</small>
          </div>

          <div className="form-group">
            <label htmlFor="status">Status</label>
            <select id="status" name="status">
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="maintenance">Maintenance</option>
            </select>
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
              {createMutation.isPending ? 'Creating...' : 'Create Host'}
            </button>
          </div>
        </form>
      </Modal>
      <div className="card-grid">
        {filteredHosts.map((host) => (
          <div
            key={host.id}
            className="device-card"
            onClick={() => { setSelectedHost(host); setIsDetailsOpen(true); }}
          >
            <div className="device-card-header">
              <div className="device-id" style={{ fontSize: '1.1rem', fontWeight: 800 }}>{host.name}</div>
              <span className={`status-badge status-${host.status}`}>{host.status}</span>
            </div>
            <div className="device-meta">
              <span className="pill">Hostname: {host.hostname || '-'}</span>
            </div>
            <div className="device-meta" style={{ marginTop: '0.5rem' }}>
              <span className="pill">Devices: {(host as any).currentDevices?.length || 0}</span>
            </div>
          </div>
        ))}
        {filteredHosts.length === 0 && (
          <div className="device-card" style={{ gridColumn: '1/-1', textAlign: 'center' }}>
            {hosts.length === 0 ? 'No hosts found. Add your first host to get started.' : 'No hosts match the current filters.'}
          </div>
        )}
      </div>

      <Modal
        isOpen={isDetailsOpen && !!selectedHost}
        onClose={() => setIsDetailsOpen(false)}
        title={selectedHost ? selectedHost.name : 'Host'}
      >
        {selectedHost && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <div className="device-meta"><strong>Status:</strong>&nbsp;<span className={`status-badge status-${selectedHost.status}`}>{selectedHost.status}</span></div>
                <div className="device-meta"><strong>Hostname:</strong>&nbsp;{selectedHost.hostname || '-'}</div>
                <div className="device-meta"><strong>Notes:</strong>&nbsp;{selectedHost.notes || '-'}</div>
              </div>
              <div>
                <div className="device-meta"><strong>Device Count:</strong>&nbsp;{(selectedHost as any).currentDevices?.length || 0}</div>
                <div className="device-meta"><strong>Created:</strong>&nbsp;{new Date(selectedHost.createdAt).toLocaleString()}</div>
                <div className="device-meta"><strong>Updated:</strong>&nbsp;{new Date(selectedHost.updatedAt).toLocaleString()}</div>
              </div>
            </div>

            {/* Devices List */}
            {(selectedHost as any).currentDevices && (selectedHost as any).currentDevices.length > 0 && (
              <div>
                <h4 style={{ marginBottom: '0.5rem', color: 'var(--accent)' }}>Devices on This Host:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {(selectedHost as any).currentDevices.map((device: any) => (
                    <div
                      key={device.id}
                      style={{
                        padding: '0.75rem',
                        background: 'rgba(0,0,0,0.2)',
                        border: 'var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onClick={() => navigate(`/devices?device=${device.id}`)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent)';
                        e.currentTarget.style.background = 'rgba(0,255,159,0.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                        e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>{device.internalSerial}{device.deviceId ? ` (#${device.deviceId})` : ''}</span>
                        <span className={`status-badge status-${device.currentStatus}`} style={{ fontSize: '0.8rem' }}>
                          {device.currentStatus}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.25rem' }}>
                        {device.deviceType} {device.model && `• ${device.model}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}