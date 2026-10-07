import React, { useState } from 'react';
import { validateAdminCredentials, setAdminSession } from '../services/storage';

function AdminLogin({ onLoginSuccess, onCancel }) {
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const isValid = validateAdminCredentials(name, nickname, password);
    if (isValid) {
      setAdminSession(true);
      onLoginSuccess();
    } else {
      setError('Invalid admin credentials. Access denied.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 600);
    }
  };

  return (
    <div className={`fade-in ${isShaking ? 'shake-animation' : ''}`}>
      <div className="header">
        <div className="admin-lock-icon">🔒</div>
        <h1>Secret Admin Portal</h1>
        <p>Enter your authorization credentials to access the verification control panel</p>
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

        <div className="form-group">
          <label htmlFor="admin-name">Admin Name</label>
          <input
            type="text"
            id="admin-name"
            className="form-control"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="off"
          />
        </div>

        <div className="form-group">
          <label htmlFor="admin-nickname">Nickname</label>
          <input
            type="text"
            id="admin-nickname"
            className="form-control"
            placeholder="Enter your nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
            autoComplete="off"
          />
        </div>

        <div className="form-group">
          <label htmlFor="admin-password">Secret Password</label>
          <div className="password-input-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              id="admin-password"
              className="form-control"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
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

        <button type="submit" className="submit-btn admin-submit-btn">
          Authenticate & Enter Portal
        </button>

        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <button type="button" onClick={onCancel} className="back-btn">
            Cancel & Return
          </button>
        </div>
      </form>
    </div>
  );
}

export default AdminLogin;
