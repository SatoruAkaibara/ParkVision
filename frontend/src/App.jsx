import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import DriverDashboard from './pages/DriverDashboard';
import AdminDashboard from './pages/AdminDashboard';

// ─── NEUMORPHISM DESIGN TOKENS ────────────────────────────────────────────────
const NEU = {
  bg: '#e0e5ec',
  shadowLight: '#ffffff',
  shadowDark: '#a3b1c6',
  accent: '#4f8ef7',
  text: '#3d4f6e',
  fontDisplay: "'Syne', sans-serif",
  fontBody: "'DM Sans', sans-serif",
};

// ─── NAVIGATION BAR COMPONENT ─────────────────────────────────────────────────
const Navigation = () => {
  const location = useLocation();

  // Dynamic styling: Buttons look "pressed" if they match the current URL
  const getLinkStyle = (path) => {
    const isActive = location.pathname === path;
    return {
      padding: '12px 24px',
      borderRadius: '12px',
      textDecoration: 'none',
      color: isActive ? '#fff' : NEU.text,
      backgroundColor: isActive ? NEU.accent : NEU.bg,
      fontWeight: '700',
      fontFamily: NEU.fontBody,
      fontSize: '14px',
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      boxShadow: isActive
        ? `inset 4px 4px 10px rgba(0,0,0,0.15), inset -4px -4px 10px rgba(255,255,255,0.1)`
        : `4px 4px 10px ${NEU.shadowDark}, -4px -4px 10px ${NEU.shadowLight}`,
    };
  };

  return (
    <nav style={{
      padding: '20px',
      backgroundColor: NEU.bg,
      display: 'flex',
      gap: '20px',
      justifyContent: 'center',
      position: 'sticky',
      top: 0,
      zIndex: 1000
    }}>
      <Link to="/" style={getLinkStyle('/')}>
        <span style={{ fontSize: '18px' }}>🚗</span> Driver View
      </Link>
      <Link to="/admin" style={getLinkStyle('/admin')}>
        <span style={{ fontSize: '18px' }}>⚙️</span> Admin Panel
      </Link>
    </nav>
  );
};

// ─── MAIN APP COMPONENT ───────────────────────────────────────────────────────
function App() {
  return (
    <BrowserRouter>
      {/* Wrap everything in the Neu background color so the whole page matches */}
      <div style={{ backgroundColor: NEU.bg, minHeight: '100vh' }}>
        <Navigation />
        <Routes>
          <Route path="/" element={<DriverDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;