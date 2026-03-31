export const dynamic = 'force-dynamic';

import type { Metadata, Viewport } from 'next';
import '../index.css';
import '../App.css';
import Providers from './providers';
import AppShell from './app-shell';

export const metadata: Metadata = {
  title: 'Argus - iOS Device Fleet Management',
  description: 'Track and manage iOS devices, accounts, and deployments',
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
