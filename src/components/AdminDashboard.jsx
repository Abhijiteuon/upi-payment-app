import React, { useState, useEffect } from 'react';
import { 
  getTransactions, 
  deleteTransaction, 
  clearAllTransactions,
  addTransaction, 
  setAdminSession, 
  getAdminName,
  fetchRemoteTransactions, 
  updateRemoteStatus,
  subscribeToAllTransactions
} from '../services/storage';

function AdminDashboard({ onLogout }) {
  const [transactions, setTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [notification, setNotification] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

  const handleStatusChange = async (id, newStatus) => {
    let customNote = '';
    if (newStatus === 'failed') {
      customNote = window.prompt('Optional: Enter reason for marking payment as failed (or leave empty):', 'Invalid UTR / Credit not received');
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

  const handleLogout = () => {
    setAdminSession(false);
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
    if (!isoString) return '-';
    try {
      return new Date(isoString).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="admin-panel-container fade-in">
      {/* Top Banner */}
      <div className="admin-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
            <span className="admin-badge">ADMIN CONTROL PANEL</span>
            <span className="sync-status-badge online" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
              ⚡ Supabase Live Connected
            </span>
          </div>
          <h1 className="admin-title">Payment Verification Dashboard</h1>
          <p className="admin-subtitle">Logged in as: <strong>{getAdminName()}</strong></p>
        </div>
        
        <div className="admin-top-actions">
          <button 
            onClick={() => loadData(true)} 
            className="btn-action-primary"
            disabled={isLoading}
            title="Fetch latest responses from Supabase database"
          >
            {isLoading ? '⏳ Refreshing...' : '🔄 Refresh Data'}
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-action-secondary">
            + New
          </button>
          <button onClick={handleExportData} className="btn-action-secondary">
            💾 Export
          </button>
          <button onClick={handleClearAll} className="btn-action-danger" title="Delete all previous entries">
            🗑️ Clear All
          </button>
          <button onClick={handleLogout} className="btn-action-danger">
            🚪 Logout
          </button>
        </div>
      </div>

      {notification && (
        <div className="admin-toast fade-in">
          {notification}
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Requests</div>
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
                  <th>UTR / Ref</th>
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
                      {t.utr ? (
                        <span className="mono utr-pill">{t.utr}</span>
                      ) : (
                        <span className="text-muted-small">-</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge-pill ${t.status || 'pending'}`}>
                        {(!t.status || t.status === 'pending') && '⏳ In Progress'}
                        {t.status === 'successful' && '✅ Successful'}
                        {t.status === 'failed' && '❌ Failed'}
                      </span>
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
                          title="Mark as Payment Successful"
                          disabled={t.status === 'successful' || isLoading}
                          onClick={() => handleStatusChange(t.verificationId, 'successful')}
                        >
                          ✓ Success
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
