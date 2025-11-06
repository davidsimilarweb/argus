import { useQuery } from '@tanstack/react-query';
import { deviceApi, networkApi, type Device, type NetworkReservation } from '../lib/api';

export default function IPs() {
  const { data: devicesRes } = useQuery({ queryKey: ['devices'], queryFn: async () => (await deviceApi.getAll()).data });
  const { data: reservationsRes } = useQuery({ queryKey: ['reservations'], queryFn: async () => (await networkApi.list()).data });
  const { data: summaryRes } = useQuery({ queryKey: ['reservations-summary'], queryFn: async () => (await networkApi.summary()).data });

  const devices: Device[] = devicesRes?.data || [];
  const reservations: NetworkReservation[] = reservationsRes?.data || [];
  const conflicts = summaryRes?.data?.conflicts || [];
  const conflictIPs = new Set(conflicts.map(c => c.ip));

  return (
    <div style={{ padding: '1rem' }}>
      <h2>IP Addresses</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div>
          <h3>Devices</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Device</th>
                <th style={{ textAlign: 'left' }}>IP</th>
              </tr>
            </thead>
            <tbody>
              {devices.map(d => (
                <tr key={d.id} style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <td>{d.internalSerial}</td>
                  <td style={{ color: conflictIPs.has(d.staticIp || '') ? '#ff5563' : 'inherit' }}>{d.staticIp || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3>Reservations</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>IP</th>
                <th style={{ textAlign: 'left' }}>Type</th>
                <th style={{ textAlign: 'left' }}>Label</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map(r => (
                <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <td style={{ color: conflictIPs.has(r.ip) ? '#ff5563' : 'inherit' }}>{r.ip}</td>
                  <td>{r.type}</td>
                  <td>{r.label || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {conflicts.length > 0 && (
        <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid rgba(255,85,99,0.4)', background: 'rgba(255,85,99,0.15)', borderRadius: '8px' }}>
          <strong>Conflicts:</strong>
          {conflicts.map(c => (
            <div key={c.ip}>IP {c.ip}: {c.sources.join(', ')}</div>
          ))}
        </div>
      )}
    </div>
  );
}
