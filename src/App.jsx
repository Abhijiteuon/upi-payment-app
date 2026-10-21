import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import StatusCheck from './components/StatusCheck';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import { addTransaction, getAdminSession, setAdminSession, updateTransactionStatus, submitToGoogleForm } from './services/storage';
import './index.css';

function App() {
  // Views: 'pay', 'status', 'admin'
  const [currentView, setCurrentView] = useState('pay');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [activeVerificationId, setActiveVerificationId] = useState('');

  // Payment form state
  const [formData, setFormData] = useState({
    name: '',
    purpose: '',
    source: '',
    amount: '',
    phone: '',
    email: '',
    utr: ''
  });

  // Payment step: 'form' | 'qr' | 'confirmed'
  const [paymentStep, setPaymentStep] = useState('form');
  const [createdTransaction, setCreatedTransaction] = useState(null);
  const [isCopiedVpa, setIsCopiedVpa] = useState(false);
  const [isCopiedId, setIsCopiedId] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize admin session check
  useEffect(() => {
    setIsAdminLoggedIn(getAdminSession());
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Step 1 -> Step 2: Proceed to Pay
  const handleProceedToPay = async (e) => {
    e.preventDefault();
    if (formData.name && formData.amount && formData.purpose && formData.source) {
      setIsSubmitting(true);
      // Create internal transaction record in Supabase
      const tx = await addTransaction(formData);
      setCreatedTransaction(tx);
      setActiveVerificationId(tx.verificationId);
      setIsSubmitting(false);
      setPaymentStep('qr');
    }
  };

  // Step 2 -> Step 3: User confirms payment made
  const handleConfirmPaid = async () => {
    if (createdTransaction) {
      setIsSubmitting(true);
      const updatedTx = { ...createdTransaction, utr: formData.utr };
      submitToGoogleForm(updatedTx, 'pending');
      if (formData.utr) {
        await updateTransactionStatus(
          createdTransaction.verificationId, 
          'pending', 
          `User submitted UTR: ${formData.utr}`, 
          formData.utr
        );
      }
      setIsSubmitting(false);
    }
    setPaymentStep('confirmed');
  };

  const handleCopyVpa = () => {
    navigator.clipboard.writeText('euonabhijit@okicici').then(() => {
      setIsCopiedVpa(true);
      setTimeout(() => setIsCopiedVpa(false), 2000);
    });
  };

  const handleCopyVerificationId = () => {
    if (!createdTransaction) return;
    navigator.clipboard.writeText(createdTransaction.verificationId).then(() => {
      setIsCopiedId(true);
      setTimeout(() => setIsCopiedId(false), 2000);
    });
  };

  const handleResetToPay = () => {
    setFormData({
      name: '',
      purpose: '',
      source: '',
      amount: '',
      phone: '',
      email: '',
      utr: ''
    });
    setPaymentStep('form');
    setCreatedTransaction(null);
    setCurrentView('pay');
  };

  const handleTrackCreatedPayment = () => {
    if (createdTransaction) {
      setActiveVerificationId(createdTransaction.verificationId);
      setCurrentView('status');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    setAdminSession(false);
    setCurrentView('pay');
  };

  // Pre-fill transaction note with Verification ID so bank statement shows it clearly!
  const noteContent = createdTransaction 
    ? `${createdTransaction.verificationId} - ${formData.purpose || 'Payment'}`
    : (formData.purpose || 'Payment to Abhijit');

  const upiLink = `upi://pay?pa=euonabhijit@okicici&pn=Abhijit%20Kumar&mc=0000&tr=TXN${Date.now()}&am=${formData.amount}&cu=INR&tn=${encodeURIComponent(noteContent)}`;

  return (
    <div className="app-root">
      <Navbar 
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        isAdminLoggedIn={isAdminLoggedIn}
        onAdminLogout={handleAdminLogout}
      />

      <div className="bg-shape"></div>
      
      <main className="container">
        <div className={`glass-card ${currentView === 'admin' && isAdminLoggedIn ? 'admin-glass-card' : ''}`}>
          
          {/* VIEW: MAKE A PAYMENT */}
          {currentView === 'pay' && (
            <>
              {/* STEP 1: PAYMENT FORM */}
              {paymentStep === 'form' && (
                <div className="fade-in">
                  <div className="header">
                    <h1>Pay Abhijit Securely</h1>
                    <p>Enter your payment details to generate a secure UPI transaction</p>
                  </div>

                  <form onSubmit={handleProceedToPay}>
                    <div className="form-group">
                      <label htmlFor="name">Full Name *</label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        className="form-control"
                        placeholder="Enter your full name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="email">Email ID *</label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        className="form-control"
                        placeholder="Enter your email address"
                        value={formData.email}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="phone">Phone Number *</label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        className="form-control"
                        placeholder="Enter 10-digit mobile number"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="purpose">Purpose of Payment *</label>
                      <select
                        id="purpose"
                        name="purpose"
                        className="form-control"
                        value={formData.purpose}
                        onChange={handleChange}
                        required
                      >
                        <option value="" disabled>Select a purpose</option>
                        <option value="Freelance project completion Payment">Freelance project completion Payment</option>
                        <option value="Education-venture payment">Education-venture payment</option>
                        <option value="Salary Payment">Salary Payment</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="source">Source *</label>
                      <select
                        id="source"
                        name="source"
                        className="form-control"
                        value={formData.source}
                        onChange={handleChange}
                        required
                      >
                        <option value="" disabled>Select source type</option>
                        <option value="Organisation">Organisation</option>
                        <option value="Private">Private</option>
                        <option value="Individual">Individual</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="amount">Amount (INR) *</label>
                      <div className="amount-input-wrapper">
                        <input
                          type="number"
                          id="amount"
                          name="amount"
                          className="form-control"
                          placeholder="0.00"
                          min="1"
                          step="0.01"
                          value={formData.amount}
                          onChange={handleChange}
                          required
                        />
                      </div>
                    </div>

                    <button type="submit" className="submit-btn" disabled={isSubmitting}>
                      {isSubmitting ? 'Creating Verification...' : `Proceed to Pay ₹${formData.amount || '0.00'}`}
                    </button>
                  </form>
                </div>
              )}

              {/* STEP 2: QR & UPI PAYMENT SCREEN */}
              {paymentStep === 'qr' && (
                <div className="fade-in qr-placeholder">
                  <div className="step-indicator">Step 2 of 3: Complete Payment</div>
                  <h3>Scan to Pay ₹{formData.amount}</h3>
                  <p className="pay-purpose-tag">Purpose: {formData.purpose}</p>
                  
                  {/* Dynamic QR */}
                  <div className="qr-box">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiLink)}`} 
                      alt="UPI QR Code" 
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>
                  
                  <div className="upi-id-row">
                    <span className="upi-id-label">UPI ID:</span>
                    <span className="upi-id-display">euonabhijit@okicici</span>
                    <button 
                      type="button" 
                      onClick={handleCopyVpa} 
                      className="copy-mini-btn"
                      title="Copy UPI ID"
                    >
                      {isCopiedVpa ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>

                  <div className="upi-actions-block">
                    <a 
                      href={upiLink} 
                      className="submit-btn direct-pay-btn"
                    >
                      🚀 Open in UPI App (GPay / PhonePe / Paytm)
                    </a>
                  </div>

                  {/* UTR Input before confirmation */}
                  <div className="utr-input-box">
                    <label htmlFor="utr">Already paid? Enter 12-digit UPI Ref / UTR</label>
                    <input
                      type="text"
                      id="utr"
                      name="utr"
                      className="form-control mono-input"
                      placeholder="e.g. 410293847561"
                      maxLength={16}
                      value={formData.utr}
                      onChange={handleChange}
                    />
                    <small style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginTop: '0.3rem' }}>
                      💡 Providing the UTR allows instant verification against bank records.
                    </small>
                  </div>
                  
                  <div className="qr-footer-actions">
                    <button onClick={handleConfirmPaid} className="submit-btn continue-pay-btn" disabled={isSubmitting}>
                      {isSubmitting ? 'Submitting...' : '✓ I Have Made the Payment (Continue)'}
                    </button>

                    <button onClick={() => setPaymentStep('form')} className="back-btn">
                      ← Edit Details
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: PAYMENT SUBMITTED & VERIFICATION ID */}
              {paymentStep === 'confirmed' && createdTransaction && (
                <div className="fade-in confirmation-panel">
                  <div className="confirmation-icon-badge">
                    <span>⏳</span>
                  </div>

                  <h2>Payment Submitted!</h2>
                  <p className="confirmation-sub">
                    Your transaction details have been registered for receiver verification.
                  </p>

                  <div className="verification-id-card">
                    <span className="ver-id-label">YOUR PAYMENT VERIFICATION ID</span>
                    <div className="ver-id-code">{createdTransaction.verificationId}</div>
                    <button 
                      onClick={handleCopyVerificationId}
                      className="copy-id-btn"
                    >
                      {isCopiedId ? '✓ ID Copied to Clipboard!' : '📋 Copy Verification ID'}
                    </button>
                  </div>

                  <div className="verification-info-alert">
                    <p>
                      ⚡ <strong>Live Status Updates:</strong> Once Abhijit verifies the payment, your status will update in real-time.
                    </p>
                    <p>
                      Click <strong>Track Status</strong> below to watch your receipt unlock live!
                    </p>
                  </div>

                  <div className="confirmation-actions">
                    <button 
                      onClick={handleTrackCreatedPayment}
                      className="submit-btn"
                    >
                      🔍 Track Status of This Payment
                    </button>
                    
                    <button 
                      onClick={handleResetToPay}
                      className="back-btn"
                    >
                      + Make Another Payment
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* VIEW: CHECK STATUS */}
          {currentView === 'status' && (
            <StatusCheck 
              initialVerificationId={activeVerificationId}
              onBackToPay={handleResetToPay}
            />
          )}

          {/* VIEW: ADMIN PORTAL */}
          {currentView === 'admin' && (
            <>
              {isAdminLoggedIn ? (
                <AdminDashboard onLogout={handleAdminLogout} />
              ) : (
                <AdminLogin 
                  onLoginSuccess={() => setIsAdminLoggedIn(true)}
                  onCancel={() => setCurrentView('pay')}
                />
              )}
            </>
          )}

        </div>
      </main>
    </div>
  );
}

export default App;
