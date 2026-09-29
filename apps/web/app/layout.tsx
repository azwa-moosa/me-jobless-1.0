import './globals.css';

export const metadata = { title: 'BML People Analytics' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="app-header">
          <div className="header-inner">
            <a className="brand" href="/" aria-label="BML People Analytics home">
              <span className="brand-mark" aria-hidden="true">BML</span>
              <span className="brand-copy">
                People Analytics
                <small>Human Resources</small>
              </span>
            </a>
            <nav className="top-nav" aria-label="Primary navigation">
              <a href="/">Dashboard</a>
              <a href="/reporting">Data management</a>
              <a href="/audit">Audit</a>
              <span className="user-badge" title="HR Analytics Admin" aria-label="HR Analytics Admin">HR</span>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
