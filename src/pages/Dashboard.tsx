import { useQuery } from '@tanstack/react-query';
import { deviceApi, accountApi } from '../lib/api';

export default function Dashboard() {
  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const res = await deviceApi.getAll();
      return res.data;
    },
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await accountApi.getAll();
      return res.data;
    },
  });

  const stats = {
    totalDevices: devices.length,
    pending: devices.filter(d => d.status === 'pending').length,
    ready: devices.filter(d => d.status === 'ready').length,
    deployed: devices.filter(d => d.status === 'deployed').length,
    broken: devices.filter(d => d.status === 'broken').length,
    testing: devices.filter(d => d.status === 'testing').length,
    labSupport: devices.filter(d => d.status === 'lab_support').length,
    totalAccounts: accounts.length,
  };

  return (
    <div className="dashboard">
      <h2>Dashboard</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Devices</h3>
          <p className="stat-number">{stats.totalDevices}</p>
        </div>
        <div className="stat-card status-pending">
          <h3>Pending</h3>
          <p className="stat-number">{stats.pending}</p>
        </div>
        <div className="stat-card status-ready">
          <h3>Ready</h3>
          <p className="stat-number">{stats.ready}</p>
        </div>
        <div className="stat-card status-deployed">
          <h3>Deployed</h3>
          <p className="stat-number">{stats.deployed}</p>
        </div>
        <div className="stat-card status-broken">
          <h3>Broken</h3>
          <p className="stat-number">{stats.broken}</p>
        </div>
        <div className="stat-card status-testing">
          <h3>Testing</h3>
          <p className="stat-number">{stats.testing}</p>
        </div>
        <div className="stat-card status-lab_support">
          <h3>Lab Support</h3>
          <p className="stat-number">{stats.labSupport}</p>
        </div>
        <div className="stat-card">
          <h3>Accounts</h3>
          <p className="stat-number">{stats.totalAccounts}</p>
        </div>
      </div>
    </div>
  );
}
