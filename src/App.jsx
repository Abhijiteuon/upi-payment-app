import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import StatusCheck from './components/StatusCheck';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import { addTransaction, getAdminSession, setAdminSession, updateTransactionStatus } from './services/storage';
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
      // 1. Create internal transaction record with unique Payment Verification ID
      const tx = addTransaction(formData);
      setCreatedTransaction(tx);
      setActiveVerificationId(tx.verificationId);

      // 2. Background Google Form submission with mapped Payment ID
      const formUrl = "https://docs.google.com/forms/d/e/1FAIpQLSe6ijmXl90ufpUplEoEWZj8uL92_jHt-w6kJANlf18dCTgzhA/formResponse";
      const data = new URLSearchParams();
      data.append("entry.1903499638", formData.name);
      data.append("entry.1388882637", formData.purpose);
      data.append("entry.635018705", formData.source);
      data.append("entry.794330962", formData.amount);
      data.append("entry.1805777836", formData.phone);
      data.append("entry.225713530", formData.email);
      data.append("entry.1090650382", tx.verificationId); // Payment ID

      try {
        fetch(formUrl, {
          method: "POST",
          mode: "no-cors",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: data.toString()
        }).catch(err => console.error("Google form log error", err));
      } catch (err) {
        console.error("Error submitting form", err);
      }

      setPaymentStep('qr');
    }
  };

  // Step 2 -> Step 3: User confirms payment made
  const handleConfirmPaid = () => {
    if (createdTransaction) {
      if (formData.utr) {
        updateTransactionStatus(createdTransaction.verificationId, 'pending', `User submitted UTR: ${formData.utr}`);
      }
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

  const upiLink = `upi://pay?pa=euonabhijit@okicici&pn=Abhijit%20Kumar&mc=0000&tr=TXN${Date.now()}&am=${formData.amount}&cu=INR&tn=${encodeURIComponent(formData.purpose || 'Payment to Abhijit')}`;

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

                    <button type="submit" className="submit-btn">
                      Proceed to Pay ₹{formData.amount || '0.00'}
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

                  {/* Optional UTR Input before confirmation */}
                  <div className="utr-input-box">
                    <label htmlFor="utr">Already paid? Enter 12-digit UPI Ref / UTR (Optional)</label>
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
                  </div>
                  
                  <div className="qr-footer-actions">
                    <button onClick={handleConfirmPaid} className="submit-btn continue-pay-btn">
                      ✓ I Have Made the Payment (Continue)
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
                      ⏱️ <strong>Verification Timeline:</strong> Verification is typically completed within <strong>3 hours to 2 days</strong>.
                    </p>
                    <p>
                      Once Abhijit verifies the bank credits, you can check back anytime to download your official <strong>Payment Receipt</strong>.
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
