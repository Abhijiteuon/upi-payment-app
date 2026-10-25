import React, { useState, useEffect } from 'react';
import { 
  IconCreditCard, 
  IconSearch, 
  IconExternalLink, 
  IconLock, 
  IconShieldCheck,
  IconArrowRight 
} from './Icons';

function Navbar({ currentView, onNavigate, isAdminLoggedIn, onAdminLogout }) {
  const [isOpen, setIsOpen] = useState(false);

  // Close menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavClick = (view) => {
    setIsOpen(false);
    onNavigate(view);
  };

  return (
    <>
      <header className="navbar">
        <div className="nav-container">
          {/* Brand Logo */}
          <div className="nav-logo" onClick={() => handleNavClick('pay')} title="CLOAK — Credential-less Link for Online Auth & Keys">
            <img src="/codeed-icon.png" alt="CLOAK" className="nav-logo-img" />
            <div className="nav-brand-text">
              <span className="logo-text">CLOAK</span>
              <span className="logo-badge">AUTH & KEYS</span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="desktop-nav-links">
            <button 
              className={`desktop-nav-btn ${currentView === 'pay' ? 'active' : ''}`}
              onClick={() => handleNavClick('pay')}
            >
              <IconCreditCard size={15} />
              <span>Make Payment</span>
            </button>

            <button 
              className={`desktop-nav-btn ${currentView === 'status' ? 'active' : ''}`}
              onClick={() => handleNavClick('status')}
            >
              <IconSearch size={15} />
              <span>Track Status</span>
            </button>

            <a 
              href="https://abhijitportfolio-five.vercel.app/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="desktop-nav-btn external"
            >
              <span>Creator</span>
              <IconExternalLink size={13} />
            </a>

            <div className="nav-vertical-divider"></div>

            {isAdminLoggedIn ? (
              <div className="admin-nav-group">
                <button 
                  className={`desktop-nav-btn admin-active ${currentView === 'admin' ? 'active' : ''}`}
                  onClick={() => handleNavClick('admin')}
                >
                  <span className="admin-status-dot"></span>
                  <span>Dashboard</span>
                </button>
                <button 
                  className="nav-logout-btn"
                  onClick={onAdminLogout}
                  title="Sign out of Admin session"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button 
                className={`desktop-nav-btn admin-portal-btn ${currentView === 'admin' ? 'active' : ''}`}
                onClick={() => handleNavClick('admin')}
              >
                <IconLock size={13} />
                <span>Admin</span>
              </button>
            )}
          </nav>

          {/* Mobile Right Controls: Trust Pill + Hamburger */}
          <div className="mobile-nav-controls">
            <div className="nav-trust-pill mobile-hide">
              <IconShieldCheck size={13} className="text-emerald" />
              <span>NPCI Encrypted</span>
            </div>

            <button 
              className={`hamburger-btn ${isOpen ? 'active' : ''}`}
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle navigation menu"
              aria-expanded={isOpen}
            >
              <span className="bar"></span>
              <span className="bar"></span>
            </button>
          </div>
        </div>
      </header>

      {/* Backdrop overlay */}
      {isOpen && (
        <div className="nav-backdrop" onClick={() => setIsOpen(false)} />
      )}

      {/* Slide-out Menu Drawer for Mobile */}
      <aside className={`nav-drawer ${isOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <div className="drawer-brand">
            <img src="/codeed-icon.png" alt="CLOAK" className="nav-logo-img" />
            <div>
              <span className="logo-text">CLOAK</span>
              <span style={{ display: 'block', fontSize: '0.62rem', color: '#94a3b8', letterSpacing: '0.04em' }}>
                Credential-less Link for Online Auth & Keys
              </span>
            </div>
          </div>
          <button 
            className="drawer-close-btn"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
          >
            &times;
          </button>
        </div>

        <div className="drawer-body">
          <div className="drawer-label">NAVIGATION</div>
          <ul className="drawer-links">
            <li>
              <button 
                className={`drawer-link-btn ${currentView === 'pay' ? 'active' : ''}`}
                onClick={() => handleNavClick('pay')}
              >
                <IconCreditCard size={18} className="link-icon" />
                <span>Make a Payment</span>
                <IconArrowRight size={14} className="drawer-arrow" />
              </button>
            </li>

            <li>
              <button 
                className={`drawer-link-btn ${currentView === 'status' ? 'active' : ''}`}
                onClick={() => handleNavClick('status')}
              >
                <IconSearch size={18} className="link-icon" />
                <span>Track Payment Status</span>
                <IconArrowRight size={14} className="drawer-arrow" />
              </button>
            </li>

            <li>
              <a 
                href="https://abhijitportfolio-five.vercel.app/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="drawer-link-btn"
                onClick={() => setIsOpen(false)}
              >
                <span className="link-icon">↗</span>
                <span>Know About the Creator</span>
                <IconExternalLink size={14} className="drawer-arrow" />
              </a>
            </li>
          </ul>

          <div className="drawer-divider"></div>

          <div className="drawer-label">SECURITY & ACCESS</div>
          <ul className="drawer-links">
            <li>
              <button 
                className={`drawer-link-btn admin-link ${currentView === 'admin' ? 'active' : ''}`}
                onClick={() => handleNavClick('admin')}
              >
                <IconLock size={18} className="link-icon" />
                <span>{isAdminLoggedIn ? 'Verification Dashboard' : 'Admin Security Portal'}</span>
              </button>
            </li>

            {isAdminLoggedIn && (
              <li>
                <button 
                  className="drawer-link-btn drawer-logout-btn"
                  onClick={() => {
                    setIsOpen(false);
                    onAdminLogout();
                  }}
                >
                  <span>Sign Out</span>
                </button>
              </li>
            )}
          </ul>
        </div>

        <div className="drawer-footer">
          <div className="drawer-security-note">
            <IconShieldCheck size={14} className="text-emerald" />
            <span>256-bit Encrypted • Direct ICICI UPI</span>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Navbar;
