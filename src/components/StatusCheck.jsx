import React, { useState, useEffect } from 'react';
import { fetchRemoteStatusById, subscribeToTransaction } from '../services/storage';
import PaymentReceipt from './PaymentReceipt';
import { 
  IconSearch, 
  IconClock, 
  IconAlertCircle, 
  IconShieldCheck,
  IconCreditCard
} from './Icons';

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
        setErrorMsg(`No payment record located for Verification ID: "${id}". Please confirm the ID syntax (e.g. VER-XXXXXX).`);
      }
    } catch (err) {
      console.error('Error looking up transaction', err);
      setErrorMsg('Unable to query payment status. Please verify your connection.');
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

  // Real-time live subscription for instant receipt unlock when status changes
  useEffect(() => {
    if (transaction && transaction.verificationId && transaction.status === 'pending') {
      const unsubscribe = subscribeToTransaction(transaction.verificationId, (updatedTx) => {
        if (updatedTx) {
          setTransaction(updatedTx);
        }
      });
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [transaction?.verificationId, transaction?.status]);

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
    <div className="status-check-container fade-in">
      <div className="card-header-block text-center">
        <div className="header-meta-pill">
          <IconSearch size={14} className="text-sky" />
          <span>REAL-TIME AUDIT LOOKUP</span>
        </div>
        <h1 className="main-title">Track Payment Status</h1>
        <p className="sub-title">
          Query the live settlement status or retrieve an official verified payment receipt
        </p>
      </div>

      <form onSubmit={handleSearch} className="search-form-card">
        <div className="search-field-wrapper">
          <IconSearch size={18} className="search-input-icon" />
          <input
            type="text"
            id="verify-id"
            className="search-input-field mono"
            placeholder="Enter Verification ID (e.g. VER-8X29KP)"
            value={queryId}
            onChange={(e) => setQueryId(e.target.value.toUpperCase())}
            required
            autoComplete="off"
          />
          {queryId && (
            <button 
              type="button" 
              className="search-clear-btn"
              onClick={() => {
                setQueryId('');
                setSearched(false);
                setTransaction(null);
              }}
            >
              &times;
            </button>
          )}
          <button type="submit" className="search-submit-btn" disabled={isSearching}>
            {isSearching ? 'Searching...' : 'Check Status'}
          </button>
        </div>
      </form>

      {/* Loading Indicator */}
      {isSearching && (
        <div className="status-loading-panel fade-in">
          <div className="spinner-ring"></div>
          <p>Querying verified ledger and Supabase database...</p>
        </div>
      )}

      {/* Error / Not Found */}
      {!isSearching && searched && errorMsg && (
        <div className="status-alert alert-error fade-in" style={{ marginTop: '1.5rem' }}>
          <IconAlertCircle size={20} className="alert-icon-svg" />
          <div className="alert-body">
            <h4>Record Not Found</h4>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Found Transaction Results */}
      {!isSearching && searched && transaction && (
        <div className="status-result-area fade-in">
          
          {/* SUCCESSFUL: OFFICIAL RECEIPT */}
          {transaction.status === 'successful' && (
            <PaymentReceipt 
              transaction={transaction} 
              onBack={() => {
                setSearched(false);
                setTransaction(null);
              }} 
            />
          )}

          {/* PENDING: UNDER VERIFICATION */}
          {(!transaction.status || transaction.status === 'pending') && (
            <div className="status-pending-card">
              <div className="pending-card-header">
                <div className="pulsing-clock-badge">
                  <IconClock size={24} className="text-amber" />
                </div>
                <div className="pending-header-info">
                  <div className="pending-meta-tag">
                    <span className="pulsing-amber-dot"></span>
                    <span>CREDIT RECONCILIATION IN PROGRESS</span>
                  </div>
                  <h3>Payment Under Review</h3>
                </div>
              </div>

              <div className="pending-notice-box">
                <p>
                  Your transaction has been submitted. The receiver (Abhijit) cross-checks all credits against bank statements before generating the final tax receipt.
                </p>
                <div className="live-socket-hint">
                  <IconShieldCheck size={14} className="text-sky" />
                  <span><strong>Live Auto-Unlock:</strong> This page will automatically update and display your receipt the moment credit is approved. No refresh needed.</span>
                </div>
              </div>

              <div className="pending-summary-grid">
                <div className="summary-cell">
                  <span className="summary-label">VERIFICATION ID</span>
                  <span className="summary-val mono font-semibold">{transaction.verificationId}</span>
                </div>

                <div className="summary-cell">
                  <span className="summary-label">PAYER NAME</span>
                  <span className="summary-val">{transaction.name}</span>
                </div>

                <div className="summary-cell">
                  <span className="summary-label">AMOUNT DUE</span>
                  <span className="summary-val font-semibold text-sky">₹{Number(transaction.amount).toLocaleString('en-IN')}</span>
                </div>

                <div className="summary-cell">
                  <span className="summary-label">PURPOSE</span>
                  <span className="summary-val">{transaction.purpose}</span>
                </div>

                <div className="summary-cell">
                  <span className="summary-label">SUBMITTED UTR</span>
                  <span className="summary-val mono">{transaction.utr || 'Awaiting UTR submission'}</span>
                </div>

                <div className="summary-cell">
                  <span className="summary-label">SUBMISSION TIME</span>
                  <span className="summary-val">{formatDate(transaction.createdAt)}</span>
                </div>
              </div>
            </div>
          )}

          {/* FAILED STATUS */}
          {transaction.status === 'failed' && (
            <div className="status-failed-card">
              <div className="failed-card-header">
                <div className="failed-icon-badge">
                  <IconAlertCircle size={24} className="text-red" />
                </div>
                <div>
                  <div className="failed-meta-tag">TRANSACTION DECLINED</div>
                  <h3>Verification Unsuccessful</h3>
                </div>
              </div>

              <div className="failed-notice-box">
                <p>
                  This payment could not be verified against the receiver's bank statement. Common reasons include bank transaction timeout, incorrect 12-digit UTR, or credit reversal.
                </p>
                {transaction.notes && (
                  <div className="failed-reason-text">
                    <strong>Receiver Note:</strong> {transaction.notes}
                  </div>
                )}
              </div>

              <div className="pending-summary-grid">
                <div className="summary-cell">
                  <span className="summary-label">VERIFICATION ID</span>
                  <span className="summary-val mono">{transaction.verificationId}</span>
                </div>
                <div className="summary-cell">
                  <span className="summary-label">AMOUNT</span>
                  <span className="summary-val">₹{transaction.amount}</span>
                </div>
                <div className="summary-cell">
                  <span className="summary-label">PAYER NAME</span>
                  <span className="summary-val">{transaction.name}</span>
                </div>
                <div className="summary-cell">
                  <span className="summary-label">DATE</span>
                  <span className="summary-val">{formatDate(transaction.createdAt)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Back CTA */}
      <div className="status-footer-action">
        <button onClick={onBackToPay} className="ghost-back-btn">
          <IconCreditCard size={16} />
          <span>Make Another Payment</span>
        </button>
      </div>
    </div>
  );
}

export default StatusCheck;
