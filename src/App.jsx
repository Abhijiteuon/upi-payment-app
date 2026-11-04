import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Navbar from './components/Navbar';
import StatusCheck from './components/StatusCheck';
import AuthPortal from './components/AuthPortal';
import UserDashboard from './components/UserDashboard';
import { 
  addTransaction, 
  getAdminSession, 
  updateTransactionStatus, 
  submitToGoogleForm
} from './services/storage';
import { 
  getPublicProfileByUsername, 
  getActiveProfile, 
  logoutMerchantSession,
  DEFAULT_MERCHANT 
} from './services/profileService';
import { 
  validateUTR, 
  validatePhone, 
  validateEmail, 
  validateAmount, 
  sanitizeText 
} from './services/security';
import { 
  IconShieldCheck, 
  IconCheck, 
  IconCopy, 
  IconArrowRight, 
  IconArrowLeft, 
  IconAlertCircle, 
  IconClock, 
  IconSmartPhone 
} from './components/Icons';
import './index.css';

const QUICK_AMOUNTS = ['250', '500', '1000', '2500', '5000'];

function App() {
  // Views: 'pay', 'status', 'admin'
  const [currentView, setCurrentView] = useState('pay');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [activeProfileState, setActiveProfileState] = useState(null);
  const [activeVerificationId, setActiveVerificationId] = useState('');

  // Receiving Merchant / Payee Profile
  const [payee, setPayee] = useState(DEFAULT_MERCHANT);
  const [isPreSetAmount, setIsPreSetAmount] = useState(false);

  // Payment form state
  const [formData, setFormData] = useState({
    name: '',
    purpose: 'Freelance project completion Payment',
    source: 'Individual',
    amount: '',
    phone: '',
    email: '',
    utr: ''
  });

  // Validation errors
  const [formError, setFormError] = useState('');
  const [utrError, setUtrError] = useState('');

  // Payment step: 'form' | 'qr' | 'confirmed'
  const [paymentStep, setPaymentStep] = useState('form');
  const [createdTransaction, setCreatedTransaction] = useState(null);
  const [isCopiedVpa, setIsCopiedVpa] = useState(false);
  const [isCopiedId, setIsCopiedId] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize admin session check & URL parameter detection
  useEffect(() => {
    // Check logged-in merchant session
    const loggedIn = getAdminSession();
    setIsAdminLoggedIn(loggedIn);
    if (loggedIn) {
      const activeProf = getActiveProfile();
      if (activeProf) setActiveProfileState(activeProf);
    }

    // Parse URL parameters for payment request links & status verification
    try {
      const params = new URLSearchParams(window.location.search);
      
      // 1. Check for Payee handle: ?to=username or ?payTo=username or ?user=username
      const toParam = params.get('to') || params.get('payTo') || params.get('user');
      if (toParam) {
        getPublicProfileByUsername(toParam).then(prof => {
          if (prof) setPayee(prof);
        });
      }

      // 2. Check for pre-set amount: ?am=500 or ?amount=500
      const amParam = params.get('am') || params.get('amount');
      if (amParam && !isNaN(parseFloat(amParam))) {
        setFormData(prev => ({ ...prev, amount: String(parseFloat(amParam)) }));
        setIsPreSetAmount(true);
      }

      // 3. Check for pre-set purpose: ?desc=Invoice+104 or ?purpose=Services
      const descParam = params.get('desc') || params.get('purpose');
      if (descParam) {
        setFormData(prev => ({ ...prev, purpose: descParam.trim() }));
      }

      // 4. Check for status lookup deep link: ?verify=VER-XXXXXX
      const verifyParam = params.get('verify') || params.get('check');
      if (verifyParam) {
        setActiveVerificationId(verifyParam.trim().toUpperCase());
        setCurrentView('status');
      }
    } catch (err) {
      console.warn('URL param parse notice:', err);
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formError) setFormError('');
    if (name === 'utr' && utrError) setUtrError('');
  };

  const handleSelectQuickAmount = (amt) => {
    setFormData(prev => ({ ...prev, amount: amt }));
    if (formError) setFormError('');
  };

  // Step 1 -> Step 2: Proceed to Pay with Full Input Validation
  const handleProceedToPay = async (e) => {
    e.preventDefault();
    setFormError('');

    const cleanName = sanitizeText(formData.name, 80);
    if (!cleanName || cleanName.length < 2) {
      setFormError('Please enter a valid full name (minimum 2 characters).');
      return;
    }

    const emailRes = validateEmail(formData.email);
    if (!emailRes.valid) {
      setFormError(emailRes.error);
      return;
    }

    const phoneRes = validatePhone(formData.phone);
    if (!phoneRes.valid) {
      setFormError(phoneRes.error);
      return;
    }

    const amountRes = validateAmount(formData.amount);
    if (!amountRes.valid) {
      setFormError(amountRes.error);
      return;
    }

    if (!formData.purpose) {
      setFormError('Please specify the payment purpose.');
      return;
    }

    const sanitizedData = {
      ...formData,
      name: cleanName,
      email: emailRes.clean,
      phone: phoneRes.clean,
      amount: amountRes.num,
      payeeUsername: payee.username,
      payeeId: payee.id,
      payeeUpi: payee.upiId,
      payeeDisplayName: payee.displayName
    };

    setIsSubmitting(true);
    try {
      const tx = await addTransaction(sanitizedData);
      setCreatedTransaction(tx);
      setActiveVerificationId(tx.verificationId);
      setPaymentStep('qr');
    } catch (err) {
      console.error('Payment registration error:', err);
      setFormError('Failed to initialize payment session. Please check connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2 -> Step 3: User confirms payment made with UTR fraud check
  const handleConfirmPaid = async () => {
    setUtrError('');
    const rawUtr = formData.utr ? formData.utr.trim() : '';

    if (rawUtr) {
      const utrCheck = validateUTR(rawUtr);
      if (!utrCheck.valid) {
        setUtrError(utrCheck.error);
        return;
      }
    }

    if (createdTransaction) {
      setIsSubmitting(true);
      const updatedTx = { ...createdTransaction, utr: rawUtr };
      submitToGoogleForm(updatedTx, 'pending');

      if (rawUtr) {
        const updateResult = await updateTransactionStatus(
          createdTransaction.verificationId, 
          'pending', 
          `User submitted UTR: ${rawUtr}`, 
          rawUtr
        );

        if (updateResult && !updateResult.success && updateResult.error) {
          setUtrError(updateResult.error);
          setIsSubmitting(false);
          return;
        }
      }
      setIsSubmitting(false);
    }
    setPaymentStep('confirmed');
  };

  const handleCopyVpa = () => {
    navigator.clipboard.writeText(payee.upiId).then(() => {
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
      purpose: 'Freelance project completion Payment',
      source: 'Individual',
      amount: '',
      phone: '',
      email: '',
      utr: ''
    });
    setFormError('');
    setUtrError('');
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

  const handleAdminLogout = async () => {
    await logoutMerchantSession();
    setIsAdminLoggedIn(false);
    setActiveProfileState(null);
    setCurrentView('pay');
  };

  const handleLoginSuccess = (profile) => {
    setIsAdminLoggedIn(true);
    setActiveProfileState(profile);
    setCurrentView('admin');
  };

  const noteContent = createdTransaction 
    ? `${createdTransaction.verificationId} - ${formData.purpose || 'Payment'}`
    : (formData.purpose || `Payment to ${payee.displayName}`);

  // Dynamic UPI URL pointing directly to the receiver's configured UPI ID and legal display name
  const upiLink = `upi://pay?pa=${payee.upiId}&pn=${encodeURIComponent(payee.displayName)}&mc=0000&tr=TXN${Date.now()}&am=${formData.amount}&cu=INR&tn=${encodeURIComponent(noteContent)}`;

  return (
    <div className="app-root">
      <Navbar 
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        isAdminLoggedIn={isAdminLoggedIn}
        onAdminLogout={handleAdminLogout}
        activeProfile={activeProfileState}
      />

      {/* Subtle Ambient Lighting */}
      <div className="ambient-spotlight"></div>
      
      <main className="container">
        <div className={`glass-card ${currentView === 'admin' && isAdminLoggedIn ? 'admin-glass-card' : ''}`}>
          
          {/* VIEW: MAKE A PAYMENT */}
          {currentView === 'pay' && (
            <>
              {/* Sleek Step Indicator Timeline */}
              <div className="stepper-bar">
                <div className={`step-item ${paymentStep === 'form' ? 'active' : 'completed'}`}>
                  <div className="step-circle">
                    {paymentStep !== 'form' ? <IconCheck size={13} /> : '1'}
                  </div>
                  <span className="step-label">Details</span>
                </div>
                <div className="step-connector"></div>
                <div className={`step-item ${paymentStep === 'qr' ? 'active' : paymentStep === 'confirmed' ? 'completed' : ''}`}>
                  <div className="step-circle">
                    {paymentStep === 'confirmed' ? <IconCheck size={13} /> : '2'}
                  </div>
                  <span className="step-label">Transfer</span>
                </div>
                <div className="step-connector"></div>
                <div className={`step-item ${paymentStep === 'confirmed' ? 'active' : ''}`}>
                  <div className="step-circle">3</div>
                  <span className="step-label">Verify</span>
                </div>
              </div>

              {/* STEP 1: PAYMENT FORM */}
              {paymentStep === 'form' && (
                <div className="fade-in form-view-container">
                  
                  {/* Verified Payee Header Pill */}
                  <div className="payee-profile-banner">
                    <div className="payee-avatar">
                      {(payee.displayName || payee.username || 'M').charAt(0).toUpperCase()}
                    </div>
                    <div className="payee-info">
                      <span className="payee-label">VERIFIED RECEIVER ACCOUNT</span>
                      <div className="payee-title-line">
                        <span className="payee-name">{payee.displayName}</span>
                        <span className="payee-handle mono">@{payee.username}</span>
                      </div>
                      {payee.bio && <span className="payee-bio">{payee.bio}</span>}
                    </div>
                    <div className="payee-vpa-chip mono">
                      {payee.upiId}
                    </div>
                  </div>

                  <div className="card-header-block">
                    <div className="header-meta-pill">
                      <IconShieldCheck size={14} className="text-emerald" />
                      <span>CLOAK PROTOCOL · DIRECT SETTLEMENT</span>
                    </div>
                    <h1 className="main-title">
                      Initiate Payment
                    </h1>
                  </div>

                  {formError && (
                    <div className="status-alert alert-error fade-in">
                      <IconAlertCircle size={18} className="alert-icon-svg" />
                      <div className="alert-body">
                        <p>{formError}</p>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleProceedToPay} className="payment-form-grid">
                    
                    {/* Amount Field with Quick Select Chips */}
                    <div className="form-group amount-group">
                      <div className="amount-label-row">
                        <label htmlFor="amount" className="field-label">Transfer Amount (INR)</label>
                        <span className="amount-currency-tag">₹ INR</span>
                      </div>
                      <div className="amount-input-box">
                        <span className="currency-symbol">₹</span>
                        <input
                          type="number"
                          id="amount"
                          name="amount"
                          className="amount-input"
                          placeholder="0.00"
                          min="1"
                          max="100000"
                          step="0.01"
                          value={formData.amount}
                          onChange={handleChange}
                          required
                          autoFocus={!isPreSetAmount}
                        />
                      </div>

                      {/* Quick Amount Selector Chips */}
                      <div className="quick-amount-row">
                        <span className="quick-amount-hint">Quick Select:</span>
                        {QUICK_AMOUNTS.map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            className={`quick-amount-chip ${formData.amount === amt ? 'selected' : ''}`}
                            onClick={() => handleSelectQuickAmount(amt)}
                          >
                            ₹{Number(amt).toLocaleString('en-IN')}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Full Name & Phone */}
                    <div className="form-row-2col">
                      <div className="form-group">
                        <label htmlFor="name" className="field-label">Payer Full Name *</label>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          className="form-control"
                          placeholder="Enter your legal name"
                          value={formData.name}
                          onChange={handleChange}
                          maxLength={80}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="phone" className="field-label">Mobile Number *</label>
                        <input
                          type="tel"
                          id="phone"
                          name="phone"
                          className="form-control mono"
                          placeholder="10-digit mobile number"
                          value={formData.phone}
                          onChange={handleChange}
                          maxLength={15}
                          required
                        />
                      </div>
                    </div>

                    {/* Email Field */}
                    <div className="form-group">
                      <label htmlFor="email" className="field-label">Email ID (For Official Receipt) *</label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        className="form-control"
                        placeholder="name@company.com"
                        value={formData.email}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    {/* Purpose of Payment */}
                    <div className="form-group">
                      <label htmlFor="purpose" className="field-label">Purpose of Payment *</label>
                      <input
                        type="text"
                        id="purpose"
                        name="purpose"
                        className="form-control"
                        placeholder="Payment purpose or invoice reference"
                        value={formData.purpose}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    {/* Source Selector as Modern Segmented Control */}
                    <div className="form-group">
                      <label className="field-label">Payer Category / Entity Type *</label>
                      <div className="segmented-control">
                        {['Individual', 'Private', 'Organisation'].map((src) => (
                          <button
                            key={src}
                            type="button"
                            className={`segmented-btn ${formData.source === src ? 'active' : ''}`}
                            onClick={() => setFormData(prev => ({ ...prev, source: src }))}
                          >
                            {src}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button type="submit" className="primary-action-btn" disabled={isSubmitting}>
                      <span>{isSubmitting ? 'Securing Transaction...' : `Generate UPI QR · ₹${formData.amount ? Number(formData.amount).toLocaleString('en-IN') : '0.00'}`}</span>
                      <IconArrowRight size={18} />
                    </button>

                    <div className="guarantee-footer">
                      <IconShieldCheck size={15} className="text-emerald" />
                      <span>Secured with end-to-end 256-bit encryption • Direct Bank Settlement</span>
                    </div>
                  </form>
                </div>
              )}

              {/* STEP 2: LOCAL PRIVACY-SAFE QR & UPI PAYMENT SCREEN */}
              {paymentStep === 'qr' && (
                <div className="fade-in qr-view-container">
                  <div className="card-header-block text-center">
                    <div className="header-meta-pill">
                      <IconClock size={13} className="text-sky" />
                      <span>TRANSACTION SESSION ACTIVE</span>
                    </div>
                    <h2 className="main-title">
                      Scan & Pay ₹{Number(formData.amount).toLocaleString('en-IN')}
                    </h2>
                    <p className="sub-title">
                      Transferring directly to <strong>{payee.displayName}</strong> ({payee.upiId})
                    </p>
                  </div>

                  {/* Elevated High-Contrast QR Terminal Card */}
                  <div className="qr-terminal-card">
                    <div className="qr-terminal-frame">
                      <div className="qr-corner top-left"></div>
                      <div className="qr-corner top-right"></div>
                      <div className="qr-corner bottom-left"></div>
                      <div className="qr-corner bottom-right"></div>

                      <QRCodeSVG 
                        value={upiLink} 
                        size={190}
                        level="H"
                        includeMargin={false}
                        className="rendered-qr-svg"
                      />
                    </div>

                    {/* VPA Copy Pill */}
                    <div className="vpa-display-pill">
                      <div className="vpa-info">
                        <span className="vpa-label">OFFICIAL RECEIVER VPA</span>
                        <span className="vpa-address">{payee.upiId}</span>
                      </div>
                      <button 
                        type="button" 
                        onClick={handleCopyVpa} 
                        className="copy-pill-btn"
                        title="Copy UPI ID"
                      >
                        {isCopiedVpa ? <IconCheck size={14} className="text-emerald" /> : <IconCopy size={14} />}
                        <span>{isCopiedVpa ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    {/* Supported UPI Apps Row */}
                    <div className="supported-apps-row">
                      <span className="app-badge gpay">Google Pay</span>
                      <span className="app-badge phonepe">PhonePe</span>
                      <span className="app-badge paytm">Paytm</span>
                      <span className="app-badge cred">CRED</span>
                      <span className="app-badge bhim">BHIM</span>
                    </div>
                  </div>

                  {/* Mobile Deep Link */}
                  <div className="direct-open-block">
                    <a 
                      href={upiLink} 
                      className="secondary-action-btn mobile-pay-btn"
                    >
                      <IconSmartPhone size={17} />
                      <span>Open in Installed UPI App</span>
                    </a>
                  </div>

                  {/* UTR Input Section */}
                  <div className="utr-capture-card">
                    <div className="utr-label-row">
                      <label htmlFor="utr" className="utr-main-label">
                        Enter 12-Digit Bank UTR / UPI Reference
                      </label>
                      <span className="utr-badge-info">Anti-Spoof Protected</span>
                    </div>
                    <p className="utr-instruction-text">
                      After completing the payment in your UPI app, locate the 12-digit transaction reference (UTR) in your receipt and enter it below.
                    </p>

                    <div className="utr-input-wrapper">
                      <input
                        type="text"
                        id="utr"
                        name="utr"
                        className="form-control mono utr-field-control"
                        placeholder="e.g. 410293847561"
                        maxLength={12}
                        value={formData.utr}
                        onChange={handleChange}
                        autoComplete="off"
                      />
                    </div>

                    {utrError && (
                      <div className="status-alert alert-error inline-utr-alert fade-in">
                        <IconAlertCircle size={15} />
                        <span>{utrError}</span>
                      </div>
                    )}
                  </div>

                  <div className="step-actions-footer">
                    <button 
                      onClick={handleConfirmPaid} 
                      className="primary-action-btn"
                      disabled={isSubmitting}
                    >
                      <span>{isSubmitting ? 'Verifying Submission...' : 'I Have Completed Payment'}</span>
                      <IconCheck size={18} />
                    </button>

                    <button 
                      onClick={() => setPaymentStep('form')} 
                      className="ghost-back-btn"
                    >
                      <IconArrowLeft size={16} />
                      <span>Modify Payment Details</span>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: PAYMENT SUBMITTED & VERIFICATION ID */}
              {paymentStep === 'confirmed' && createdTransaction && (
                <div className="fade-in confirmed-view-container">
                  <div className="status-pulse-badge">
                    <div className="pulse-beacon"></div>
                    <IconClock size={28} className="beacon-icon" />
                  </div>

                  <h2 className="main-title text-center">
                    Payment Registered
                  </h2>
                  <p className="sub-title text-center">
                    Your transaction has been securely queued for receiver credit reconciliation.
                  </p>

                  <div className="verification-code-card">
                    <span className="ver-card-subtitle">UNIQUE TRACKING ID</span>
                    <div className="ver-card-number">{createdTransaction.verificationId}</div>
                    <button 
                      onClick={handleCopyVerificationId}
                      className="copy-ver-id-btn"
                    >
                      {isCopiedId ? <IconCheck size={15} className="text-emerald" /> : <IconCopy size={15} />}
                      <span>{isCopiedId ? 'ID Copied to Clipboard' : 'Copy Verification ID'}</span>
                    </button>
                  </div>

                  <div className="timeline-info-box">
                    <div className="timeline-point">
                      <div className="point-dot active"></div>
                      <div className="point-text">
                        <strong>Transaction Registered:</strong> Database session opened with Verification ID.
                      </div>
                    </div>
                    <div className="timeline-point">
                      <div className="point-dot pulse"></div>
                      <div className="point-text">
                        <strong>Bank Statement Reconciliation:</strong> Receiver ({payee.displayName}) will match your 12-digit UTR against their statement.
                      </div>
                    </div>
                    <div className="timeline-point">
                      <div className="point-dot"></div>
                      <div className="point-text">
                        <strong>Instant Receipt Unlock:</strong> Once approved, your official tax receipt unlocks live.
                      </div>
                    </div>
                  </div>

                  <div className="confirmation-cta-actions">
                    <button 
                      onClick={handleTrackCreatedPayment}
                      className="primary-action-btn"
                    >
                      <span>Track Live Status & View Receipt</span>
                      <IconArrowRight size={17} />
                    </button>
                    
                    <button 
                      onClick={handleResetToPay}
                      className="ghost-back-btn"
                    >
                      <span>+ Create Another Transaction</span>
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

          {/* VIEW: USER / MERCHANT PORTAL */}
          {currentView === 'admin' && (
            <>
              {isAdminLoggedIn ? (
                <UserDashboard onLogout={handleAdminLogout} />
              ) : (
                <AuthPortal 
                  onLoginSuccess={handleLoginSuccess}
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
