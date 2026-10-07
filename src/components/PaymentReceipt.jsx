import React, { useState } from 'react';

function PaymentReceipt({ transaction, onBack }) {
  const [copied, setCopied] = useState(false);

  if (!transaction) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyDetails = () => {
    const text = `
=== PAYMENT RECEIPT ===
Payee: Abhijit Kumar (euonabhijit@okicici)
Verification ID: ${transaction.verificationId}
Status: ${transaction.status.toUpperCase()}
Amount: ₹${transaction.amount}
Payer Name: ${transaction.name}
Email: ${transaction.email}
Phone: ${transaction.phone}
Purpose: ${transaction.purpose}
Date: ${new Date(transaction.createdAt).toLocaleString()}
${transaction.utr ? `UTR: ${transaction.utr}` : ''}
Verified On: ${transaction.verifiedAt ? new Date(transaction.verifiedAt).toLocaleString() : 'N/A'}
=======================
    `.trim();

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
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
    <div className="receipt-container fade-in">
      <div className="receipt-card" id="printable-receipt">
        {/* Receipt Header */}
        <div className="receipt-header">
          <div className="receipt-badge-success">
            <span className="receipt-check">✓</span>
          </div>
          <h2>Payment Receipt</h2>
          <p className="receipt-sub">Verified & Confirmed by Receiver</p>
          <div className="receipt-amount">₹{parseFloat(transaction.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>

        <div className="receipt-divider"></div>

        {/* Details Grid */}
        <div className="receipt-grid">
          <div className="receipt-row">
            <span className="receipt-label">Verification ID</span>
            <span className="receipt-value mono">{transaction.verificationId}</span>
          </div>

          <div className="receipt-row">
            <span className="receipt-label">Status</span>
            <span className="receipt-value status-pill success">
              ● Payment Successful
            </span>
          </div>

          <div className="receipt-row">
            <span className="receipt-label">Payer Name</span>
            <span className="receipt-value font-medium">{transaction.name}</span>
          </div>

          {transaction.email && (
            <div className="receipt-row">
              <span className="receipt-label">Email ID</span>
              <span className="receipt-value">{transaction.email}</span>
            </div>
          )}

          {transaction.phone && (
            <div className="receipt-row">
              <span className="receipt-label">Phone</span>
              <span className="receipt-value">{transaction.phone}</span>
            </div>
          )}

          <div className="receipt-row">
            <span className="receipt-label">Purpose</span>
            <span className="receipt-value">{transaction.purpose}</span>
          </div>

          <div className="receipt-row">
            <span className="receipt-label">Source</span>
            <span className="receipt-value">{transaction.source}</span>
          </div>

          {transaction.utr && (
            <div className="receipt-row">
              <span className="receipt-label">UPI Ref / UTR</span>
              <span className="receipt-value mono">{transaction.utr}</span>
            </div>
          )}

          <div className="receipt-row">
            <span className="receipt-label">Payment Date</span>
            <span className="receipt-value">{formatDate(transaction.createdAt)}</span>
          </div>

          <div className="receipt-row">
            <span className="receipt-label">Verified At</span>
            <span className="receipt-value">{formatDate(transaction.verifiedAt)}</span>
          </div>

          <div className="receipt-row">
            <span className="receipt-label">Payee VPA</span>
            <span className="receipt-value mono">euonabhijit@okicici</span>
          </div>
        </div>

        {/* Seal / Note */}
        <div className="receipt-seal">
          <div className="seal-box">
            <span className="seal-text">VERIFIED</span>
            <span className="seal-sub">ABHIJIT KUMAR</span>
          </div>
          <p className="receipt-note">This is a system-verified digital receipt confirming credit receipt.</p>
        </div>
      </div>

      {/* Action Buttons (Hidden when printing) */}
      <div className="receipt-actions no-print">
        <button onClick={handlePrint} className="submit-btn receipt-btn">
          🖨️ Print / Save PDF
        </button>
        <button onClick={handleCopyDetails} className="back-btn receipt-btn">
          {copied ? '✓ Copied Details!' : '📋 Copy Receipt Details'}
        </button>
        {onBack && (
          <button onClick={onBack} className="back-btn text-only-btn">
            ← Back to Status Check
          </button>
        )}
      </div>
    </div>
  );
}

export default PaymentReceipt;
