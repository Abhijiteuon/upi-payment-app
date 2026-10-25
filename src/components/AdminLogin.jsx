import React, { useState } from 'react';
import { loginAdminWithSupabase } from '../services/storage';
import { 
  IconLock, 
  IconEye, 
  IconEyeOff, 
  IconAlertCircle, 
  IconShieldCheck,
  IconArrowRight 
} from './Icons';

function AdminLogin({ onLoginSuccess, onCancel }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

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
        <h1 className="main-title">Administrator Portal</h1>
        <p className="sub-title">
          Sign in to access live settlement verification & audit controls
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

        <div className="form-group">
          <label htmlFor="admin-email" className="field-label">Admin Email Address</label>
          <input
            type="email"
            id="admin-email"
            className="form-control"
            placeholder="admin@cloak.security"
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
              autoComplete="current-password"
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

        <button type="submit" className="primary-action-btn admin-submit-btn" disabled={isLoading}>
          <span>{isLoading ? 'Verifying Credentials...' : 'Sign In to Portal'}</span>
          <IconArrowRight size={17} />
        </button>

        <div className="admin-form-footer-actions">
          <button type="button" onClick={onCancel} className="ghost-back-btn">
            Cancel & Return to Payment
          </button>
        </div>

        <div className="admin-security-seal">
          <IconShieldCheck size={14} className="text-emerald" />
          <span>Restricted Portal • Authorized Staff Only</span>
        </div>
      </form>
    </div>
  );
}

export default AdminLogin;
