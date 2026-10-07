import React, { useState, useEffect } from 'react';
import { fetchRemoteStatusById } from '../services/storage';
import PaymentReceipt from './PaymentReceipt';

function StatusCheck({ initialVerificationId = '', onBackToPay }) {
  const [queryId, setQueryId] = useState(initialVerificationId);
  const [transaction, setTransaction] = useState(null);
  const [searched, setSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const performSearch = React.useCallback(async (idToSearch) => {
    setErrorMsg('');
    const id = (idToSearch || queryId).trim();
    if (!id) {
      setErrorMsg('Please enter a valid Payment Verification ID.');
      setTransaction(null);
      setSearched(true);
      return;
    }

    setIsSearching(true);
    setSearched(true);

    try {
      const result = await fetchRemoteStatusById(id);
      if (result) {
        setTransaction(result);
      } else {
        setTransaction(null);
        setErrorMsg(`No transaction found for Verification ID: "${id}". Please verify the ID or check if it was entered correctly.`);
      }
    } catch (err) {
      console.error('Error looking up transaction', err);
      setErrorMsg('Error querying payment status. Please try again.');
    } finally {
      setIsSearching(false);
    }
  }, [queryId]);

  // Auto-search if initialVerificationId is provided
  useEffect(() => {
    if (initialVerificationId) {
      setQueryId(initialVerificationId);
      performSearch(initialVerificationId);
    }
  }, [initialVerificationId, performSearch]);

  const handleSearch = (e) => {
    e.preventDefault();
    performSearch(queryId);
  };

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

  return (
    <div className="fade-in">
      <div className="header">
        <h1>Track Payment Status</h1>
        <p>Check the real-time verification status of your UPI payment</p>
      </div>

      <form onSubmit={handleSearch} className="search-form">
        <div className="form-group">
          <label htmlFor="verify-id">Enter Verification ID</label>
          <div className="search-input-group">
            <input
              type="text"
              id="verify-id"
              className="form-control mono-input"
              placeholder="e.g. VER-8X29KP"
              value={queryId}
              onChange={(e) => setQueryId(e.target.value.toUpperCase())}
              required
            />
            <button type="submit" className="search-btn" disabled={isSearching}>
              {isSearching ? 'Checking...' : 'Check Status'}
            </button>
          </div>
        </div>
      </form>

      {/* Loading state */}
      {isSearching && (
        <div className="status-loading fade-in" style={{ textAlign: 'center', padding: '1.5rem', color: '#a5b4fc' }}>
          <p>⏳ Fetching latest payment verification from database...</p>
        </div>
      )}

      {/* Error / Not Found */}
      {!isSearching && searched && errorMsg && (
        <div className="status-alert alert-error fade-in">
          <div className="alert-icon">⚠️</div>
          <div className="alert-body">
            <h4>Transaction Not Found</h4>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Found Transaction Results */}
      {!isSearching && searched && transaction && (
        <div className="status-result fade-in">
          {transaction.status === 'successful' && (
            <PaymentReceipt 
              transaction={transaction} 
              onBack={() => {
                setSearched(false);
                setTransaction(null);
              }} 
            />
          )}

          {(!transaction.status || transaction.status === 'pending') && (
            <div className="status-card pending-card">
              <div className="status-card-header">
                <div className="status-icon-badge badge-pending">
                  <span className="spinning-icon">⏳</span>
                </div>
                <div>
                  <span className="status-tag tag-pending">Verification Under Progress</span>
                  <h3>Payment Under Review</h3>
                </div>
              </div>

              <div className="status-notice">
                <p>
                  Your payment verification is currently <strong>under progress</strong>. The receiver (Abhijit) reconciles incoming payments against bank statements.
                </p>
                <div className="timeline-hint">
                  ⏱️ <strong>Estimated Verification Time:</strong> 3 hours to 2 days
                </div>
              </div>

              <div className="tx-summary-table">
                <div className="tx-summary-row">
                  <span>Verification ID:</span>
                  <strong className="mono">{transaction.verificationId}</strong>
                </div>
                <div className="tx-summary-row">
                  <span>Payer Name:</span>
                  <strong>{transaction.name}</strong>
                </div>
                <div className="tx-summary-row">
                  <span>Amount:</span>
                  <strong className="text-highlight">₹{transaction.amount}</strong>
                </div>
                <div className="tx-summary-row">
                  <span>Purpose:</span>
                  <span>{transaction.purpose}</span>
                </div>
                {transaction.utr && (
                  <div className="tx-summary-row">
                    <span>Submitted UTR:</span>
                    <span className="mono">{transaction.utr}</span>
                  </div>
                )}
                <div className="tx-summary-row">
                  <span>Submitted On:</span>
                  <span>{formatDate(transaction.createdAt || transaction.timestamp)}</span>
                </div>
              </div>

              <div className="status-tip">
                💡 <em>Tip: You can bookmark this page or keep your Verification ID handy. Once marked successful by the admin, your official payment receipt will become available here.</em>
              </div>
            </div>
          )}

          {transaction.status === 'failed' && (
            <div className="status-card failed-card">
              <div className="status-card-header">
                <div className="status-icon-badge badge-failed">
                  <span>❌</span>
                </div>
                <div>
                  <span className="status-tag tag-failed">Payment Failed</span>
                  <h3>Verification Unsuccessful</h3>
                </div>
              </div>

              <div className="status-notice failed-notice">
                <p>
                  This payment could not be verified by the receiver. This may occur if the payment was declined by the bank, the UTR reference was invalid, or the transaction was cancelled.
                </p>
                {transaction.notes && (
                  <p className="admin-notes">
                    <strong>Admin Note:</strong> {transaction.notes}
                  </p>
                )}
              </div>

              <div className="tx-summary-table">
                <div className="tx-summary-row">
                  <span>Verification ID:</span>
                  <strong className="mono">{transaction.verificationId}</strong>
                </div>
                <div className="tx-summary-row">
                  <span>Payer Name:</span>
                  <strong>{transaction.name}</strong>
                </div>
                <div className="tx-summary-row">
                  <span>Amount:</span>
                  <strong>₹{transaction.amount}</strong>
                </div>
                <div className="tx-summary-row">
                  <span>Date:</span>
                  <span>{formatDate(transaction.createdAt || transaction.timestamp)}</span>
                </div>
              </div>

              <p className="support-hint">
                If your account was debited, please contact Abhijit with your bank transaction screenshot to resolve this manually.
              </p>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <button onClick={onBackToPay} className="back-btn">
          ← Make Another Payment
        </button>
      </div>
    </div>
  );
}

export default StatusCheck;
