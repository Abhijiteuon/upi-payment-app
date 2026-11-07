import React, { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  getTransactions, 
  deleteTransaction, 
  addTransaction, 
  fetchRemoteTransactions, 
  updateRemoteStatus,
  subscribeToAllTransactions
} from '../services/storage';
import { 
  getActiveProfile, 
  updateMerchantProfile, 
  buildPaymentRequestUrl,
  logoutMerchantSession 
} from '../services/profileService';
import { validateUPI } from '../services/security';
import PaymentReceipt from './PaymentReceipt';
import { 
  IconShieldCheck, 
  IconRefresh, 
  IconDownload, 
  IconTrash, 
  IconSearch, 
  IconCheck, 
  IconAlertCircle, 
  IconCopy,
  IconShare,
  IconLink,
  IconQrCode,
  IconEdit,
  IconSmartPhone,
  IconExternalLink
} from './Icons';

function UserDashboard({ onLogout, onProfileUpdate, onPreviewPayment }) {
  const [profile, setProfile] = useState(() => getActiveProfile() || {
    username: '',
    displayName: 'Merchant',
    upiId: '',
    bio: ''
  });

  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [notification, setNotification] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Profile Edit Modal
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(profile.displayName || '');
  const [editUpiId, setEditUpiId] = useState(profile.upiId || '');
  const [editBio, setEditBio] = useState(profile.bio || '');
  const [profileModalError, setProfileModalError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Custom Payment Link Generator state
  const [customAmount, setCustomAmount] = useState('');
  const [customPurpose, setCustomPurpose] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPermLink, setCopiedPermLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrModalUrl, setQrModalUrl] = useState('');
  const [qrModalTitle, setQrModalTitle] = useState('');

  // 3-Point Bank Cross-Check Settlement Modal
  const [verifyingTx, setVerifyingTx] = useState(null);
  const [checkAmount, setCheckAmount] = useState(false);
  const [checkUtr, setCheckUtr] = useState(false);
  const [checkTime, setCheckTime] = useState(false);
  const [adminNote, setAdminNote] = useState('');

  // View Receipt Modal
  const [inspectingTx, setInspectingTx] = useState(null);

  // Add Manual Entry Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    name: '',
    email: '',
    phone: '',
    purpose: 'Direct Bank Settlement',
    source: 'Individual',
    amount: '',
    utr: ''
  });

  const loadData = async (showToastMsg = false) => {
    setIsLoading(true);
    const activeProf = getActiveProfile();
    if (!activeProf || !activeProf.username) {
      if (onLogout) onLogout();
      setIsLoading(false);
      return;
    }
    setProfile(activeProf);

    const result = await fetchRemoteTransactions(activeProf.username, activeProf.id);
    if (result.success && Array.isArray(result.transactions)) {
      setTransactions(result.transactions);
      if (showToastMsg) showToast('Synchronized with live ledger');
    } else {
      // Filter local cache by current user
      const local = getTransactions().filter(t => 
        !t.payeeUsername || t.payeeUsername.toLowerCase() === activeProf.username.toLowerCase()
      );
      setTransactions(local);
      if (showToastMsg) showToast('Loaded cached records');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();

    const unsubscribe = subscribeToAllTransactions(() => {
      loadData(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const showToast = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3500);
  };

  // Profile Save
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileModalError('');

    const upiCheck = validateUPI(editUpiId);
    if (!upiCheck.valid) {
      setProfileModalError(upiCheck.error);
      return;
    }

    setIsSavingProfile(true);
    const res = await updateMerchantProfile({
      displayName: editDisplayName,
      upiId: editUpiId,
      bio: editBio
    });
    setIsSavingProfile(false);

    if (res.success) {
      setProfile(res.profile);
      setShowProfileModal(false);
      showToast('Profile and receiving UPI ID updated successfully!');
      if (onProfileUpdate) onProfileUpdate(res.profile);
    } else {
      setProfileModalError(res.error || 'Failed to update profile.');
    }
  };

  // Permanent link
  const permanentLink = useMemo(() => {
    return buildPaymentRequestUrl(profile.username);
  }, [profile.username]);

  // Dynamic custom link
  const customLink = useMemo(() => {
    return buildPaymentRequestUrl(profile.username, customAmount, customPurpose);
  }, [profile.username, customAmount, customPurpose]);

  const handleCopyPermanentLink = () => {
    navigator.clipboard.writeText(permanentLink).then(() => {
      setCopiedPermLink(true);
      setTimeout(() => setCopiedPermLink(false), 2000);
      showToast('Payment link copied to clipboard!');
    });
  };

  const handleCopyCustomLink = () => {
    navigator.clipboard.writeText(customLink).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      showToast('Custom payment request link copied!');
    });
  };

  const handleShareWhatsApp = (url, amount = '', purpose = '') => {
    const text = amount && parseFloat(amount) > 0
      ? `Hi! Please complete payment of ₹${Number(amount).toLocaleString('en-IN')} for ${purpose || 'Services'} via CLOAK: ${url}`
      : `Hi! You can make a direct UPI payment to ${profile.displayName} via this link: ${url}`;
    
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const openQrModal = (url, title) => {
    setQrModalUrl(url);
    setQrModalTitle(title);
    setShowQrModal(true);
  };

  // 3-Point Bank Cross-Check Approval
  const handleInitiateVerification = (tx) => {
    setVerifyingTx(tx);
    setCheckAmount(false);
    setCheckUtr(false);
    setCheckTime(false);
    setAdminNote('');
  };

  const handleConfirmVerification = async () => {
    if (!verifyingTx) return;

    if (!checkAmount || !checkUtr || !checkTime) {
      alert('Security Protocol Violation: You must inspect and check all 3 verification points before approving settlement.');
      return;
    }

    setIsLoading(true);
    const result = await updateRemoteStatus(
      verifyingTx.verificationId, 
      'successful', 
      adminNote || 'Verified by Account Holder via 3-Point Bank Cross-Check'
    );
    setIsLoading(false);

    if (result.success) {
      showToast(`Transaction ${verifyingTx.verificationId} verified and settled!`);
      setVerifyingTx(null);
      loadData();
    } else {
      alert(result.error || 'Failed to update transaction status.');
    }
  };

  const handleRejectTransaction = async (tx) => {
    const reason = window.prompt(`Please provide a reason for rejecting transaction ${tx.verificationId}:`, 'UTR not found in bank statement');
    if (reason === null) return;

    setIsLoading(true);
    const result = await updateRemoteStatus(tx.verificationId, 'failed', `Rejected: ${reason}`);
    setIsLoading(false);

    if (result.success) {
      showToast(`Transaction ${tx.verificationId} marked as failed.`);
      loadData();
    }
  };

  const handleDeleteTransaction = async (verificationId) => {
    if (!window.confirm(`Are you sure you want to delete record ${verificationId}?`)) return;
    setIsLoading(true);
    await deleteTransaction(verificationId);
    setIsLoading(false);
    showToast('Record removed.');
    loadData();
  };

  const handleCreateManualTx = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const newTx = await addTransaction({
      ...manualForm,
      payeeUsername: profile.username,
      payeeId: profile.id,
      payeeUpi: profile.upiId,
      payeeDisplayName: profile.displayName
    });

    if (manualForm.utr) {
      await updateRemoteStatus(newTx.verificationId, 'successful', 'Manually logged by Account Holder', manualForm.utr);
    }

    setIsLoading(false);
    setShowAddModal(false);
    setManualForm({
      name: '',
      email: '',
      phone: '',
      purpose: 'Direct Bank Settlement',
      source: 'Individual',
      amount: '',
      utr: ''
    });
    showToast('Manual transaction recorded.');
    loadData();
  };

  // Filter & Search
  const filteredTransactions = transactions.filter(tx => {
    if (tx.status === 'deleted') return false;
    
    // Status filter
    if (filterStatus !== 'all' && tx.status !== filterStatus) return false;

    // Search query
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchId = (tx.verificationId || '').toLowerCase().includes(q);
      const matchName = (tx.name || '').toLowerCase().includes(q);
      const matchUtr = (tx.utr || '').toLowerCase().includes(q);
      const matchPurpose = (tx.purpose || '').toLowerCase().includes(q);
      return matchId || matchName || matchUtr || matchPurpose;
    }

    return true;
  });

  // Financial Telemetry (strictly scoped to this user)
  const stats = useMemo(() => {
    const active = transactions.filter(t => t.status !== 'deleted');
    const successful = active.filter(t => t.status === 'successful');
    const pending = active.filter(t => t.status === 'pending');
    
    const totalRevenue = successful.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const pendingAmount = pending.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    const todayStr = new Date().toISOString().split('T')[0];
    const todayRevenue = successful
      .filter(t => (t.verifiedAt || t.createdAt || '').startsWith(todayStr))
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    const successRate = active.length > 0 
      ? Math.round((successful.length / active.length) * 100) 
      : 100;

    return {
      totalRevenue,
      pendingAmount,
      todayRevenue,
      pendingCount: pending.length,
      successRate,
      totalCount: active.length
    };
  }, [transactions]);

  const handleLogout = async () => {
    await logoutMerchantSession();
    if (onLogout) onLogout();
  };

  return (
    <div className="user-dashboard-wrapper fade-in">
      
      {/* Toast Notification */}
      {notification && (
        <div className="floating-toast fade-in">
          <IconShieldCheck size={16} className="text-emerald" />
          <span>{notification}</span>
        </div>
      )}

      {/* 1. MERCHANT PROFILE & IDENTITY HEADER */}
      <div className="merchant-profile-header">
        <div className="merchant-identity-row">
          <div className="merchant-avatar-badge">
            <span className="avatar-letter">
              {(profile.displayName || profile.username || 'M').charAt(0).toUpperCase()}
            </span>
          </div>

          <div className="merchant-meta-details">
            <div className="merchant-name-line">
              <h1 className="merchant-display-name">{profile.displayName || 'Merchant'}</h1>
              <span className="merchant-handle-pill mono">@{profile.username}</span>
              <span className="merchant-status-badge">
                <span className="pulsing-green-dot"></span>
                Active & Ready
              </span>
            </div>

            <div className="merchant-vpa-row">
              <span className="vpa-field-tag">RECEIVING UPI:</span>
              <span className="vpa-field-value mono">{profile.upiId}</span>
              <button 
                type="button" 
                className="edit-profile-btn"
                onClick={() => {
                  setEditDisplayName(profile.displayName || '');
                  setEditUpiId(profile.upiId || '');
                  setEditBio(profile.bio || '');
                  setProfileModalError('');
                  setShowProfileModal(true);
                }}
                title="Change receiving UPI ID or display name"
              >
                <IconEdit size={13} />
                <span>Change UPI ID</span>
              </button>
            </div>
          </div>

          <div className="merchant-header-actions">
            <button 
              type="button" 
              className="refresh-btn-outline" 
              onClick={() => loadData(true)}
              disabled={isLoading}
              title="Sync with live database"
            >
              <IconRefresh size={15} className={isLoading ? 'spinning' : ''} />
              <span>Sync</span>
            </button>
            <button 
              type="button" 
              className="logout-btn-outline" 
              onClick={handleLogout}
              title="Sign out of your dashboard"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* 2. PAYMENT REQUEST LINK & SHARE CENTER */}
      <div className="share-center-grid">
        
        {/* Card A: Permanent Profile Link */}
        <div className="share-card permanent-link-card">
          <div className="share-card-header">
            <div className="card-tag">
              <IconLink size={14} className="text-emerald" />
              <span>YOUR PERMANENT UPI LINK</span>
            </div>
            <span className="share-hint">Direct link to accept any amount</span>
          </div>

          <div className="share-link-box">
            <span className="share-url-text mono">{permanentLink}</span>
          </div>

          <div className="share-actions-row">
            <button 
              type="button" 
              className="share-action-btn primary"
              onClick={handleCopyPermanentLink}
            >
              {copiedPermLink ? <IconCheck size={14} /> : <IconCopy size={14} />}
              <span>{copiedPermLink ? 'Copied Link' : 'Copy Link'}</span>
            </button>

            <button 
              type="button" 
              className="share-action-btn whatsapp"
              onClick={() => handleShareWhatsApp(permanentLink)}
            >
              <IconShare size={14} />
              <span>Share via WhatsApp</span>
            </button>

            <button 
              type="button" 
              className="share-action-btn secondary"
              onClick={() => openQrModal(permanentLink, `Payment QR for ${profile.displayName}`)}
            >
              <IconQrCode size={14} />
              <span>Show QR</span>
            </button>

            <button 
              type="button" 
              className="share-action-btn preview"
              onClick={() => onPreviewPayment && onPreviewPayment(profile)}
              title="Test & preview what your payers will see"
            >
              <IconExternalLink size={14} />
              <span>Preview Link</span>
            </button>
          </div>
        </div>

        {/* Card B: Custom Payment Request Link Generator */}
        <div className="share-card custom-request-card">
          <div className="share-card-header">
            <div className="card-tag">
              <IconSmartPhone size={14} className="text-sky" />
              <span>CREATE PAYMENT REQUEST LINK</span>
            </div>
            <span className="share-hint">Pre-fill amount & invoice description</span>
          </div>

          <div className="custom-link-inputs">
            <div className="form-group mb-0">
              <div className="amount-input-box small-box">
                <span className="currency-symbol">₹</span>
                <input
                  type="number"
                  className="amount-input small-input"
                  placeholder="Amount (e.g. 1500)"
                  min="1"
                  max="100000"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group mb-0">
              <input
                type="text"
                className="form-control small-control"
                placeholder="Description / Purpose (e.g. Freelance Web App)"
                value={customPurpose}
                onChange={(e) => setCustomPurpose(e.target.value)}
              />
            </div>
          </div>

          <div className="share-actions-row">
            <button 
              type="button" 
              className="share-action-btn primary"
              onClick={handleCopyCustomLink}
            >
              {copiedLink ? <IconCheck size={14} /> : <IconCopy size={14} />}
              <span>{copiedLink ? 'Copied Request' : 'Copy Request Link'}</span>
            </button>

            <button 
              type="button" 
              className="share-action-btn whatsapp"
              onClick={() => handleShareWhatsApp(customLink, customAmount, customPurpose)}
            >
              <IconShare size={14} />
              <span>WhatsApp Request</span>
            </button>

            <button 
              type="button" 
              className="share-action-btn secondary"
              onClick={() => openQrModal(
                customLink, 
                `Request ₹${customAmount || '0'} - ${customPurpose || 'Payment'}`
              )}
            >
              <IconQrCode size={14} />
              <span>Preview QR</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. PERSONAL FINANCIAL METRICS */}
      <div className="telemetry-grid">
        <div className="telemetry-card">
          <div className="telemetry-label">TOTAL SETTLED (₹)</div>
          <div className="telemetry-val text-emerald">
            ₹{stats.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="telemetry-sub">Direct credit into {profile.upiId}</div>
        </div>

        <div className="telemetry-card">
          <div className="telemetry-label">PENDING VERIFICATIONS</div>
          <div className="telemetry-val text-amber">
            {stats.pendingCount}
          </div>
          <div className="telemetry-sub">
            {stats.pendingCount > 0 ? `₹${stats.pendingAmount.toLocaleString('en-IN')} awaiting match` : 'All payments reconciled'}
          </div>
        </div>

        <div className="telemetry-card">
          <div className="telemetry-label">TODAY'S VOLUME</div>
          <div className="telemetry-val text-sky">
            ₹{stats.todayRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="telemetry-sub">Settled within last 24h</div>
        </div>

        <div className="telemetry-card">
          <div className="telemetry-label">VERIFICATION RATE</div>
          <div className="telemetry-val">
            {stats.successRate}%
          </div>
          <div className="telemetry-sub">{stats.totalCount} total logged transactions</div>
        </div>
      </div>

      {/* 4. TRANSACTION LEDGER SECTION */}
      <div className="ledger-card-wrapper">
        <div className="ledger-header-row">
          <div className="ledger-title-group">
            <h2 className="ledger-main-title">Incoming Payment Ledger</h2>
            <p className="ledger-sub-title">
              Match 12-digit UTR numbers against your UPI app to verify incoming credits
            </p>
          </div>

          <div className="ledger-controls-group">
            {/* Search Box */}
            <div className="ledger-search-box">
              <IconSearch size={14} className="search-icon-svg" />
              <input
                type="text"
                placeholder="Search by UTR, Name, ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input-field"
              />
              {searchTerm && (
                <button type="button" onClick={() => setSearchTerm('')} className="search-clear-btn">×</button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="ledger-filter-tabs">
              <button 
                type="button" 
                className={`filter-pill ${filterStatus === 'all' ? 'active' : ''}`}
                onClick={() => setFilterStatus('all')}
              >
                All ({transactions.length})
              </button>
              <button 
                type="button" 
                className={`filter-pill ${filterStatus === 'pending' ? 'active' : ''}`}
                onClick={() => setFilterStatus('pending')}
              >
                Pending ({transactions.filter(t => t.status === 'pending').length})
              </button>
              <button 
                type="button" 
                className={`filter-pill ${filterStatus === 'successful' ? 'active' : ''}`}
                onClick={() => setFilterStatus('successful')}
              >
                Verified ({transactions.filter(t => t.status === 'successful').length})
              </button>
            </div>

            <button 
              type="button" 
              className="primary-action-btn new-entry-btn"
              onClick={() => setShowAddModal(true)}
            >
              <span>+ Manual Entry</span>
            </button>
          </div>
        </div>

        {/* Transactions Table (Desktop) */}
        <div className="ledger-table-container desktop-only-table">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>TIMESTAMP</th>
                <th>TRACKING ID</th>
                <th>PAYER</th>
                <th>AMOUNT</th>
                <th>12-DIGIT UTR</th>
                <th>PURPOSE</th>
                <th>STATUS</th>
                <th className="text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-ledger-cell">
                    <div className="empty-ledger-state">
                      <IconShieldCheck size={32} className="empty-icon text-muted" />
                      <p className="empty-title">No transactions located</p>
                      <span className="empty-sub">
                        Share your payment link to start receiving payments directly to your UPI ID
                      </span>
                      <button 
                        type="button" 
                        className="share-action-btn primary mt-3"
                        onClick={handleCopyPermanentLink}
                      >
                        <IconCopy size={14} />
                        <span>Copy Your Payment Link</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.verificationId || tx.id} className={`tx-row status-${tx.status}`}>
                    
                    {/* Timestamp */}
                    <td className="timestamp-cell mono">
                      {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short'
                      })}
                      <span className="time-sub">
                        {new Date(tx.createdAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </td>

                    {/* Verification ID */}
                    <td className="ver-id-cell mono">
                      <span 
                        className="clickable-link" 
                        onClick={() => setInspectingTx(tx)} 
                        title="Click to view digital receipt"
                      >
                        {tx.verificationId}
                      </span>
                    </td>

                    {/* Payer Name & Contact */}
                    <td className="payer-cell">
                      <div className="payer-name">{tx.name || 'Anonymous'}</div>
                      <div className="payer-contact mono text-muted">
                        {tx.phone || tx.email || '—'}
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="amount-cell mono font-semibold">
                      ₹{Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    {/* 12-digit UTR */}
                    <td className="utr-cell mono">
                      {tx.utr ? (
                        <span className="utr-badge" title="Bank UTR Number">
                          {tx.utr}
                        </span>
                      ) : (
                        <span className="utr-missing text-muted">Awaiting UTR</span>
                      )}
                    </td>

                    {/* Purpose */}
                    <td className="purpose-cell" title={tx.purpose}>
                      {tx.purpose || 'UPI Payment'}
                    </td>

                    {/* Status Badge */}
                    <td className="status-cell">
                      {tx.status === 'successful' && (
                        <span className="badge-status badge-success">
                          <span className="dot"></span>
                          Verified
                        </span>
                      )}
                      {tx.status === 'pending' && (
                        <span className="badge-status badge-pending">
                          <span className="dot pulse"></span>
                          Pending
                        </span>
                      )}
                      {tx.status === 'failed' && (
                        <span className="badge-status badge-failed">
                          <span className="dot"></span>
                          Rejected
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="actions-cell text-right">
                      <div className="table-actions-group">
                        {tx.status === 'pending' && (
                          <button 
                            type="button" 
                            className="btn-action-verify"
                            onClick={() => handleInitiateVerification(tx)}
                            title="Verify & Settle"
                          >
                            <IconCheck size={13} />
                            <span>Verify</span>
                          </button>
                        )}

                        <button 
                          type="button" 
                          className="btn-action-view"
                          onClick={() => setInspectingTx(tx)}
                          title="View Official Receipt"
                        >
                          <IconDownload size={13} />
                        </button>

                        {tx.status === 'pending' && (
                          <button 
                            type="button" 
                            className="btn-action-reject"
                            onClick={() => handleRejectTransaction(tx)}
                            title="Reject Payment"
                          >
                            ×
                          </button>
                        )}

                        <button 
                          type="button" 
                          className="btn-action-delete"
                          onClick={() => handleDeleteTransaction(tx.verificationId)}
                          title="Delete Record"
                        >
                          <IconTrash size={13} />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Android / Mobile View: Native Transaction Cards */}
        <div className="mobile-only-cards">
          {filteredTransactions.length === 0 ? (
            <div className="empty-ledger-state mobile-empty-state">
              <IconShieldCheck size={36} className="empty-icon text-muted" />
              <p className="empty-title">No transactions located</p>
              <span className="empty-sub">
                Share your payment link to start receiving payments.
              </span>
              <button 
                type="button" 
                className="share-action-btn primary mt-3"
                onClick={handleCopyPermanentLink}
              >
                <IconCopy size={14} />
                <span>Copy Your Payment Link</span>
              </button>
            </div>
          ) : (
            filteredTransactions.map((tx) => (
              <div key={tx.verificationId || tx.id} className={`mobile-tx-card status-${tx.status}`}>
                <div className="mobile-tx-header">
                  <div className="mobile-tx-user-info">
                    <div className="mobile-tx-avatar">
                      {(tx.name || 'G').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="mobile-tx-name">{tx.name || 'Guest Payer'}</div>
                      <div className="mobile-tx-time">
                        {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}, {new Date(tx.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <div className="mobile-tx-amount-col text-right">
                    <div className="mobile-tx-amount mono">
                      +₹{Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <span className={`badge-status badge-${tx.status === 'successful' ? 'success' : tx.status === 'failed' ? 'failed' : 'pending'}`}>
                      <span className={`dot ${tx.status === 'pending' ? 'pulse' : ''}`}></span>
                      {tx.status === 'successful' ? 'Verified' : tx.status === 'failed' ? 'Rejected' : 'Pending'}
                    </span>
                  </div>
                </div>

                <div className="mobile-tx-body">
                  <div className="mobile-tx-meta-row">
                    <span className="label">Ref ID:</span>
                    <span className="mono">{tx.verificationId}</span>
                  </div>
                  {tx.utr && (
                    <div className="mobile-tx-meta-row">
                      <span className="label">UTR:</span>
                      <span className="mono text-emerald font-semibold">{tx.utr}</span>
                    </div>
                  )}
                  {tx.purpose && (
                    <div className="mobile-tx-meta-row">
                      <span className="label">Note:</span>
                      <span>{tx.purpose}</span>
                    </div>
                  )}
                </div>

                <div className="mobile-tx-actions-row">
                  {tx.status === 'pending' && (
                    <button 
                      type="button" 
                      className="mobile-tx-btn verify-btn"
                      onClick={() => handleInitiateVerification(tx)}
                    >
                      <IconCheck size={14} />
                      <span>Verify</span>
                    </button>
                  )}
                  <button 
                    type="button" 
                    className="mobile-tx-btn secondary-btn"
                    onClick={() => setInspectingTx(tx)}
                  >
                    <span>Receipt</span>
                  </button>
                  {tx.status === 'pending' && (
                    <button 
                      type="button" 
                      className="mobile-tx-btn reject-btn"
                      onClick={() => handleRejectTransaction(tx)}
                    >
                      <span>Reject</span>
                    </button>
                  )}
                  <button 
                    type="button" 
                    className="mobile-tx-btn delete-btn"
                    onClick={() => handleDeleteTransaction(tx.verificationId)}
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: EDIT PROFILE & RECEIVING UPI ID */}
      {/* ========================================================================= */}
      {showProfileModal && (
        <div className="modal-backdrop fade-in">
          <div className="modal-dialog-box">
            <div className="modal-header-row">
              <div className="modal-title-col">
                <h3 className="modal-title">Receiving Account Settings</h3>
                <p className="modal-subtitle">Configure where payments sent to your links are deposited</p>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setShowProfileModal(false)}>×</button>
            </div>

            {profileModalError && (
              <div className="status-alert alert-error mb-3">
                <IconAlertCircle size={16} />
                <span>{profileModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="modal-form-body">
              <div className="form-group">
                <label className="field-label">Display / Business Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="field-label">Your Receiving UPI ID (VPA) *</label>
                <input
                  type="text"
                  className="form-control mono"
                  placeholder="e.g. yourname@okhdfcbank"
                  value={editUpiId}
                  onChange={(e) => setEditUpiId(e.target.value)}
                  required
                />
                <span className="field-helper-text">
                  Any payer scanning your QR or clicking your link will transfer money directly to this UPI ID.
                </span>
              </div>

              <div className="form-group">
                <label className="field-label">About / Bio (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Full-Stack Developer & UI Designer"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                />
              </div>

              <div className="modal-cta-row">
                <button type="submit" className="primary-action-btn" disabled={isSavingProfile}>
                  <span>{isSavingProfile ? 'Saving...' : 'Update Settings'}</span>
                  <IconCheck size={16} />
                </button>
                <button type="button" className="ghost-back-btn" onClick={() => setShowProfileModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: 3-POINT BANK CROSS-CHECK VERIFICATION */}
      {/* ========================================================================= */}
      {verifyingTx && (
        <div className="modal-backdrop fade-in">
          <div className="modal-dialog-box verification-modal">
            <div className="modal-header-row">
              <div className="modal-title-col">
                <div className="header-meta-pill">
                  <IconShieldCheck size={14} className="text-emerald" />
                  <span>PAYMENT VERIFICATION</span>
                </div>
                <h3 className="modal-title">Confirm Received Payment</h3>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setVerifyingTx(null)}>×</button>
            </div>

            <div className="verify-target-summary">
              <div className="summary-item">
                <span className="label">AMOUNT TO VERIFY:</span>
                <span className="value mono text-emerald font-bold">
                  ₹{Number(verifyingTx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="summary-item">
                <span className="label">SUBMITTED UTR:</span>
                <span className="value mono font-semibold">
                  {verifyingTx.utr || 'NO UTR PROVIDED'}
                </span>
              </div>
              <div className="summary-item">
                <span className="label">PAYER NAME:</span>
                <span className="value">{verifyingTx.name || 'Anonymous'}</span>
              </div>
            </div>

            <div className="verification-checkpoints">
              <p className="checkpoints-prompt">
                Please check your bank app (e.g. iMobile, GPay, HDFC) and confirm:
              </p>

              <label className="checkpoint-row">
                <input
                  type="checkbox"
                  checked={checkAmount}
                  onChange={(e) => setCheckAmount(e.target.checked)}
                />
                <div className="checkpoint-text">
                  <strong>Checkpoint 1: Exact Amount Received</strong>
                  <span>Confirmed ₹{verifyingTx.amount} was credited to {profile.upiId}.</span>
                </div>
              </label>

              <label className="checkpoint-row">
                <input
                  type="checkbox"
                  checked={checkUtr}
                  onChange={(e) => setCheckUtr(e.target.checked)}
                />
                <div className="checkpoint-text">
                  <strong>Checkpoint 2: Bank UTR Reference Match</strong>
                  <span>Confirmed 12-digit reference matches statement entry.</span>
                </div>
              </label>

              <label className="checkpoint-row">
                <input
                  type="checkbox"
                  checked={checkTime}
                  onChange={(e) => setCheckTime(e.target.checked)}
                />
                <div className="checkpoint-text">
                  <strong>Checkpoint 3: Credit Timestamp Alignment</strong>
                  <span>Credit occurred on or after payment session initiation.</span>
                </div>
              </label>
            </div>

            <div className="form-group mt-3">
              <label className="field-label">Settlement Note (Optional)</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Bank SMS credit verified on ICICI switch"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
              />
            </div>

            <div className="modal-cta-row">
              <button 
                type="button" 
                className="primary-action-btn verify-confirm-btn"
                onClick={handleConfirmVerification}
                disabled={!checkAmount || !checkUtr || !checkTime || isLoading}
              >
                <IconCheck size={16} />
                <span>{isLoading ? 'Settling...' : 'Approve & Unlock Official Receipt'}</span>
              </button>
              <button type="button" className="ghost-back-btn" onClick={() => setVerifyingTx(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: LIVE QR CODE MODAL FOR SHARING */}
      {/* ========================================================================= */}
      {showQrModal && (
        <div className="modal-backdrop fade-in" onClick={() => setShowQrModal(false)}>
          <div className="modal-dialog-box qr-share-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <h3 className="modal-title">{qrModalTitle || 'Scan to Pay'}</h3>
              <button type="button" className="modal-close-btn" onClick={() => setShowQrModal(false)}>×</button>
            </div>

            <div className="qr-terminal-preview text-center">
              <div className="qr-render-box">
                <QRCodeSVG 
                  value={qrModalUrl}
                  size={220}
                  level="H"
                  includeMargin={false}
                />
              </div>
              <p className="qr-hint-text">
                Scan with any UPI app (GPay, PhonePe, Paytm, BHIM)
              </p>
              <div className="qr-vpa-pill mono">
                <span>RECEIVER: {profile.upiId}</span>
              </div>
            </div>

            <div className="modal-cta-row">
              <button 
                type="button" 
                className="primary-action-btn"
                onClick={() => {
                  navigator.clipboard.writeText(qrModalUrl);
                  showToast('Payment link copied!');
                }}
              >
                <IconCopy size={15} />
                <span>Copy Link</span>
              </button>
              <button type="button" className="ghost-back-btn" onClick={() => setShowQrModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: VIEW OFFICIAL RECEIPT */}
      {/* ========================================================================= */}
      {inspectingTx && (
        <div className="modal-backdrop fade-in">
          <div className="modal-dialog-box receipt-modal-box">
            <div className="modal-header-row">
              <h3 className="modal-title">Official Tax Receipt Voucher</h3>
              <button type="button" className="modal-close-btn" onClick={() => setInspectingTx(null)}>×</button>
            </div>
            <PaymentReceipt 
              transaction={inspectingTx}
              onBack={() => setInspectingTx(null)}
              isAdminView={true}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: MANUAL TRANSACTION ENTRY */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="modal-backdrop fade-in">
          <div className="modal-dialog-box">
            <div className="modal-header-row">
              <h3 className="modal-title">Record Offline / Direct Transfer</h3>
              <button type="button" className="modal-close-btn" onClick={() => setShowAddModal(false)}>×</button>
            </div>

            <form onSubmit={handleCreateManualTx} className="modal-form-body">
              <div className="form-group">
                <label className="field-label">Payer Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Ramesh Chandra"
                  value={manualForm.name}
                  onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-row-2col">
                <div className="form-group">
                  <label className="field-label">Amount (INR) *</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="0.00"
                    value={manualForm.amount}
                    onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="field-label">12-Digit Bank UTR</label>
                  <input
                    type="text"
                    className="form-control mono"
                    placeholder="e.g. 410293847561"
                    value={manualForm.utr}
                    onChange={(e) => setManualForm({ ...manualForm, utr: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="field-label">Purpose / Description</label>
                <input
                  type="text"
                  className="form-control"
                  value={manualForm.purpose}
                  onChange={(e) => setManualForm({ ...manualForm, purpose: e.target.value })}
                />
              </div>

              <div className="modal-cta-row">
                <button type="submit" className="primary-action-btn" disabled={isLoading}>
                  <span>Save Record</span>
                </button>
                <button type="button" className="ghost-back-btn" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default UserDashboard;
