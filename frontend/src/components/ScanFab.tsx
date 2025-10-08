import { useNavigate, useLocation } from 'react-router-dom';
import './ScanFab.css';

export default function ScanFab() {
  const navigate = useNavigate();
  const location = useLocation();

  // Don't show the FAB on the scan page itself
  if (location.pathname === '/scan') {
    return null;
  }

  return (
    <button
      className="scan-fab"
      onClick={() => navigate('/scan')}
      aria-label="Scan QR Code"
      title="Scan QR Code"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        {/* QR Code Icon */}
        <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2" fill="none" />
        <rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2" fill="none" />
        <rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="2" fill="none" />
        <rect x="5" y="5" width="3" height="3" fill="currentColor" />
        <rect x="16" y="5" width="3" height="3" fill="currentColor" />
        <rect x="5" y="16" width="3" height="3" fill="currentColor" />
        <rect x="14" y="14" width="3" height="3" fill="currentColor" />
        <rect x="18" y="14" width="3" height="3" fill="currentColor" />
        <rect x="14" y="18" width="3" height="3" fill="currentColor" />
      </svg>
    </button>
  );
}
