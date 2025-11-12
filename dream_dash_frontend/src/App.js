import React, { useState, useEffect } from 'react';
import './App.css';
import GameCanvas from './components/GameCanvas';

// PUBLIC_INTERFACE
function App() {
  const [theme, setTheme] = useState('light');

  // Effect to apply theme to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // PUBLIC_INTERFACE
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  // Inline styles using Ocean Professional styleThemeData
  const colors = {
    primary: '#2563EB',
    secondary: '#F59E0B',
    background: '#f9fafb',
    surface: '#ffffff',
    text: '#111827',
  };

  const appContainerStyle = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: `linear-gradient(180deg, rgba(37,99,235,0.10) 0%, ${colors.background} 100%)`,
    color: colors.text,
  };

  const headerStyle = {
    position: 'sticky',
    top: 0,
    background: colors.surface,
    borderBottom: '1px solid rgba(17,24,39,0.06)',
    zIndex: 10,
  };

  const toolbarStyle = {
    maxWidth: 960,
    margin: '0 auto',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const badgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontWeight: 600,
    color: colors.text,
  };

  const statPill = {
    background: 'rgba(37,99,235,0.08)',
    color: colors.primary,
    padding: '6px 10px',
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 600,
    marginLeft: 8,
  };

  const contentStyle = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px 48px',
  };

  const gameCardStyle = {
    width: 'fit-content',
    background: colors.surface,
    border: '1px solid rgba(17,24,39,0.06)',
    borderRadius: 16,
    padding: 16,
    boxShadow: '0 10px 30px rgba(2,8,23,0.08)',
  };

  const themeButtonStyle = {
    position: 'fixed',
    bottom: 16,
    right: 16,
    backgroundColor: colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 6px 16px rgba(37,99,235,0.35)',
  };

  return (
    <div className="App" style={appContainerStyle}>
      <header style={headerStyle}>
        <div style={toolbarStyle} role="region" aria-label="Game status bar">
          <div style={badgeStyle}>
            Dream Dash
            <span style={{ ...statPill, background: 'rgba(245,158,11,0.12)', color: colors.secondary }}>
              Modern • Ocean
            </span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={statPill} aria-live="polite">Score: 0</div>
            <div style={statPill} aria-live="polite">Time: 0s</div>
          </div>
        </div>
      </header>

      <main style={contentStyle}>
        <div style={gameCardStyle} role="group" aria-label="Game area">
          <GameCanvas />
        </div>
      </main>

      <button
        className="theme-toggle"
        style={themeButtonStyle}
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
      </button>
    </div>
  );
}

export default App;
