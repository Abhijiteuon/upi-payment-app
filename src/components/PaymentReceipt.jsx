import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  maskPhone, 
  maskEmail, 
  generateReceiptFingerprint 
} from '../services/security';
import { 
  IconShieldCheck, 
  IconPrinter, 
  IconCopy, 
  IconCheck, 
  IconArrowLeft, 
  IconLock,
  IconEye,
  IconEyeOff
} from './Icons';

function PaymentReceipt({ transaction, onBack, isAdminView = false }) {
  const [copied, setCopied] = useState(false);
  const [isMasked, setIsMasked] = useState(!isAdminView);

  if (!transaction) return null;

  const handlePrint = () => {
    window.print();
  };

  const receiptFingerprint = generateReceiptFingerprint(
    transaction.verificationId,
    transaction.amount,
    transaction.utr,
    transaction.verifiedAt
  );

  const verificationUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}${window.location.pathname}?verify=${transaction.verificationId}`
    : `https://upi.codeed.in/?verify=${transaction.verificationId}`;

  const handleCopyDetails = () => {
    const text = `
=== OFFICIAL PAYMENT RECEIPT ===
Payee: Abhijit Kumar (euonabhijit@okicici)
Verification ID: ${transaction.verificationId}
Status: VERIFIED & SETTLED
Amount: ₹${Number(transaction.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
Payer Name: ${transaction.name}
Email: ${isMasked ? maskEmail(transaction.email) : transaction.email}
Phone: ${isMasked ? maskPhone(transaction.phone) : transaction.phone}
Purpose: ${transaction.purpose}
Date: ${new Date(transaction.createdAt).toLocaleString()}
${transaction.utr ? `UTR: ${transaction.utr}` : ''}
Verified On: ${transaction.verifiedAt ? new Date(transaction.verifiedAt).toLocaleString() : 'N/A'}
Security Fingerprint: ${receiptFingerprint}
Verify Online: ${verificationUrl}
================================
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
    <div className="receipt-view-wrapper fade-in">
      <div className="receipt-card-container" id="printable-receipt">
        
        {/* Receipt Header with Brand & Verified Status */}
        <div className="receipt-header-row">
          <div className="receipt-brand-col">
            <div className="receipt-brand-badge">
              <img src="/codeed-icon.png" alt="codeED" className="receipt-brand-logo" />
              <div>
                <span className="brand-name">codeED</span>
                <span className="brand-product">PAYMENT SETTLEMENTS</span>
              </div>
            </div>
            <div className="receipt-voucher-number">
              OFFICIAL RECEIPT · {transaction.verificationId}
            </div>
          </div>

          <div className="receipt-status-col">
            <div className="receipt-verified-badge">
              <span className="pulsing-green-dot"></span>
              <IconShieldCheck size={14} className="text-emerald" />
              <span>VERIFIED & SETTLED</span>
            </div>
            <div className="receipt-issue-date">
              Settled: {formatDate(transaction.verifiedAt)}
            </div>
          </div>
        </div>

        {/* Big Amount Display */}
        <div className="receipt-amount-banner">
          <div className="amount-caption">TOTAL AMOUNT SETTLED</div>
          <div className="amount-value-display">
            <span className="amount-currency">₹</span>
            <span className="amount-number">
              {Number(transaction.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="amount-words-meta">
            Payment Mode: Direct UPI (Instant Bank Settlement)
          </div>
        </div>

        {/* Perforated Divider Line */}
        <div className="receipt-ticket-divider">
          <div className="ticket-punch left"></div>
          <div className="ticket-dash-line"></div>
          <div className="ticket-punch right"></div>
        </div>

        {/* Financial Specification Grid */}
        <div className="receipt-details-table">
          <div className="receipt-detail-cell">
            <span className="cell-label">PAYER NAME</span>
            <span className="cell-value font-medium">{transaction.name}</span>
          </div>

          <div className="receipt-detail-cell">
            <span className="cell-label">PAYMENT PURPOSE</span>
            <span className="cell-value">{transaction.purpose}</span>
          </div>

          <div className="receipt-detail-cell">
            <span className="cell-label">PAYER CONTACT</span>
            <span className="cell-value mono">
              {isMasked ? maskPhone(transaction.phone) : transaction.phone}
            </span>
          </div>

          <div className="receipt-detail-cell">
            <span className="cell-label">PAYER EMAIL</span>
            <span className="cell-value">
              {isMasked ? maskEmail(transaction.email) : transaction.email}
            </span>
          </div>

          <div className="receipt-detail-cell">
            <span className="cell-label">BANK REF / UTR</span>
            <span className="cell-value mono font-semibold text-emerald">
              {transaction.utr || 'Directly Reconciled'}
            </span>
          </div>

          <div className="receipt-detail-cell">
            <span className="cell-label">RECEIVER VPA</span>
            <span className="cell-value mono">euonabhijit@okicici</span>
          </div>

          <div className="receipt-detail-cell">
            <span className="cell-label">INITIATED ON</span>
            <span className="cell-value">{formatDate(transaction.createdAt)}</span>
          </div>

          <div className="receipt-detail-cell">
            <span className="cell-label">ENTITY TYPE</span>
            <span className="cell-value">{transaction.source || 'Individual'}</span>
          </div>
        </div>

        {/* Digital Verification & Audit Seal */}
        <div className="receipt-security-seal-panel">
          <div className="seal-meta-col">
            <div className="seal-title">
              <IconLock size={14} className="text-emerald" />
              <span>CRYPTOGRAPHIC AUDIT SEAL</span>
            </div>
            <div className="seal-fingerprint mono">
              {receiptFingerprint}
            </div>
            <div className="seal-description">
              Tamper-evident hash generated from Verification ID, settled amount, and banking timestamp. Scan QR to authenticate.
            </div>
          </div>

          <div className="seal-qr-col">
            <div className="seal-qr-bezel">
              <QRCodeSVG 
                value={verificationUrl}
                size={70}
                level="M"
                includeMargin={false}
              />
            </div>
            <span className="scan-verify-label">Scan to Verify</span>
          </div>
        </div>

        {/* Institutional Sign-off Footer */}
        <div className="receipt-signoff-footer">
          <div className="signoff-signature-block">
            <div className="signature-line">Abhijit Kumar</div>
            <div className="signature-caption">Authorized Receiver & Engineer</div>
          </div>
          <div className="signoff-legal">
            This digital receipt confirms the electronic credit receipt to the receiver's ICICI Bank account via NPCI Unified Payments Interface (UPI).
          </div>
        </div>
      </div>

      {/* Modern Control Actions Toolbar */}
      <div className="receipt-toolbar no-print">
        <button onClick={handlePrint} className="primary-action-btn toolbar-btn">
          <IconPrinter size={16} />
          <span>Print / Save PDF</span>
        </button>

        <button 
          onClick={() => setIsMasked(!isMasked)} 
          className="secondary-action-btn toolbar-btn"
          title="Toggle privacy masking on contact details"
        >
          {isMasked ? <IconEye size={16} /> : <IconEyeOff size={16} />}
          <span>{isMasked ? 'Unmask Details' : 'Mask Details'}</span>
        </button>

        <button onClick={handleCopyDetails} className="secondary-action-btn toolbar-btn">
          {copied ? <IconCheck size={16} className="text-emerald" /> : <IconCopy size={16} />}
          <span>{copied ? 'Copied Receipt' : 'Copy Text'}</span>
        </button>

        {onBack && (
          <button onClick={onBack} className="ghost-back-btn toolbar-back-btn">
            <IconArrowLeft size={16} />
            <span>Back to Status Search</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default PaymentReceipt;
