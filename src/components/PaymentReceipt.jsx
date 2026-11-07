import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  maskPhone, 
  maskEmail, 
  maskVPA,
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
    : `https://upipay.internal/?verify=${transaction.verificationId}`;

  const handleCopyDetails = () => {
    const payeeName = transaction.payeeDisplayName || 'Merchant';
    const payeeVpa = transaction.payeeUpi || 'merchant@upi';

    const text = `
=== OFFICIAL PAYMENT RECEIPT ===
Payee: ${payeeName} (${isMasked ? maskVPA(payeeVpa) : payeeVpa})
Reference ID: ${transaction.verificationId}
Status: VERIFIED & COMPLETED
Amount: ₹${Number(transaction.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
Payer Name: ${transaction.name}
Email: ${isMasked ? maskEmail(transaction.email) : transaction.email}
Phone: ${isMasked ? maskPhone(transaction.phone) : transaction.phone}
Purpose / Note: ${transaction.purpose || 'Payment'}
Date: ${new Date(transaction.createdAt).toLocaleString()}
${transaction.utr ? `Bank UTR: ${transaction.utr}` : ''}
Verified On: ${transaction.verifiedAt ? new Date(transaction.verifiedAt).toLocaleString() : 'N/A'}
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
        
        {/* Receipt Header */}
        <div className="receipt-header-row">
          <div className="receipt-brand-col">
            <div className="receipt-brand-badge">
              <div>
                <span className="brand-name">UPI Pay</span>
                <span className="brand-product">OFFICIAL PAYMENT RECEIPT</span>
              </div>
            </div>
            <div className="receipt-voucher-number">
              Ref: {transaction.verificationId}
            </div>
          </div>

          <div className="receipt-status-col">
            <div className="receipt-verified-badge">
              <span className="pulsing-green-dot"></span>
              <IconShieldCheck size={14} className="text-emerald" />
              <span>VERIFIED & PAID</span>
            </div>
            <div className="receipt-issue-date">
              {formatDate(transaction.verifiedAt || transaction.createdAt)}
            </div>
          </div>
        </div>

        {/* Big Amount Display */}
        <div className="receipt-amount-banner">
          <div className="amount-caption">TOTAL AMOUNT PAID</div>
          <div className="amount-value-display">
            <span className="amount-currency">₹</span>
            <span className="amount-number">
              {Number(transaction.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="amount-words-meta">
            Payment Mode: Direct UPI Transfer
          </div>
        </div>

        {/* Perforated Divider Line */}
        <div className="receipt-ticket-divider">
          <div className="ticket-punch left"></div>
          <div className="ticket-dash-line"></div>
          <div className="ticket-punch right"></div>
        </div>

        {/* Details Grid */}
        <div className="receipt-details-table">
          <div className="receipt-detail-cell">
            <span className="cell-label">PAYER NAME</span>
            <span className="cell-value font-medium">{transaction.name}</span>
          </div>

          <div className="receipt-detail-cell">
            <span className="cell-label">NOTE / PURPOSE</span>
            <span className="cell-value">{transaction.purpose || 'Payment'}</span>
          </div>

          <div className="receipt-detail-cell">
            <span className="cell-label">BANK REF / UTR</span>
            <span className="cell-value mono font-semibold text-emerald">
              {transaction.utr || 'Directly Reconciled'}
            </span>
          </div>

          <div className="receipt-detail-cell">
            <span className="cell-label">RECEIVER UPI</span>
            <span className="cell-value mono">
              {isMasked ? maskVPA(transaction.payeeUpi || 'merchant@upi') : (transaction.payeeUpi || 'merchant@upi')}
            </span>
          </div>

          <div className="receipt-detail-cell">
            <span className="cell-label">DATE & TIME</span>
            <span className="cell-value">{formatDate(transaction.createdAt)}</span>
          </div>

          <div className="receipt-detail-cell">
            <span className="cell-label">CONTACT INFO</span>
            <span className="cell-value mono">
              {isMasked ? maskPhone(transaction.phone) : transaction.phone}
            </span>
          </div>
        </div>

        {/* Digital Verification & Audit Seal */}
        <div className="receipt-security-seal-panel">
          <div className="seal-meta-col">
            <div className="seal-title">
              <IconLock size={14} className="text-emerald" />
              <span>DIGITAL PAYMENT SEAL</span>
            </div>
            <div className="seal-fingerprint mono">
              {receiptFingerprint}
            </div>
            <div className="seal-description">
              Tamper-evident verification hash. Scan QR code to verify this receipt online.
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

        {/* Receipt Sign-off Footer */}
        <div className="receipt-signoff-footer">
          <div className="signoff-signature-block">
            <div className="signature-line">{transaction.payeeDisplayName || 'Authorized Merchant'}</div>
            <div className="signature-caption">Receiver Confirmation</div>
          </div>
          <div className="signoff-legal">
            This digital receipt confirms the electronic credit receipt to the receiver via NPCI Unified Payments Interface (UPI).
          </div>
        </div>
      </div>

      {/* Modern Control Actions Toolbar */}
      <div className="receipt-toolbar no-print">
        <button onClick={handlePrint} className="primary-action-btn toolbar-btn">
          <IconPrinter size={16} />
          <span>Save PDF / Print</span>
        </button>

        <button 
          onClick={() => setIsMasked(!isMasked)} 
          className="secondary-action-btn toolbar-btn"
          title="Toggle privacy masking on contact details"
        >
          {isMasked ? <IconEye size={16} /> : <IconEyeOff size={16} />}
          <span>{isMasked ? 'Show Contact' : 'Hide Contact'}</span>
        </button>

        <button onClick={handleCopyDetails} className="secondary-action-btn toolbar-btn">
          {copied ? <IconCheck size={16} className="text-emerald" /> : <IconCopy size={16} />}
          <span>{copied ? 'Copied Receipt' : 'Copy Text'}</span>
        </button>

        {onBack && (
          <button onClick={onBack} className="ghost-back-btn toolbar-back-btn">
            <IconArrowLeft size={16} />
            <span>Back to Status</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default PaymentReceipt;