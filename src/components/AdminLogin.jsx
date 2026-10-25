import React, { useState } from 'react';
import { loginAdminWithSupabase, registerAdminWithSupabase } from '../services/storage';
import { 
  IconLock, 
  IconEye, 
  IconEyeOff, 
  IconAlertCircle, 
  IconCheck, 
  IconShieldCheck,
  IconArrowRight 
} from './Icons';

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
        setError('Password must contain at least 6 characters.');
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 600);
        return;
      }

      setIsLoading(true);
      const res = await registerAdminWithSupabase(email, password);
      setIsLoading(false);

      if (res.success) {
        if (res.requiresEmailConfirmation) {
          setSuccessMsg('Account created. Check your email to confirm registration or sign in directly.');
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
      setError(result.error || 'Invalid administrator credentials. Access denied.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 600);
    }
  };

  return (
    <div className={`admin-login-wrapper fade-in ${isShaking ? 'shake-animation' : ''}`}>
      <div className="card-header-block text-center">
        <div className="admin-lock-badge">
          <IconLock size={26} className="lock-icon-svg" />
        </div>
        <h1 className="main-title">
          {mode === 'login' ? 'Administrator Portal' : 'Register Administrator'}
        </h1>
        <p className="sub-title">
          {mode === 'login'
            ? 'Authenticate to access live settlement verification & audit controls'
            : 'Initialize an authorized administrator account in Supabase Auth'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="admin-auth-form">
        {error && (
          <div className="status-alert alert-error fade-in">
            <IconAlertCircle size={18} className="alert-icon-svg" />
            <div className="alert-body">
              <p>{error}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="status-alert alert-success fade-in">
            <IconCheck size={18} className="alert-icon-svg text-emerald" />
            <div className="alert-body">
              <p>{successMsg}</p>
            </div>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="admin-email" className="field-label">Admin Email Address</label>
          <input
            type="email"
            id="admin-email"
            className="form-control"
            placeholder="admin@codeed.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus
          />
        </div>

        <div className="form-group">
          <label htmlFor="admin-password" className="field-label">Master Password</label>
          <div className="password-input-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              id="admin-password"
              className="form-control"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            <button
              type="button"
              className="password-toggle-action"
              onClick={() => setShowPassword(!showPassword)}
              aria-label="Toggle password visibility"
            >
              {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
            </button>
          </div>
        </div>

        {mode === 'register' && (
          <div className="form-group">
            <label htmlFor="admin-confirm-password" className="field-label">Confirm Master Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              id="admin-confirm-password"
              className="form-control"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
        )}

        <button type="submit" className="primary-action-btn admin-submit-btn" disabled={isLoading}>
          <span>{isLoading ? 'Verifying Credentials...' : mode === 'login' ? 'Sign In to Portal' : 'Create Admin Account'}</span>
          <IconArrowRight size={17} />
        </button>

        <div className="admin-form-footer-actions">
          <button 
            type="button" 
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
              setSuccessMsg('');
            }}
            className="ghost-text-btn"
          >
            {mode === 'login' ? 'Create new admin credentials' : 'Back to Administrator Login'}
          </button>

          <button type="button" onClick={onCancel} className="ghost-back-btn">
            Cancel & Return to Payment
          </button>
        </div>

        <div className="admin-security-seal">
          <IconShieldCheck size={14} className="text-emerald" />
          <span>Protected by Supabase JWT & Row Level Security</span>
        </div>
      </form>
    </div>
  );
}

export default AdminLogin;
