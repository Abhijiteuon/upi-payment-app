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
import { 
  IconShieldCheck, 
  IconRefresh, 
  IconDownload, 
  IconTrash, 
  IconSearch, 
  IconCheck, 
  IconAlertCircle, 
  IconClock, 
  IconCreditCard
} from './Icons';

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
      if (showToastMsg) showToast('Synced with live database');
    } else {
      if (showToastMsg) {
        showToast('Using local cached ledger records');
      }
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
    showToast(`Marked ${verifyingTx.verificationId} as Settled`);
  };

  const handleStatusChange = async (id, newStatus) => {
    let customNote = '';
    if (newStatus === 'failed') {
      customNote = window.prompt('Reason for declining payment (e.g. Invalid UTR / Credit not received in bank):', 'Invalid UTR / Credit not received in bank statement');
      if (customNote === null) return;
    }
    
    setIsLoading(true);
    const result = await updateRemoteStatus(id, newStatus, customNote);
    if (result && result.transactions) {
      setTransactions(result.transactions);
    }
    setIsLoading(false);
    showToast(`Status updated to ${newStatus.toUpperCase()}`);
  };

  const handleDelete = async (id) => {
    if (window.confirm(`Permanently remove transaction ${id} from active records?`)) {
      setIsLoading(true);
      const updated = await deleteTransaction(id);
      setTransactions(updated);
      setIsLoading(false);
      showToast(`Record ${id} removed`);
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to delete ALL active records from the dashboard?')) {
      setIsLoading(true);
      await clearAllTransactions();
      setTransactions([]);
      setIsLoading(false);
      showToast('All records cleared');
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
    showToast(`Created record: ${created.verificationId}`);
  };

  const handleExportData = () => {
    const jsonStr = JSON.stringify(transactions, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `upi_settlements_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported settlement records');
  };

  const handleLogout = async () => {
    await logoutAdmin();
    onLogout();
  };

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

  const getUtrBadge = (utr) => {
    if (!utr) {
      return (
        <span className="utr-pill-tag tag-warning">
          <IconAlertCircle size={12} />
          <span>Awaiting UTR</span>
        </span>
      );
    }
    const check = validateUTR(utr);
    if (!check.valid) {
      return (
        <div className="utr-fraud-alert">
          <span className="mono utr-pill-tag tag-danger">{utr}</span>
          <span className="fraud-hint">{check.error}</span>
        </div>
      );
    }
    return (
      <span className="mono utr-pill-tag tag-success">
        <IconCheck size={12} />
        <span>{utr}</span>
      </span>
    );
  };

  return (
    <div className="admin-dashboard-container fade-in">
      {/* Toast Notification */}
      {notification && (
        <div className="admin-toast-panel fade-in">
          <IconCheck size={16} className="text-emerald" />
          <span>{notification}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="admin-topbar">
        <div>
          <div className="admin-badge-row">
            <span className="admin-live-pulse"></span>
            <span className="admin-badge-text">SETTLEMENT VERIFICATION CONSOLE</span>
          </div>
          <h2 className="admin-page-heading">Treasury & Reconciliation</h2>
          <p className="admin-session-text">
            Authenticated as: <strong className="text-slate-200">{getAdminName()}</strong>
          </p>
        </div>

        <div className="admin-action-toolbar">
          <button onClick={() => loadData(true)} className="dashboard-btn" title="Refresh live database">
            <IconRefresh size={14} />
            <span>Sync</span>
          </button>
          <button onClick={() => setShowAddModal(true)} className="dashboard-btn" title="Create manual transaction">
            <span>+ Add Entry</span>
          </button>
          <button onClick={handleExportData} className="dashboard-btn" title="Export as JSON">
            <IconDownload size={14} />
            <span>Export</span>
          </button>
          <button onClick={handleClearAll} className="dashboard-btn danger" title="Clear records">
            <IconTrash size={14} />
          </button>
          <button onClick={handleLogout} className="dashboard-btn logout" title="Sign Out">
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="admin-kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">TOTAL SESSIONS</span>
            <IconCreditCard size={16} className="kpi-icon" />
          </div>
          <div className="kpi-value">{totalCount}</div>
          <div className="kpi-footer">Across all channels</div>
        </div>

        <div className="kpi-card highlight-amber">
          <div className="kpi-header">
            <span className="kpi-label">PENDING RECONCILIATION</span>
            <IconClock size={16} className="kpi-icon text-amber" />
          </div>
          <div className="kpi-value">{pendingCount}</div>
          <div className="kpi-footer">Awaiting statement cross-check</div>
        </div>

        <div className="kpi-card highlight-emerald">
          <div className="kpi-header">
            <span className="kpi-label">SETTLED TRANSACTIONS</span>
            <IconShieldCheck size={16} className="kpi-icon text-emerald" />
          </div>
          <div className="kpi-value">{successCount}</div>
          <div className="kpi-footer">Verified credit in ICICI bank</div>
        </div>

        <div className="kpi-card highlight-revenue">
          <div className="kpi-header">
            <span className="kpi-label">TOTAL SETTLED VOLUME</span>
            <span className="kpi-icon-currency">₹</span>
          </div>
          <div className="kpi-value">₹{Number(totalRevenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          <div className="kpi-footer">Net credit confirmed</div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="admin-filter-bar">
        <div className="admin-search-box">
          <IconSearch size={16} className="admin-search-icon" />
          <input
            type="text"
            className="admin-search-input"
            placeholder="Search by Verification ID, Payer Name, Mobile, UTR..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="search-clear-action" onClick={() => setSearchTerm('')}>
              &times;
            </button>
          )}
        </div>

        <div className="admin-segmented-filter">
          {[
            { id: 'all', label: `All (${totalCount})` },
            { id: 'pending', label: `Pending (${pendingCount})` },
            { id: 'successful', label: `Settled (${successCount})` },
            { id: 'failed', label: `Declined (${failedCount})` }
          ].map(tab => (
            <button
              key={tab.id}
              className={`filter-pill-btn ${filterStatus === tab.id ? 'active' : ''}`}
              onClick={() => setFilterStatus(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ledger Table Container */}
      <div className="admin-table-wrapper">
        {filtered.length === 0 ? (
          <div className="admin-empty-table">
            <IconAlertCircle size={24} className="text-muted" />
            <p>No matching transactions found.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="modern-admin-table">
              <thead>
                <tr>
                  <th>VERIFICATION ID & TIME</th>
                  <th>PAYER CREDENTIALS</th>
                  <th>AMOUNT & PURPOSE</th>
                  <th>BANK UTR / INTEGRITY</th>
                  <th>SETTLEMENT STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.verificationId || t.name + t.createdAt} className={`row-status-${t.status || 'pending'}`}>
                    <td>
                      <div className="table-ver-id mono font-semibold">{t.verificationId || 'NO-ID'}</div>
                      <div className="table-meta-sub">{formatDate(t.createdAt)}</div>
                    </td>

                    <td>
                      <div className="table-payer-name font-medium">{t.name}</div>
                      <div className="table-meta-sub mono">{t.phone}</div>
                      <div className="table-meta-sub">{t.email}</div>
                    </td>

                    <td>
                      <div className="table-amount font-semibold">₹{Number(t.amount).toLocaleString('en-IN')}</div>
                      <div className="table-meta-sub">{t.purpose}</div>
                      {t.source && <span className="entity-tag">{t.source}</span>}
                    </td>

                    <td>
                      {getUtrBadge(t.utr)}
                    </td>

                    <td>
                      <span className={`status-chip chip-${t.status || 'pending'}`}>
                        <span className="chip-dot"></span>
                        <span>
                          {(!t.status || t.status === 'pending') && 'Under Review'}
                          {t.status === 'successful' && 'Settled'}
                          {t.status === 'failed' && 'Declined'}
                        </span>
                      </span>
                      {t.verifiedBy && (
                        <div className="verified-by-audit">
                          by {t.verifiedBy}
                        </div>
                      )}
                    </td>

                    <td>
                      <div className="table-actions-cell">
                        <button
                          className="action-btn success-action"
                          title="Verify Bank Credit & Mark Settled"
                          disabled={t.status === 'successful' || isLoading}
                          onClick={() => handleInitiateSuccess(t)}
                        >
                          <IconCheck size={14} />
                          <span>Verify</span>
                        </button>
                        <button
                          className="action-btn fail-action"
                          title="Decline Payment"
                          disabled={t.status === 'failed' || isLoading}
                          onClick={() => handleStatusChange(t.verificationId, 'failed')}
                        >
                          <span>Decline</span>
                        </button>
                        <button
                          className="action-btn reset-action"
                          title="Reset to Pending"
                          disabled={(!t.status || t.status === 'pending') || isLoading}
                          onClick={() => handleStatusChange(t.verificationId, 'pending')}
                        >
                          <IconRefresh size={13} />
                        </button>
                        <button
                          className="action-btn delete-action"
                          title="Delete Record"
                          onClick={() => handleDelete(t.verificationId)}
                        >
                          <IconTrash size={14} />
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

      {/* 3-POINT MATCH VERIFICATION MODAL */}
      {verifyingTx && (
        <div className="modal-backdrop" onClick={() => setVerifyingTx(null)}>
          <div className="modal-dialog-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-panel-header">
              <div className="modal-header-icon">
                <IconShieldCheck size={20} className="text-emerald" />
              </div>
              <div>
                <h3 className="modal-title">3-Point Bank Cross-Check</h3>
                <p className="modal-subtitle">Confirm settlement against ICICI bank statement before approving</p>
              </div>
              <button className="modal-close-action" onClick={() => setVerifyingTx(null)}>&times;</button>
            </div>
            
            <div className="modal-panel-body">
              {/* Summary Card */}
              <div className="modal-tx-preview">
                <div className="preview-row">
                  <span className="preview-label">Payer</span>
                  <span className="preview-val font-medium">{verifyingTx.name}</span>
                </div>
                <div className="preview-row">
                  <span className="preview-label">Required Amount</span>
                  <span className="preview-val font-bold text-sky text-lg">
                    ₹{Number(verifyingTx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="preview-row">
                  <span className="preview-label">Submitted UTR</span>
                  <span className="preview-val mono font-semibold" style={{ color: verifyingTx.utr ? '#10b981' : '#f87171' }}>
                    {verifyingTx.utr || 'No UTR Submitted'}
                  </span>
                </div>
              </div>

              {/* Checklist */}
              <div className="checklist-group">
                <label className="checklist-item">
                  <input 
                    type="checkbox" 
                    checked={checkAmount} 
                    onChange={(e) => setCheckAmount(e.target.checked)}
                    className="custom-checkbox"
                  />
                  <span className="checklist-text">
                    <strong>1. Exact Amount Check:</strong> I have confirmed that exactly <strong>₹{verifyingTx.amount}</strong> was credited to my bank account.
                  </span>
                </label>

                <label className="checklist-item">
                  <input 
                    type="checkbox" 
                    checked={checkUtr} 
                    onChange={(e) => setCheckUtr(e.target.checked)}
                    className="custom-checkbox"
                  />
                  <span className="checklist-text">
                    <strong>2. Bank UTR Match:</strong> The 12-digit reference <strong>{verifyingTx.utr || '(No UTR)'}</strong> appears in my bank passbook/SMS alert.
                  </span>
                </label>

                <label className="checklist-item">
                  <input 
                    type="checkbox" 
                    checked={checkTime} 
                    onChange={(e) => setCheckTime(e.target.checked)}
                    className="custom-checkbox"
                  />
                  <span className="checklist-text">
                    <strong>3. Timestamp Check:</strong> Bank credit occurred around {formatDate(verifyingTx.createdAt)}.
                  </span>
                </label>
              </div>

              <div className="form-group" style={{ marginTop: '1.25rem' }}>
                <label className="field-label">Internal Settlement Memo (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Verified in ICICI Corporate net banking"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                />
              </div>

              <div className="modal-cta-row">
                <button
                  type="button"
                  className="primary-action-btn modal-confirm-btn"
                  disabled={!checkAmount || !checkUtr || isLoading}
                  onClick={handleConfirmVerifiedSuccess}
                >
                  <IconCheck size={16} />
                  <span>{isLoading ? 'Verifying...' : 'Authorize & Issue Receipt'}</span>
                </button>
                <button
                  type="button"
                  className="ghost-back-btn"
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
          <div className="modal-dialog-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-panel-header">
              <div>
                <h3 className="modal-title">Record Manual Payment</h3>
                <p className="modal-subtitle">Directly add an offline bank or NEFT/UPI transaction</p>
              </div>
              <button className="modal-close-action" onClick={() => setShowAddModal(false)}>&times;</button>
            </div>

            <form onSubmit={handleAddManual} className="modal-panel-body">
              <div className="form-group">
                <label className="field-label">Payer Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={manualForm.name}
                  onChange={(e) => setManualForm({...manualForm, name: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label className="field-label">Amount (INR) *</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="0.00"
                  value={manualForm.amount}
                  onChange={(e) => setManualForm({...manualForm, amount: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label className="field-label">12-Digit UTR Number</label>
                <input
                  type="text"
                  className="form-control mono"
                  placeholder="e.g. 410293847561"
                  value={manualForm.utr}
                  onChange={(e) => setManualForm({...manualForm, utr: e.target.value})}
                />
              </div>

              <div className="form-row-2col">
                <div className="form-group">
                  <label className="field-label">Mobile Number</label>
                  <input
                    type="tel"
                    className="form-control"
                    value={manualForm.phone}
                    onChange={(e) => setManualForm({...manualForm, phone: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label className="field-label">Email ID</label>
                  <input
                    type="email"
                    className="form-control"
                    value={manualForm.email}
                    onChange={(e) => setManualForm({...manualForm, email: e.target.value})}
                  />
                </div>
              </div>

              <div className="modal-cta-row">
                <button type="submit" className="primary-action-btn modal-confirm-btn" disabled={isLoading}>
                  <span>{isLoading ? 'Creating...' : 'Save Settlement Entry'}</span>
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

export default AdminDashboard;
