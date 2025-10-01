interface TimelineEvent {
  type: 'status' | 'account' | 'host' | 'maintenance' | 'health';
  timestamp: string;
  title: string;
  description?: string;
  icon: string;
}

interface TimelineProps {
  events: TimelineEvent[];
}

export default function Timeline({ events }: TimelineProps) {
  if (events.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
        No history events found
      </div>
    );
  }

  const getEventColor = (type: string) => {
    switch (type) {
      case 'status':
        return '#00ff9f';
      case 'account':
        return '#00d4ff';
      case 'host':
        return '#ff9500';
      case 'maintenance':
        return '#ff3d00';
      case 'health':
        return '#7c4dff';
      default:
        return '#888';
    }
  };

  return (
    <div className="timeline">
      {events.map((event, index) => (
        <div key={index} className="timeline-event">
          <div className="timeline-marker" style={{ borderColor: getEventColor(event.type) }}>
            <span style={{ color: getEventColor(event.type) }}>{event.icon}</span>
          </div>
          <div className="timeline-content">
            <div className="timeline-header">
              <strong>{event.title}</strong>
              <span className="timeline-time">
                {new Date(event.timestamp).toLocaleString()}
              </span>
            </div>
            {event.description && (
              <div className="timeline-description">{event.description}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
