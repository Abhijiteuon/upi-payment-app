import React, { useState, useEffect } from 'react';
import { 
  IconCreditCard, 
  IconSearch, 
  IconExternalLink, 
  IconShieldCheck,
  IconArrowRight,
  IconUser
} from './Icons';

function Navbar({ currentView, onNavigate, isAdminLoggedIn, onAdminLogout, activeProfile }) {
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
          <div className="nav-logo" onClick={() => handleNavClick('pay')} title="UPI Pay">
            <div className="nav-brand-icon-box">
              <IconShieldCheck size={18} className="text-emerald" />
            </div>
            <div className="nav-brand-text">
              <span className="logo-text">UPI Pay</span>
              <span className="logo-badge">SECURE</span>
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
                  <span>{activeProfile?.displayName ? `${activeProfile.displayName}` : 'Dashboard'}</span>
                </button>
                <button 
                  className="nav-logout-btn"
                  onClick={onAdminLogout}
                  title="Sign out of your session"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button 
                className={`desktop-nav-btn admin-portal-btn ${currentView === 'admin' ? 'active' : ''}`}
                onClick={() => handleNavClick('admin')}
              >
                <IconUser size={13} />
                <span>Merchant Account</span>
              </button>
            )}
          </nav>

          {/* Mobile Right Controls: Trust Pill + Hamburger */}
          <div className="mobile-nav-controls">
            <div className="nav-trust-pill">
              <IconShieldCheck size={13} className="text-emerald" />
              <span>Verified UPI</span>
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
            <div className="nav-brand-icon-box" style={{ width: 28, height: 28 }}>
              <IconShieldCheck size={16} className="text-emerald" />
            </div>
            <div>
              <span className="logo-text">UPI Pay</span>
              <span style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8' }}>
                Fast, Simple & Secure UPI Payments
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
          <div className="drawer-label">MENU</div>
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
              <button 
                className={`drawer-link-btn ${currentView === 'admin' ? 'active' : ''}`}
                onClick={() => handleNavClick('admin')}
              >
                <IconUser size={18} className="link-icon" />
                <span>{isAdminLoggedIn ? 'My Merchant Dashboard' : 'Merchant Portal (Login / Sign Up)'}</span>
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
                <IconExternalLink size={18} className="link-icon" />
                <span>Creator Portfolio</span>
                <IconArrowRight size={14} className="drawer-arrow" />
              </a>
            </li>
          </ul>

          {isAdminLoggedIn && (
            <>
              <div className="drawer-divider"></div>
              <ul className="drawer-links">
                <li>
                  <button 
                    className="drawer-link-btn drawer-logout-btn"
                    onClick={() => {
                      setIsOpen(false);
                      onAdminLogout();
                    }}
                  >
                    <span>Sign Out of Account</span>
                  </button>
                </li>
              </ul>
            </>
          )}
        </div>

        <div className="drawer-footer">
          <div className="drawer-security-note">
            <IconShieldCheck size={14} className="text-emerald" />
            <span>Instant & Direct UPI Settlement</span>
          </div>
        </div>
      </aside>

      {/* Modern Android Bottom Navigation Bar (Visible on mobile/tablet screens) */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        <button 
          type="button" 
          className={`bottom-nav-item ${currentView === 'pay' ? 'active' : ''}`}
          onClick={() => handleNavClick('pay')}
        >
          <div className="bottom-nav-icon">
            <IconCreditCard size={20} />
          </div>
          <span className="bottom-nav-label">Pay</span>
        </button>

        <button 
          type="button" 
          className={`bottom-nav-item ${currentView === 'status' ? 'active' : ''}`}
          onClick={() => handleNavClick('status')}
        >
          <div className="bottom-nav-icon">
            <IconSearch size={20} />
          </div>
          <span className="bottom-nav-label">Status</span>
        </button>

        <button 
          type="button" 
          className={`bottom-nav-item ${currentView === 'admin' ? 'active' : ''}`}
          onClick={() => handleNavClick('admin')}
        >
          <div className="bottom-nav-icon">
            <IconUser size={20} />
            {isAdminLoggedIn && <span className="bottom-nav-dot"></span>}
          </div>
          <span className="bottom-nav-label">{isAdminLoggedIn ? 'Dashboard' : 'Account'}</span>
        </button>
      </nav>
    </>
  );
}

export default Navbar;