import { Navigation } from './Navigation';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="bg-[rgb(var(--color-bg-page))]" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Navigation />
      <main style={{ flex: 1, minHeight: 0, overflow: 'auto', paddingBottom: '80px' }}>{children}</main>
    </div>
  );
}


