import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import './App.css';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import Accounts from './pages/Accounts';
import Hosts from './pages/Hosts';
import Scan from './pages/Scan';
import Logo from './components/Logo';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppShell() {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isActive = (path: string) => location.pathname === path ? { background: 'rgba(0,255,159,0.10)', border: '1px solid rgba(0,255,159,0.25)' } : undefined;

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className={`app${isSidebarOpen ? ' sidebar-open' : ''}`}>
      <aside className="sidebar glass">
        <div className="brand">
          <Logo size={28} />
          <h1><span className="accent">Argus</span></h1>
        </div>
        <nav className="side-links">
          <Link className="side-link" to="/" style={isActive('/')} onClick={() => setIsSidebarOpen(false)}>Dashboard</Link>
          <Link className="side-link" to="/devices" style={isActive('/devices')} onClick={() => setIsSidebarOpen(false)}>Devices</Link>
          <Link className="side-link" to="/accounts" style={isActive('/accounts')} onClick={() => setIsSidebarOpen(false)}>Accounts</Link>
          <Link className="side-link" to="/hosts" style={isActive('/hosts')} onClick={() => setIsSidebarOpen(false)}>Hosts</Link>
          <Link className="side-link" to="/scan" style={isActive('/scan')} onClick={() => setIsSidebarOpen(false)}>Scan</Link>
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
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/hosts" element={<Hosts />} />
          <Route path="/scan" element={<Scan />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AppShell />
      </Router>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
