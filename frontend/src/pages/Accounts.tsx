import { useState, FormEvent, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { accountApi } from '../lib/api';
import Modal from '../components/Modal';

export default function Accounts() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const accountIdFromUrl = searchParams.get('account');

  const { data: response, isLoading, error } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await accountApi.getAll();
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => accountApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setIsModalOpen(false);
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      appleId: formData.get('appleId'),
      country: formData.get('country') || undefined,
      status: formData.get('status') || 'active',
      notes: formData.get('notes') || undefined,
    };
    createMutation.mutate(data);
  };

  const accounts = response?.data || [];

  // Open account modal if account ID is in URL
  useEffect(() => {
    if (accountIdFromUrl && accounts.length > 0) {
      const account = accounts.find(a => a.id === accountIdFromUrl);
      if (account) {
        setSelectedAccount(account);
        setIsDetailsOpen(true);
      }
    }
  }, [accountIdFromUrl, accounts]);

  // Filter accounts based on search and filter criteria
  const filteredAccounts = accounts.filter((account) => {
    const matchesSearch = searchQuery === '' ||
      account.appleId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.country?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || account.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (isLoading) return <div>Loading accounts...</div>;
  if (error) return <div>Error loading accounts: {(error as Error).message}</div>;

  return (
    <div className="accounts-page">
      <div className="page-header">
        <h2>Accounts</h2>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>Add Account</button>
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
          placeholder="Search by Apple ID or country..."
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
          <option value="active">Active</option>
          <option value="locked">Locked</option>
          <option value="disabled">Disabled</option>
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
          {filteredAccounts.length} of {accounts.length} accounts
        </span>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Account">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="appleId">Apple ID *</label>
            <input type="email" id="appleId" name="appleId" required placeholder="user@example.com" />
          </div>

          <div className="form-group">
            <label htmlFor="country">Country</label>
            <input type="text" id="country" name="country" placeholder="US" />
          </div>

          <div className="form-group">
            <label htmlFor="status">Status</label>
            <select id="status" name="status">
              <option value="active">Active</option>
              <option value="locked">Locked</option>
              <option value="disabled">Disabled</option>
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
              {createMutation.isPending ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </Modal>
      <div className="card-grid">
        {filteredAccounts.map((account) => (
          <div
            key={account.id}
            className="device-card"
            onClick={() => { setSelectedAccount(account); setIsDetailsOpen(true); }}
          >
            <div className="device-card-header">
              <div className="device-id" style={{ fontSize: '0.95rem', fontWeight: 700 }}>{account.appleId}</div>
            </div>
            <div className="device-meta">
              <span className="pill" style={{ textTransform: 'uppercase' }}>{account.country || 'No country'}</span>
              <span className="pill">Devices: {(account as any).currentDevices?.length || 0}</span>
              <span className={`status-badge status-${account.status}`}>{account.status}</span>
            </div>
          </div>
        ))}
        {filteredAccounts.length === 0 && (
          <div className="device-card" style={{ gridColumn: '1/-1', textAlign: 'center' }}>
            {accounts.length === 0 ? 'No accounts found. Add your first account to get started.' : 'No accounts match the current filters.'}
          </div>
        )}
      </div>

      <Modal
        isOpen={isDetailsOpen && !!selectedAccount}
        onClose={() => setIsDetailsOpen(false)}
        title={selectedAccount ? selectedAccount.appleId : 'Account'}
      >
        {selectedAccount && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <div className="device-meta"><strong>Status:</strong>&nbsp;<span className={`status-badge status-${selectedAccount.status}`}>{selectedAccount.status}</span></div>
                <div className="device-meta"><strong>Country:</strong>&nbsp;{selectedAccount.country || '-'}</div>
                <div className="device-meta"><strong>Password:</strong>&nbsp;{selectedAccount.password || '-'}</div>
                <div className="device-meta"><strong>2FA:</strong>&nbsp;{selectedAccount.twoFactor || '-'}</div>
                <div className="device-meta"><strong>Notes:</strong>&nbsp;{selectedAccount.notes || '-'}</div>
              </div>
              <div>
                <div className="device-meta"><strong>Device Count:</strong>&nbsp;{(selectedAccount as any).currentDevices?.length || 0}</div>
                <div className="device-meta"><strong>Created:</strong>&nbsp;{new Date(selectedAccount.createdAt).toLocaleString()}</div>
                <div className="device-meta"><strong>Updated:</strong>&nbsp;{new Date(selectedAccount.updatedAt).toLocaleString()}</div>
              </div>
            </div>

            {/* Devices List */}
            {(selectedAccount as any).currentDevices && (selectedAccount as any).currentDevices.length > 0 && (
              <div>
                <h4 style={{ marginBottom: '0.5rem', color: 'var(--accent)' }}>Devices Using This Account:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {(selectedAccount as any).currentDevices.map((device: any) => (
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