'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Logo from '../components/Logo';
import ScanFab from '../components/ScanFab';
import { useSettings } from '../contexts/SettingsContext';

const PROD_LABEL = process.env.NEXT_PUBLIC_ARGUS_PROD_TARGET?.replace('https://', '') ?? 'production';
const STAGING_LABEL = process.env.NEXT_PUBLIC_ARGUS_STAGING_TARGET?.replace('https://', '') ?? 'staging';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { apiEnv } = useSettings();

  const isActive = (path: string) =>
    pathname === path
      ? { background: 'rgba(0,255,159,0.10)', border: '1px solid rgba(0,255,159,0.25)' }
      : undefined;

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  const isStaging = apiEnv === 'staging';
  const envLabel = isStaging ? STAGING_LABEL : PROD_LABEL;

  return (
    <>
      {/* Environment banner */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          fontSize: '0.78rem',
          fontWeight: 600,
          letterSpacing: '0.04em',
          background: isStaging
            ? 'rgba(124, 58, 237, 0.85)'
            : 'rgba(255, 85, 99, 0.18)',
          borderBottom: isStaging
            ? '1px solid rgba(124,58,237,0.6)'
            : '1px solid rgba(255,85,99,0.3)',
          backdropFilter: 'blur(8px)',
          color: isStaging ? '#e0c8ff' : 'rgba(255,180,185,0.9)',
        }}
      >
        <span style={{ opacity: 0.7 }}>{isStaging ? '⚗️' : '🔴'}</span>
        <span>{isStaging ? 'STAGING' : 'PRODUCTION'}</span>
        <span style={{ opacity: 0.55, fontWeight: 400, fontSize: '0.72rem' }}>— {envLabel}</span>
        <Link
          href="/settings"
          style={{
            marginLeft: '0.5rem',
            color: 'inherit',
            opacity: 0.6,
            fontSize: '0.7rem',
            textDecoration: 'underline',
          }}
        >
          change
        </Link>
      </div>

      <div
        className={`app${isSidebarOpen ? ' sidebar-open' : ''}`}
        style={{ paddingTop: '28px' }}
      >
        <aside className="sidebar glass">
          <div className="brand">
            <Logo size={28} />
            <h1><span className="accent">Argus</span></h1>
          </div>
          <nav className="side-links">
            <Link className="side-link" href="/" style={isActive('/')} onClick={() => setIsSidebarOpen(false)}>Dashboard</Link>
            <Link className="side-link" href="/devices" style={isActive('/devices')} onClick={() => setIsSidebarOpen(false)}>Devices</Link>
            <Link className="side-link" href="/accounts" style={isActive('/accounts')} onClick={() => setIsSidebarOpen(false)}>Accounts</Link>
            <Link className="side-link" href="/scan" style={isActive('/scan')} onClick={() => setIsSidebarOpen(false)}>Scan</Link>
            <Link className="side-link" href="/ip-management" style={isActive('/ip-management')} onClick={() => setIsSidebarOpen(false)}>IP Management</Link>
            <Link className="side-link" href="/health-checks" style={isActive('/health-checks')} onClick={() => setIsSidebarOpen(false)}>Health Checks</Link>
            <Link className="side-link" href="/system-health" style={isActive('/system-health')} onClick={() => setIsSidebarOpen(false)}>System Health</Link>
            <Link className="side-link" href="/throughput" style={isActive('/throughput')} onClick={() => setIsSidebarOpen(false)}>Throughput</Link>
            <Link className="side-link" href="/settings" style={isActive('/settings')} onClick={() => setIsSidebarOpen(false)}>Settings</Link>
          </nav>
        </aside>
        <header className="topbar">
          <button
            className="menu-btn btn-action"
            aria-label="Toggle sidebar"
            onClick={() => setIsSidebarOpen(v => !v)}
          >
            ☰
          </button>
        </header>
        {isSidebarOpen && <div className="scrim" onClick={() => setIsSidebarOpen(false)} />}
        <main className="main-content">
          {children}
        </main>
        <ScanFab />
      </div>
    </>
  );
}
