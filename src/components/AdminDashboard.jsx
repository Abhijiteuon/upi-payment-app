import React, { useState, useEffect } from 'react';
import { 
  getTransactions, 
  deleteTransaction, 
  clearAllTransactions, 
  addTransaction, 
  getAdminName,
  fetchRemoteTransactions, 
  updateRemoteStatus,
  subscribeToAllTransactions,
  logoutAdmin
} from '../services/storage';
import { validateUTR } from '../services/security';

function AdminDashboard({ onLogout }) {
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [notification, setNotification] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Security Verification Modal state (The 3-Point Match Rule)
  const [verifyingTx, setVerifyingTx] = useState(null);
  const [checkAmount, setCheckAmount] = useState(false);
  const [checkUtr, setCheckUtr] = useState(false);
  const [checkTime, setCheckTime] = useState(false);
  const [adminNote, setAdminNote] = useState('');

  // Form for manual entry
  const [manualForm, setManualForm] = useState({
    name: '',
    email: '',
    phone: '',
    purpose: 'Freelance project completion Payment',
    source: 'Individual',
    amount: '',
    utr: ''
  });

  const loadData = async (showToastMsg = false) => {
    setIsLoading(true);
    const local = getTransactions();
    setTransactions(local);

    const result = await fetchRemoteTransactions();
    if (result.success && Array.isArray(result.transactions)) {
      setTransactions(result.transactions);
      if (showToastMsg) showToast('✓ Synced with Supabase Live Database!');
    } else {
      if (showToastMsg) {
        showToast('⚠️ Could not sync with Supabase. Showing cached data.');
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();

    // Subscribe to live changes in Supabase (new payments, UTR updates from any device)
    const unsubscribe = subscribeToAllTransactions(() => {
      loadData(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const showToast = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 4000);
  };

  // Open 3-Point Verification Modal before marking successful
  const handleInitiateSuccess = (tx) => {
    setVerifyingTx(tx);
    setCheckAmount(false);
    setCheckUtr(false);
    setCheckTime(false);
    setAdminNote('');
  };

  const handleConfirmVerifiedSuccess = async () => {
    if (!verifyingTx) return;
    setIsLoading(true);
    
    const note = adminNote ? `Verified by Admin. ${adminNote}` : 'Verified via 3-Point Bank Cross-Check';
    const result = await updateRemoteStatus(verifyingTx.verificationId, 'successful', note);
    
    if (result && result.transactions) {
      setTransactions(result.transactions);
    }
    
    setIsLoading(false);
    setVerifyingTx(null);
    showToast(`✓ Marked "SUCCESSFUL" for ID ${verifyingTx.verificationId}`);
  };

  const handleStatusChange = async (id, newStatus) => {
    let customNote = '';
    if (newStatus === 'failed') {
      customNote = window.prompt('Enter reason for marking payment as failed (or leave empty):', 'Invalid UTR / Credit not received in bank statement');
      if (customNote === null) return; // User cancelled
    }
    
    setIsLoading(true);
    const result = await updateRemoteStatus(id, newStatus, customNote);
    if (result && result.transactions) {
      setTransactions(result.transactions);
    }
    setIsLoading(false);
    showToast(`✓ Marked "${newStatus.toUpperCase()}" for ID ${id}`);
  };

  const handleDelete = async (id) => {
    if (window.confirm(`Are you sure you want to delete transaction ${id}?`)) {
      setIsLoading(true);
      const updated = await deleteTransaction(id);
      setTransactions(updated);
      setIsLoading(false);
      showToast(`Transaction ${id} deleted.`);
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to delete ALL entries? This action will remove all previous transactions from the dashboard.')) {
      setIsLoading(true);
      await clearAllTransactions();
      setTransactions([]);
      setIsLoading(false);
      showToast('✓ All previous entries have been deleted.');
    }
  };

  const handleAddManual = async (e) => {
    e.preventDefault();
    if (!manualForm.name || !manualForm.amount) return;
    setIsLoading(true);
    const created = await addTransaction(manualForm);
    await loadData();
    setShowAddModal(false);
    setManualForm({
      name: '',
      email: '',
      phone: '',
      purpose: 'Freelance project completion Payment',
      source: 'Individual',
      amount: '',
      utr: ''
    });
    setIsLoading(false);
    showToast(`Created manual transaction: ${created.verificationId}`);
  };

  const handleExportData = () => {
    const jsonStr = JSON.stringify(transactions, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `upi_transactions_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported transactions JSON.');
  };

  const handleLogout = async () => {
    await logoutAdmin();
    onLogout();
  };

  // Filtered transactions
  const filtered = transactions.filter(t => {
    const matchSearch = 
      (t.verificationId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.phone && t.phone.includes(searchTerm)) ||
      (t.utr && t.utr.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.email && t.email.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchSearch) return false;
    if (filterStatus === 'all') return true;
    return (t.status || 'pending') === filterStatus;
  });

  // Calculate statistics
  const totalCount = transactions.length;
  const pendingCount = transactions.filter(t => (t.status || 'pending') === 'pending').length;
  const successCount = transactions.filter(t => t.status === 'successful').length;
  const failedCount = transactions.filter(t => t.status === 'failed').length;
  const totalRevenue = transactions
    .filter(t => t.status === 'successful')
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

  const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    try {
      return new Date(isoString).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return isoString;
    }
  };

  // UTR Security Heuristics Badge
  const getUtrStatusBadge = (utr) => {
    if (!utr) {
      return <span className="utr-pill badge-warning" style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>⚠️ Missing UTR</span>;
    }
    const check = validateUTR(utr);
    if (!check.valid) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span className="mono utr-pill" style={{ color: '#ef4444', textDecoration: 'line-through' }}>{utr}</span>
          <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>🚨 {check.error}</span>
        </div>
      );
    }
    return <span className="mono utr-pill" style={{ color: '#10b981', fontWeight: 600 }}>{utr}</span>;
  };

  return (
    <div className="admin-dashboard-root fade-in">
      {/* Top Notification Bar */}
      {notification && (
        <div className="admin-toast-notification fade-in">
          {notification}
        </div>
      )}

      {/* Header with Title and Actions */}
      <div className="admin-dashboard-header">
        <div>
          <h2>Payment Verification Center</h2>
          <p className="admin-welcome-text">
            Logged in as: <strong>{getAdminName()}</strong> • Secured Session
          </p>
        </div>
        <div className="admin-header-actions">
          <button onClick={() => loadData(true)} className="btn-secondary" title="Sync live updates">
            🔄 Sync
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-secondary" title="Add manual entry">
            + Add Manual
          </button>
          <button onClick={handleExportData} className="btn-secondary" title="Export as JSON">
            📥 Export
          </button>
          <button onClick={handleClearAll} className="btn-danger-outline" title="Delete all records">
            Clear All
          </button>
          <button onClick={handleLogout} className="btn-logout" title="Sign out">
            Logout
          </button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="admin-stats-grid">
        <div className="stat-card stat-total">
          <div className="stat-label">📋 Total Payments</div>
          <div className="stat-value">{totalCount}</div>
        </div>
        <div className="stat-card stat-pending">
          <div className="stat-label">⏳ Under Progress</div>
          <div className="stat-value">{pendingCount}</div>
        </div>
        <div className="stat-card stat-success">
          <div className="stat-label">✅ Verified Success</div>
          <div className="stat-value">{successCount}</div>
        </div>
        <div className="stat-card stat-failed">
          <div className="stat-label">❌ Failed</div>
          <div className="stat-value">{failedCount}</div>
        </div>
        <div className="stat-card stat-revenue">
          <div className="stat-label">💰 Verified Revenue</div>
          <div className="stat-value">₹{totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      {/* Controls Bar (Search + Filter tabs) */}
      <div className="admin-controls-bar">
        <div className="admin-search-wrapper">
          <input
            type="text"
            className="form-control admin-search-input"
            placeholder="Search by ID, Name, Phone, UTR..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search-btn" onClick={() => setSearchTerm('')}>
              &times;
            </button>
          )}
        </div>

        <div className="filter-tabs">
          <button 
            className={`filter-tab ${filterStatus === 'all' ? 'active' : ''}`}
            onClick={() => setFilterStatus('all')}
          >
            All ({totalCount})
          </button>
          <button 
            className={`filter-tab ${filterStatus === 'pending' ? 'active' : ''}`}
            onClick={() => setFilterStatus('pending')}
          >
            Pending ({pendingCount})
          </button>
          <button 
            className={`filter-tab ${filterStatus === 'successful' ? 'active' : ''}`}
            onClick={() => setFilterStatus('successful')}
          >
            Successful ({successCount})
          </button>
          <button 
            className={`filter-tab ${filterStatus === 'failed' ? 'active' : ''}`}
            onClick={() => setFilterStatus('failed')}
          >
            Failed ({failedCount})
          </button>
        </div>
      </div>

      {/* Transactions List / Table */}
      <div className="transactions-wrapper">
        {filtered.length === 0 ? (
          <div className="no-records-box">
            <p>No payment records matching your filter.</p>
          </div>
        ) : (
          <div className="tx-table-container">
            <table className="tx-table">
              <thead>
                <tr>
                  <th>ID & Date</th>
                  <th>Payer Details</th>
                  <th>Purpose & Amount</th>
                  <th>UTR / Security Check</th>
                  <th>Current Status</th>
                  <th>Verification Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.verificationId || t.name + t.createdAt} className={`tx-row-status-${t.status || 'pending'}`}>
                    <td>
                      <div className="tx-id-badge">{t.verificationId || 'NO-ID'}</div>
                      <div className="tx-date-sub">{formatDate(t.createdAt)}</div>
                    </td>
                    <td>
                      <div className="tx-payer-name">{t.name}</div>
                      <div className="tx-contact-sub">{t.phone}</div>
                      <div className="tx-contact-sub">{t.email}</div>
                    </td>
                    <td>
                      <div className="tx-amount-highlight">₹{t.amount}</div>
                      <div className="tx-purpose-sub">{t.purpose}</div>
                      {t.source && <span className="source-tag">{t.source}</span>}
                    </td>
                    <td>
                      {getUtrStatusBadge(t.utr)}
                    </td>
                    <td>
                      <span className={`status-badge-pill ${t.status || 'pending'}`}>
                        {(!t.status || t.status === 'pending') && '⏳ In Progress'}
                        {t.status === 'successful' && '✅ Successful'}
                        {t.status === 'failed' && '❌ Failed'}
                      </span>
                      {t.verifiedBy && (
                        <div style={{ fontSize: '0.7rem', color: '#10b981', marginTop: '3px' }}>
                          By: {t.verifiedBy}
                        </div>
                      )}
                      {t.notes && (
                        <div className="tx-note-text" title={t.notes}>
                          Note: {t.notes}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons-group">
                        <button
                          className="btn-mark-success"
                          title="Verify Bank Credit & Mark Successful"
                          disabled={t.status === 'successful' || isLoading}
                          onClick={() => handleInitiateSuccess(t)}
                        >
                          ✓ Verify
                        </button>
                        <button
                          className="btn-mark-fail"
                          title="Mark as Payment Failed"
                          disabled={t.status === 'failed' || isLoading}
                          onClick={() => handleStatusChange(t.verificationId, 'failed')}
                        >
                          ✕ Fail
                        </button>
                        <button
                          className="btn-mark-pending"
                          title="Reset to Pending"
                          disabled={(!t.status || t.status === 'pending') || isLoading}
                          onClick={() => handleStatusChange(t.verificationId, 'pending')}
                        >
                          ↺ Reset
                        </button>
                        <button
                          className="btn-delete"
                          title="Delete Record"
                          onClick={() => handleDelete(t.verificationId)}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3-POINT MATCH VERIFICATION MODAL (Layer 4 Fraud Prevention) */}
      {verifyingTx && (
        <div className="modal-backdrop" onClick={() => setVerifyingTx(null)}>
          <div className="modal-dialog glass-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🛡️</span> 3-Point Bank Cross-Check
              </h3>
              <button className="modal-close" onClick={() => setVerifyingTx(null)}>&times;</button>
            </div>
            
            <div className="verification-checklist-body">
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                To protect against UPI spoof apps and fake UTR scams, confirm all 3 cross-check rules against your ICICI / bank statement before approving:
              </p>

              <div className="target-tx-summary" style={{ background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '8px', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#94a3b8' }}>Payer:</span>
                  <strong>{verifyingTx.name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#94a3b8' }}>Required Amount:</span>
                  <strong style={{ color: '#38bdf8', fontSize: '1.1rem' }}>₹{verifyingTx.amount}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Submitted UTR:</span>
                  <strong className="mono" style={{ color: verifyingTx.utr ? '#a7f3d0' : '#f87171' }}>
                    {verifyingTx.utr || '⚠️ No UTR Provided'}
                  </strong>
                </div>
              </div>

              {/* 3-Point Checklist */}
              <div className="checklist-items" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input 
                    type="checkbox" 
                    checked={checkAmount} 
                    onChange={(e) => setCheckAmount(e.target.checked)}
                    style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: '#10b981' }}
                  />
                  <span>
                    <strong>1. Exact Amount Check:</strong> I have confirmed that exactly <strong>₹{verifyingTx.amount}</strong> has been credited to my bank account (not ₹1 or lesser).
                  </span>
                </label>

                <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input 
                    type="checkbox" 
                    checked={checkUtr} 
                    onChange={(e) => setCheckUtr(e.target.checked)}
                    style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: '#10b981' }}
                  />
                  <span>
                    <strong>2. Bank UTR Match:</strong> The 12-digit reference number <strong>{verifyingTx.utr || '(No UTR)'}</strong> appears in my bank passbook/SMS credit alert.
                  </span>
                </label>

                <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input 
                    type="checkbox" 
                    checked={checkTime} 
                    onChange={(e) => setCheckTime(e.target.checked)}
                    style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: '#10b981' }}
                  />
                  <span>
                    <strong>3. Timestamp Alignment:</strong> Credit was received around {formatDate(verifyingTx.createdAt)}.
                  </span>
                </label>
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.85rem' }}>Optional Audit Note / Memo</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Verified in ICICI mobile app statement"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="submit-btn"
                  style={{ background: (!checkAmount || !checkUtr) ? '#475569' : '#10b981' }}
                  disabled={!checkAmount || !checkUtr || isLoading}
                  onClick={handleConfirmVerifiedSuccess}
                >
                  {isLoading ? 'Verifying...' : '✓ Confirm & Unlock Official Receipt'}
                </button>
                <button
                  type="button"
                  className="back-btn"
                  onClick={() => setVerifyingTx(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-dialog glass-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Manual Payment Record</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddManual}>
              <div className="form-group">
                <label>Payer Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={manualForm.name}
                  onChange={(e) => setManualForm({...manualForm, name: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Amount (₹) *</label>
                <input
                  type="number"
                  className="form-control"
                  value={manualForm.amount}
                  onChange={(e) => setManualForm({...manualForm, amount: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>UTR Number</label>
                <input
                  type="text"
                  className="form-control mono-input"
                  placeholder="12-digit reference"
                  value={manualForm.utr}
                  onChange={(e) => setManualForm({...manualForm, utr: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input
                  type="tel"
                  className="form-control"
                  value={manualForm.phone}
                  onChange={(e) => setManualForm({...manualForm, phone: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Email ID</label>
                <input
                  type="email"
                  className="form-control"
                  value={manualForm.email}
                  onChange={(e) => setManualForm({...manualForm, email: e.target.value})}
                />
              </div>
              <button type="submit" className="submit-btn" disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Transaction'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
