import { useQuery } from '@tanstack/react-query';
import { slotApi, type Slot } from '../lib/api';

export default function Slots() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['slots'],
    queryFn: async () => {
      const res = await slotApi.list();
      return res.data;
    },
  });

  const slots: Slot[] = data?.data || [];

  if (isLoading) return <div>Loading slots...</div>;
  if (error) return <div>Failed to load slots</div>;

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Inspector Slots</h2>
      <div className="grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '1rem',
      }}>
        {slots.map(slot => (
          <div key={slot.id} className={`card status-${slot.status}`} style={{
            border: 'var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            background: 'rgba(255,255,255,0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>#{slot.slotNumber}</div>
              <span className={`badge status-${slot.status}`}>{slot.status}</span>
            </div>
            <div style={{ color: '#aaa', marginTop: '0.25rem' }}>{slot.host?.name}</div>
            <div style={{ marginTop: '0.5rem' }}>
              {slot.currentDevice ? (
                <div>
                  <div>Device: {slot.currentDevice.internalSerial}</div>
                  {slot.currentDevice.staticIp && (
                    <div>IP: {slot.currentDevice.staticIp}</div>
                  )}
                </div>
              ) : (
                <div style={{ color: '#888' }}>Unassigned</div>
              )}
            </div>
            <div style={{ color: '#888', marginTop: '0.5rem' }}>
              Last check: {slot.lastHealthCheck ? new Date(slot.lastHealthCheck).toLocaleString() : 'No data'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
