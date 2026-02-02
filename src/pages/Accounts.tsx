import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { accountApi, type Account } from '../lib/api';
import Modal from '../components/Modal';
import { useToast } from '../hooks/useToast';
import { useSettings } from '../contexts/SettingsContext';

export default function Accounts() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast, ToastContainer } = useToast();
  const { allowedCountries } = useSettings();

  const accountIdFromUrl = searchParams.get('account');

  // Fetch all accounts
  const { data: accounts = [], isLoading, error } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await accountApi.getAll();
      return res.data;
    },
  });

  // Fetch account detail with devices when selected
  const { data: accountDetail } = useQuery({
    queryKey: ['account', selectedAccount?.id],
    queryFn: async () => {
      if (!selectedAccount?.id) return null;
      const res = await accountApi.getById(selectedAccount.id, true); // include_devices=true
      return res.data;
    },
    enabled: !!selectedAccount?.id && isDetailsOpen,
  });

  const countryOptions = (() => {
    const current = accountDetail?.country || selectedAccount?.country;
    if (!allowedCountries.length) return [];
    if (current && !allowedCountries.includes(current)) return [current, ...allowedCountries];
    return allowedCountries;
  })();

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof accountApi.create>[0]) => accountApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setIsModalOpen(false);
      showToast('Account created successfully!', 'success');
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || error.message;
      showToast(`Error creating account: ${message}`, 'error');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof accountApi.update>[1] }) =>
      accountApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account', selectedAccount?.id] });
      setIsEditModalOpen(false);
      showToast('Account updated successfully!', 'success');
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || error.message;
      showToast(`Error updating account: ${message}`, 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => accountApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setIsDetailsOpen(false);
      setSelectedAccount(null);
      showToast('Account deleted successfully!', 'success');
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || error.message;
      showToast(`Error deleting account: ${message}`, 'error');
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      id: formData.get('id') as string, // Apple ID
      country: (formData.get('country') as string) || null,
      password: (formData.get('password') as string) || null,
      two_factor: (formData.get('two_factor') as string) || null,
      notes: (formData.get('notes') as string) || null,
    };
    createMutation.mutate(data);
  };

  const handleEditSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedAccount) return;
    const formData = new FormData(e.currentTarget);
    const data = {
      country: (formData.get('country') as string) || null,
      password: (formData.get('password') as string) || null,
      two_factor: (formData.get('two_factor') as string) || null,
      notes: (formData.get('notes') as string) || null,
    };
    updateMutation.mutate({ id: selectedAccount.id, data });
  };

  const handleDelete = () => {
    if (!selectedAccount) return;
    if (window.confirm(`Are you sure you want to delete account "${selectedAccount.id}"? Devices assigned to this account will be unassigned.`)) {
      deleteMutation.mutate(selectedAccount.id);
    }
  };

  // Open account modal if account ID is in URL
  useEffect(() => {
    if (accountIdFromUrl && accounts.length > 0) {
      const account = accounts.find(a => a.id === accountIdFromUrl);
      if (account) {
        setSelectedAccount(account);
        setIsDetailsOpen(true);
      } else {
        showToast(`Account "${accountIdFromUrl}" not found`, 'error');
        navigate('/accounts', { replace: true });
      }
    }
  }, [accountIdFromUrl, accounts, navigate, showToast]);

  // Get unique countries for the filter dropdown with counts
  const countryCounts = accounts.reduce((acc, account) => {
    if (account.country) {
      acc[account.country] = (acc[account.country] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const uniqueCountries = Object.keys(countryCounts).sort();
  const noCountryCount = accounts.filter(a => !a.country).length;

  // Filter accounts based on search and filter criteria
  const filteredAccounts = accounts.filter((account) => {
    const matchesSearch = searchQuery === '' ||
      account.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.country?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCountry = countryFilter === 'all' ||
      (countryFilter === 'none' ? !account.country : account.country === countryFilter);

    return matchesSearch && matchesCountry;
  });

  if (isLoading) return <div>Loading accounts...</div>;
  if (error) return <div>Error loading accounts: {(error as Error).message}</div>;

  return (
    <>
      <ToastContainer />
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
          {(searchQuery || countryFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
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
            {filteredAccounts.length} of {accounts.length} accounts
          </span>
        </div>

        {/* Add Account Modal */}
        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Account">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="id">Apple ID *</label>
              <input type="email" id="id" name="id" required placeholder="user@example.com" />
              <small>The Apple ID email address</small>
            </div>

            <div className="form-group">
              <label htmlFor="country">Country</label>
              {allowedCountries.length > 0 ? (
                <select id="country" name="country" defaultValue="">
                  <option value="">No country</option>
                  {allowedCountries.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              ) : (
                <input type="text" id="country" name="country" placeholder="US" />
              )}
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input type="text" id="password" name="password" placeholder="Account password" />
            </div>

            <div className="form-group">
              <label htmlFor="two_factor">Two-Factor Info</label>
              <input type="text" id="two_factor" name="two_factor" placeholder="Recovery codes or notes" />
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

        {/* Account Cards Grid */}
        <div className="card-grid">
          {filteredAccounts.map((account) => (
            <div
              key={account.id}
              className="device-card"
              onClick={() => { setSelectedAccount(account); setIsDetailsOpen(true); }}
            >
              <div className="device-card-header">
                <div className="device-id" style={{ fontSize: '0.95rem', fontWeight: 700 }}>{account.id}</div>
              </div>
              <div className="device-meta">
                <span className="pill" style={{ textTransform: 'uppercase' }}>{account.country || 'No country'}</span>
              </div>
            </div>
          ))}
          {filteredAccounts.length === 0 && (
            <div className="device-card" style={{ gridColumn: '1/-1', textAlign: 'center' }}>
              {accounts.length === 0 ? 'No accounts found. Add your first account to get started.' : 'No accounts match the current filters.'}
            </div>
          )}
        </div>

        {/* Account Details Modal */}
        <Modal
          isOpen={isDetailsOpen && !!selectedAccount}
          onClose={() => { setIsDetailsOpen(false); }}
          title={selectedAccount ? selectedAccount.id : 'Account'}
        >
          {selectedAccount && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <div className="device-meta"><strong>Apple ID:</strong>&nbsp;{accountDetail?.id || selectedAccount.id}</div>
                  <div className="device-meta"><strong>Country:</strong>&nbsp;{accountDetail?.country || selectedAccount.country || '-'}</div>
                  <div className="device-meta"><strong>Password:</strong>&nbsp;<span style={{ fontFamily: 'monospace' }}>{accountDetail?.password || selectedAccount.password || '-'}</span></div>
                  <div className="device-meta"><strong>2FA:</strong>&nbsp;{accountDetail?.two_factor || selectedAccount.two_factor || '-'}</div>
                  <div className="device-meta"><strong>Notes:</strong>&nbsp;{accountDetail?.notes || selectedAccount.notes || '-'}</div>
                </div>
                <div>
                  <div className="device-meta"><strong>Device Count:</strong>&nbsp;{accountDetail?.devices?.length || 0}</div>
                  <div className="device-meta"><strong>Created:</strong>&nbsp;{new Date(selectedAccount.created_at).toLocaleString()}</div>
                  <div className="device-meta"><strong>Updated:</strong>&nbsp;{new Date(selectedAccount.updated_at).toLocaleString()}</div>
                </div>
              </div>

              {/* Devices List */}
              {accountDetail?.devices && accountDetail.devices.length > 0 && (
                <div>
                  <h4 style={{ marginBottom: '0.5rem', color: 'var(--accent)' }}>Devices Using This Account:</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {accountDetail.devices.map((device) => (
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
                          <span style={{ fontWeight: 600 }}>{device.id}</span>
                          <span className={`status-badge status-${device.status}`} style={{ fontSize: '0.8rem' }}>
                            {device.status}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.25rem' }}>
                          {device.device_type} {device.device_model && `• ${device.device_model}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-actions" style={{ marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    // Prefer the detailed record (it may have fields not present in list view)
                    if (accountDetail) setSelectedAccount(accountDetail);
                    setIsDetailsOpen(false);
                    setIsEditModalOpen(true);
                  }}
                >
                  Edit Account
                </button>
                <button
                  type="button"
                  className="btn-action"
                  style={{ background: 'rgba(255,85,99,0.15)', borderColor: '#ff5563', color: '#ff5563' }}
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? 'Deleting...' : '🗑️ Delete Account'}
                </button>
              </div>
            </div>
          )}
        </Modal>

        {/* Edit Account Modal */}
        <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Account">
          <form onSubmit={handleEditSubmit}>
            <div className="form-group">
              <label>Apple ID</label>
              <input type="email" value={selectedAccount?.id || ''} disabled style={{ opacity: 0.6 }} />
              <small>Apple ID cannot be changed</small>
            </div>

            <div className="form-group">
              <label htmlFor="country">Country</label>
              {allowedCountries.length > 0 ? (
                <select id="country" name="country" defaultValue={selectedAccount?.country || ''}>
                  <option value="">No country</option>
                  {countryOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              ) : (
                <input type="text" id="country" name="country" placeholder="US" defaultValue={selectedAccount?.country || ''} />
              )}
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input type="text" id="password" name="password" placeholder="Leave empty to keep current" defaultValue={selectedAccount?.password || ''} />
            </div>

            <div className="form-group">
              <label htmlFor="two_factor">Two-Factor Info</label>
              <input type="text" id="two_factor" name="two_factor" placeholder="Recovery codes or notes" defaultValue={selectedAccount?.two_factor || ''} />
            </div>

            <div className="form-group">
              <label htmlFor="notes">Notes</label>
              <textarea id="notes" name="notes" placeholder="Additional notes..." defaultValue={selectedAccount?.notes || ''}></textarea>
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
