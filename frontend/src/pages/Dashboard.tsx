import { useQuery } from '@tanstack/react-query';
import { deviceApi, accountApi, hostApi } from '../lib/api';

export default function Dashboard() {
  const { data: devicesResponse } = useQuery({
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

  const devices = devicesResponse?.data || [];
  const accounts = accountsResponse?.data || [];
  const hosts = hostsResponse?.data || [];

  const stats = {
    totalDevices: devices.length,
    deployed: devices.filter(d => d.currentStatus === 'deployed').length,
    standby: devices.filter(d => d.currentStatus === 'standby').length,
    broken: devices.filter(d => d.currentStatus === 'broken').length,
    testing: devices.filter(d => d.currentStatus === 'testing').length,
    totalAccounts: accounts.length,
    totalHosts: hosts.length,
  };

  return (
    <div className="dashboard">
      <h2>Dashboard</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Devices</h3>
          <p className="stat-number">{stats.totalDevices}</p>
        </div>
        <div className="stat-card status-deployed">
          <h3>Deployed</h3>
          <p className="stat-number">{stats.deployed}</p>
        </div>
        <div className="stat-card status-standby">
          <h3>Standby</h3>
          <p className="stat-number">{stats.standby}</p>
        </div>
        <div className="stat-card status-broken">
          <h3>Broken</h3>
          <p className="stat-number">{stats.broken}</p>
        </div>
        <div className="stat-card status-testing">
          <h3>Testing</h3>
          <p className="stat-number">{stats.testing}</p>
        </div>
        <div className="stat-card">
          <h3>Accounts</h3>
          <p className="stat-number">{stats.totalAccounts}</p>
        </div>
        <div className="stat-card">
          <h3>Hosts</h3>
          <p className="stat-number">{stats.totalHosts}</p>
        </div>
      </div>
    </div>
  );
}