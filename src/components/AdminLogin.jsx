import React, { useState } from 'react';
import { loginAdminWithSupabase, registerAdminWithSupabase } from '../services/storage';

function AdminLogin({ onLoginSuccess, onCancel }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 600);
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 600);
        return;
      }

      setIsLoading(true);
      const res = await registerAdminWithSupabase(email, password);
      setIsLoading(false);

      if (res.success) {
        if (res.requiresEmailConfirmation) {
          setSuccessMsg('Account registered! Please check your email to confirm registration or sign in if email confirmations are disabled.');
          setMode('login');
        } else {
          onLoginSuccess();
        }
      } else {
        setError(res.error || 'Registration failed.');
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 600);
      }
      return;
    }

    // Login mode
    setIsLoading(true);
    const result = await loginAdminWithSupabase(email, password);
    setIsLoading(false);

    if (result.success) {
      onLoginSuccess();
    } else {
      setError(result.error || 'Invalid credentials. Access denied.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 600);
    }
  };

  return (
    <div className={`fade-in ${isShaking ? 'shake-animation' : ''}`}>
      <div className="header">
        <div className="admin-lock-icon">🔒</div>
        <h1>{mode === 'login' ? 'Admin Security Portal' : 'Register Admin Account'}</h1>
        <p>
          {mode === 'login'
            ? 'Enter your verified administrator credentials to access the verification panel'
            : 'Set up an authorized administrator account in Supabase'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="admin-login-form">
        {error && (
          <div className="status-alert alert-error fade-in" style={{ marginBottom: '1.25rem' }}>
            <div className="alert-icon">🚫</div>
            <div className="alert-body">
              <p>{error}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="status-alert alert-success fade-in" style={{ marginBottom: '1.25rem' }}>
            <div className="alert-icon">✓</div>
            <div className="alert-body">
              <p>{successMsg}</p>
            </div>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="admin-email">Admin Email Address</label>
          <input
            type="email"
            id="admin-email"
            className="form-control"
            placeholder="admin@yourdomain.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label htmlFor="admin-password">Password</label>
          <div className="password-input-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              id="admin-password"
              className="form-control"
              placeholder="Enter secure password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            <button
              type="button"
              className="toggle-password-btn"
              onClick={() => setShowPassword(!showPassword)}
              aria-label="Toggle password visibility"
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>

        {mode === 'register' && (
          <div className="form-group">
            <label htmlFor="admin-confirm-password">Confirm Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              id="admin-confirm-password"
              className="form-control"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
        )}

        <button type="submit" className="submit-btn admin-submit-btn" disabled={isLoading}>
          {isLoading ? 'Authenticating...' : mode === 'login' ? 'Authenticate & Enter' : 'Create Admin Account'}
        </button>

        <div style={{ marginTop: '1.25rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button 
            type="button" 
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
              setSuccessMsg('');
            }}
            className="back-btn"
            style={{ fontSize: '0.85rem' }}
          >
            {mode === 'login' ? 'Need to create an admin account? Register here' : 'Already have an admin account? Sign in'}
          </button>

          <button type="button" onClick={onCancel} className="back-btn" style={{ opacity: 0.8 }}>
            Cancel & Return
          </button>
        </div>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>
          🛡️ Protected by Supabase JWT Authentication & Row Level Security
        </div>
      </form>
    </div>
  );
}

export default AdminLogin;
