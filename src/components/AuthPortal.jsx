import React, { useState } from 'react';
import { loginMerchant, signUpMerchant, buildPaymentRequestUrl } from '../services/profileService';
import { 
  IconEye, 
  IconEyeOff, 
  IconAlertCircle, 
  IconShieldCheck,
  IconArrowRight,
  IconLink,
  IconCheck
} from './Icons';

function AuthPortal({ onLoginSuccess, onCancel }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Sign up form state
  const [signUpData, setSignUpData] = useState({
    displayName: '',
    username: '',
    upiId: '',
    email: '',
    password: '',
    bio: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 600);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    setIsLoading(true);
    const result = await loginMerchant(loginEmail, loginPassword);
    setIsLoading(false);

    if (result.success) {
      onLoginSuccess(result.profile);
    } else {
      setError(result.error || 'Invalid credentials. Access denied.');
      triggerShake();
    }
  };

  const handleSignUpSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    setIsLoading(true);
    const result = await signUpMerchant(signUpData);
    setIsLoading(false);

    if (result.success) {
      if (result.needsConfirmation) {
        setSuccessMsg('Account created! Please check your email to confirm registration, or sign in.');
        setMode('login');
      } else {
        onLoginSuccess(result.profile);
      }
    } else {
      setError(result.error || 'Failed to create merchant account.');
      triggerShake();
    }
  };

  const previewUrl = signUpData.username 
    ? buildPaymentRequestUrl(signUpData.username)
    : 'https://.../?to=yourname';

  return (
    <div className={`admin-login-wrapper fade-in ${isShaking ? 'shake-animation' : ''}`}>
      <div className="card-header-block text-center">
        <div className="admin-lock-badge">
          <IconShieldCheck size={28} className="lock-icon-svg text-emerald" />
        </div>
        <h1 className="main-title">
          {mode === 'login' ? 'Merchant Portal' : 'Create Merchant Account'}
        </h1>
        <p className="sub-title">
          {mode === 'login' 
            ? 'Access your personalized settlement dashboard, UPI payment links, and ledger' 
            : 'Accept direct UPI payments into your own bank account with zero MDR'}
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="auth-tab-switch">
        <button
          type="button"
          className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
          onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
        >
          <span>Sign In</span>
        </button>
        <button
          type="button"
          className={`auth-tab-btn ${mode === 'signup' ? 'active' : ''}`}
          onClick={() => { setMode('signup'); setError(''); setSuccessMsg(''); }}
        >
          <span>Create Account</span>
        </button>
      </div>

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

      {/* LOGIN FORM */}
      {mode === 'login' && (
        <form onSubmit={handleLoginSubmit} className="admin-auth-form">
          <div className="form-group">
            <label htmlFor="login-email" className="field-label">Account Email Address</label>
            <input
              type="email"
              id="login-email"
              className="form-control"
              placeholder="you@domain.com"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password" className="field-label">Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="login-password"
                className="form-control"
                placeholder="Enter your password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
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
            <span>{isLoading ? 'Authenticating...' : 'Sign In to Dashboard'}</span>
            <IconArrowRight size={17} />
          </button>

          <div className="auth-footer-prompt">
            <span>New to CLOAK? </span>
            <button 
              type="button" 
              className="auth-link-inline" 
              onClick={() => { setMode('signup'); setError(''); }}
            >
              Create your free merchant account
            </button>
          </div>
        </form>
      )}

      {/* SIGN UP FORM */}
      {mode === 'signup' && (
        <form onSubmit={handleSignUpSubmit} className="admin-auth-form signup-grid">
          <div className="form-row-2col">
            <div className="form-group">
              <label className="field-label">Display / Business Name *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Acme Studio or Rahul Sharma"
                value={signUpData.displayName}
                onChange={(e) => setSignUpData({ ...signUpData, displayName: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="field-label">Username / Handle *</label>
              <input
                type="text"
                className="form-control mono"
                placeholder="e.g. rahul or acmestudio"
                value={signUpData.username}
                onChange={(e) => setSignUpData({ ...signUpData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                required
              />
            </div>
          </div>

          {/* Live Link Preview Pill */}
          <div className="link-preview-pill">
            <IconLink size={14} className="text-emerald" />
            <span className="preview-label">Your Payment Link:</span>
            <span className="preview-url mono">{previewUrl}</span>
          </div>

          <div className="form-group">
            <label className="field-label">Your Receiving UPI ID (VPA) *</label>
            <div className="input-with-icon">
              <input
                type="text"
                className="form-control mono"
                placeholder="e.g. yourname@okhdfcbank or merchant@icici"
                value={signUpData.upiId}
                onChange={(e) => setSignUpData({ ...signUpData, upiId: e.target.value.trim() })}
                required
              />
            </div>
            <span className="field-helper-text">
              Direct settlement: Payments made to your link will be credited directly to this UPI ID.
            </span>
          </div>

          <div className="form-row-2col">
            <div className="form-group">
              <label className="field-label">Email Address *</label>
              <input
                type="email"
                className="form-control"
                placeholder="you@domain.com"
                value={signUpData.email}
                onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="field-label">Create Password *</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-control"
                  placeholder="Min 6 characters"
                  value={signUpData.password}
                  onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="password-toggle-action"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
            </div>
          </div>

          <button type="submit" className="primary-action-btn admin-submit-btn" disabled={isLoading}>
            <span>{isLoading ? 'Creating Account...' : 'Create Account & Start Accepting Payments'}</span>
            <IconArrowRight size={17} />
          </button>

          <div className="auth-footer-prompt">
            <span>Already registered? </span>
            <button 
              type="button" 
              className="auth-link-inline" 
              onClick={() => { setMode('login'); setError(''); }}
            >
              Sign in to your dashboard
            </button>
          </div>
        </form>
      )}

      {onCancel && (
        <div className="admin-cancel-container">
          <button type="button" onClick={onCancel} className="ghost-back-btn cancel-btn">
            ← Return to Payment Screen
          </button>
        </div>
      )}
    </div>
  );
}

export default AuthPortal;
