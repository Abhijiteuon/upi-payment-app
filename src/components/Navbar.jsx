import React, { useState, useEffect } from 'react';

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
      <nav className="navbar">
        <div className="nav-container">
          <div className="nav-logo" onClick={() => handleNavClick('pay')}>
            <span className="logo-badge">⚡</span>
            <span className="logo-text">Pay Abhijit</span>
          </div>

          <button 
            className={`hamburger-btn ${isOpen ? 'active' : ''}`}
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={isOpen}
          >
            <span className="bar"></span>
            <span className="bar"></span>
            <span className="bar"></span>
          </button>
        </div>
      </nav>

      {/* Backdrop overlay */}
      {isOpen && (
        <div className="nav-backdrop" onClick={() => setIsOpen(false)} />
      )}

      {/* Slide-out Menu Drawer */}
      <div className={`nav-drawer ${isOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h3>Menu</h3>
          <button 
            className="drawer-close-btn"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
          >
            &times;
          </button>
        </div>

        <ul className="drawer-links">
          <li>
            <button 
              className={`drawer-link-btn ${currentView === 'pay' ? 'active' : ''}`}
              onClick={() => handleNavClick('pay')}
            >
              <span className="link-icon">💳</span>
              <span>Make a Payment</span>
            </button>
          </li>

          <li>
            <button 
              className={`drawer-link-btn ${currentView === 'status' ? 'active' : ''}`}
              onClick={() => handleNavClick('status')}
            >
              <span className="link-icon">🔍</span>
              <span>Check Payment Status</span>
            </button>
          </li>

          <li>
            <a 
              href="https://abhijitportfolio-five.vercel.app/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="drawer-link-btn external-link"
              onClick={() => setIsOpen(false)}
            >
              <span className="link-icon">👨‍💻</span>
              <span>Know About the Creator</span>
              <span className="external-arrow">↗</span>
            </a>
          </li>

          <li className="drawer-divider"></li>

          <li>
            <button 
              className={`drawer-link-btn admin-link ${currentView === 'admin' ? 'active' : ''}`}
              onClick={() => handleNavClick('admin')}
            >
              <span className="link-icon">🔒</span>
              <span>Admin Portal</span>
              {isAdminLoggedIn && <span className="auth-indicator">Active</span>}
            </button>
          </li>

          {isAdminLoggedIn && (
            <li>
              <button 
                className="drawer-link-btn logout-link"
                onClick={() => {
                  setIsOpen(false);
                  onAdminLogout();
                }}
              >
                <span className="link-icon">🚪</span>
                <span>Logout Admin</span>
              </button>
            </li>
          )}
        </ul>

        <div className="drawer-footer">
          <p>Secure UPI Payment System</p>
          <small>Verified by NPCI Standards</small>
        </div>
      </div>
    </>
  );
}

export default Navbar;
