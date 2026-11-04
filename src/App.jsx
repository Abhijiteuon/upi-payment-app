import React, { useState, useEffect, useCallback } from 'react';
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
  buildPaymentRequestUrl,
  DEFAULT_MERCHANT 
} from './services/profileService';
import { 
  validateUTR, 
  validatePhone, 
  validateEmail, 
  validateAmount, 
  sanitizeText,
  maskVPA 
} from './services/security';
import { 
  IconShieldCheck, 
  IconCheck, 
  IconCopy, 
  IconArrowRight, 
  IconArrowLeft, 
  IconAlertCircle, 
  IconClock, 
  IconSmartPhone,
  IconLock
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

  // Privacy: Ghost Mode for Payer (Zero-PII Checkout)
  const [isGhostMode, setIsGhostMode] = useState(true);

  // Payment form state
  const [formData, setFormData] = useState({
    name: 'Anonymous Payer',
    purpose: 'Freelance project completion Payment',
    source: 'Individual',
    amount: '',
    phone: '9800000000',
    email: 'ghost@cloak.internal',
    utr: ''
  });

  // Validation errors
  const [formError, setFormError] = useState('');
  const [utrError, setUtrError] = useState('');

  // Payment step: 'form' | 'qr' | 'confirmed'
  const [paymentStep, setPaymentStep] = useState('form');
  const [createdTransaction, setCreatedTransaction] = useState(null);
  const [isCopiedLink, setIsCopiedLink] = useState(false);
  const [isCopiedId, setIsCopiedId] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync Payee helper: Resolves ?to=... from URL, or active logged-in profile, or default fallback
  const syncPayee = useCallback(async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const toParam = params.get('to') || params.get('payTo') || params.get('user');

      if (toParam) {
        const prof = await getPublicProfileByUsername(toParam);
        if (prof) {
          setPayee(prof);
          return;
        }
      }

      // If no ?to=... is in URL, check if a merchant is logged in
      const activeProf = getActiveProfile();
      if (activeProf && activeProf.username) {
        setPayee(activeProf);
        setActiveProfileState(activeProf);
        return;
      }

      // Default platform fallback
      setPayee(DEFAULT_MERCHANT);
    } catch (err) {
      console.warn('Sync payee notice:', err);
    }
  }, []);

  // Initialize admin session check & URL parameter detection
  useEffect(() => {
    // Check logged-in merchant session
    const loggedIn = getAdminSession();
    setIsAdminLoggedIn(loggedIn);
    if (loggedIn) {
      const activeProf = getActiveProfile();
      if (activeProf) setActiveProfileState(activeProf);
    }

    // Resolve Payee from URL or logged-in user
    syncPayee();

    // Check pre-set amount and purpose from URL
    try {
      const params = new URLSearchParams(window.location.search);
      const amParam = params.get('am') || params.get('amount');
      if (amParam && !isNaN(parseFloat(amParam))) {
        setFormData(prev => ({ ...prev, amount: String(parseFloat(amParam)) }));
        setIsPreSetAmount(true);
      }

      const descParam = params.get('desc') || params.get('purpose');
      if (descParam) {
        setFormData(prev => ({ ...prev, purpose: descParam.trim() }));
      }

      const verifyParam = params.get('verify') || params.get('check');
      if (verifyParam) {
        setActiveVerificationId(verifyParam.trim().toUpperCase());
        setCurrentView('status');
      }
    } catch (err) {
      console.warn('URL param parse notice:', err);
    }
  }, [syncPayee]);

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

  // Step 1 -> Step 2: Proceed to Pay with Privacy Hardening
  const handleProceedToPay = async (e) => {
    e.preventDefault();
    setFormError('');

    const amountRes = validateAmount(formData.amount);
    if (!amountRes.valid) {
      setFormError(amountRes.error);
      return;
    }

    if (!formData.purpose) {
      setFormError('Please specify the payment purpose.');
      return;
    }

    let finalName = 'Anonymous Payer';
    let finalEmail = 'ghost@cloak.internal';
    let finalPhone = '9800000000';

    if (!isGhostMode) {
      const cleanName = sanitizeText(formData.name, 80);
      if (!cleanName || cleanName.length < 2) {
        setFormError('Please enter a valid full name (minimum 2 characters).');
        return;
      }
      finalName = cleanName;

      const emailRes = validateEmail(formData.email);
      if (!emailRes.valid) {
        setFormError(emailRes.error);
        return;
      }
      finalEmail = emailRes.clean;

      const phoneRes = validatePhone(formData.phone);
      if (!phoneRes.valid) {
        setFormError(phoneRes.error);
        return;
      }
      finalPhone = phoneRes.clean;
    }

    const sanitizedData = {
      ...formData,
      name: finalName,
      email: finalEmail,
      phone: finalPhone,
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

  const handleCopyShareLink = () => {
    const link = buildPaymentRequestUrl(payee.username, formData.amount, formData.purpose);
    navigator.clipboard.writeText(link).then(() => {
      setIsCopiedLink(true);
      setTimeout(() => setIsCopiedLink(false), 2000);
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
      name: isGhostMode ? 'Anonymous Payer' : '',
      purpose: 'Freelance project completion Payment',
      source: 'Individual',
      amount: '',
      phone: isGhostMode ? '9800000000' : '',
      email: isGhostMode ? 'ghost@cloak.internal' : '',
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
    setPayee(DEFAULT_MERCHANT);
    setCurrentView('pay');
  };

  const handleLoginSuccess = (profile) => {
    setIsAdminLoggedIn(true);
    setActiveProfileState(profile);
    setPayee(profile);
    setCurrentView('admin');
  };

  // Called when merchant updates their profile in dashboard
  const handleProfileUpdate = (updatedProfile) => {
    setActiveProfileState(updatedProfile);
    setPayee(updatedProfile);
  };

  // Called when merchant clicks "Preview As Payer" in dashboard
  const handlePreviewPayment = (targetProfile) => {
    setPayee(targetProfile);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('to', targetProfile.username);
      window.history.pushState({}, '', url.toString());
    } catch {
      // ignore
    }
    setPaymentStep('form');
    setCurrentView('pay');
  };

  const noteContent = createdTransaction 
    ? `${createdTransaction.verificationId} - ${formData.purpose || 'Payment'}`
    : (formData.purpose || `Payment to ${payee.displayName || 'Merchant'}`);

  // Dynamic UPI URL pointing to receiver's configured UPI ID, with Payee Name set to alias
  const upiLink = `upi://pay?pa=${payee.upiId}&pn=${encodeURIComponent(payee.displayName || 'CLOAK MERCHANT')}&mc=0000&tr=TXN${Date.now()}&am=${formData.amount}&cu=INR&tn=${encodeURIComponent(noteContent)}`;

  return (
    <div className="app-root">
      <Navbar 
        currentView={currentView}
        onNavigate={(view) => {
          if (view === 'pay') {
            syncPayee();
          }
          setCurrentView(view);
        }}
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
                  
                  {/* Cloaked Receiver Header Pill */}
                  <div className="payee-profile-banner">
                    <div className="payee-avatar">
                      <IconShieldCheck size={22} className="text-emerald" />
                    </div>
                    <div className="payee-info">
                      <div className="payee-meta-line">
                        <span className="payee-label">VERIFIED CLOAK RECIPIENT</span>
                        <span className="cloaked-pill">
                          <IconLock size={10} />
                          CREDENTIALS SHIELDED
                        </span>
                      </div>
                      <div className="payee-title-line">
                        <span className="payee-name">{payee.displayName || 'Merchant'}</span>
                        <span className="payee-handle mono">@{payee.username}</span>
                      </div>
                      <span className="payee-privacy-note">
                        Direct peer-to-bank settlement · Personal bank details & VPA masked
                      </span>
                    </div>
                    <div className="payee-vpa-chip mono shielded" title="Actual receiving UPI ID is cloaked for privacy">
                      {maskVPA(payee.upiId)}
                    </div>
                  </div>

                  <div className="card-header-block">
                    <div className="header-meta-pill">
                      <IconShieldCheck size={14} className="text-emerald" />
                      <span>CLOAK PROTOCOL · ZERO-LEAK SETTLEMENT</span>
                    </div>
                    <h1 className="main-title">
                      Initiate Payment
                    </h1>
                  </div>

                  {/* Payer Privacy: Ghost Mode Toggle */}
                  <div className="ghost-mode-card">
                    <div className="ghost-info-col">
                      <div className="ghost-title-row">
                        <IconShieldCheck size={16} className="text-emerald" />
                        <span className="ghost-title">Ghost Mode (Zero-PII Checkout)</span>
                      </div>
                      <span className="ghost-desc">
                        Pay completely anonymously. Your phone number and email are not required.
                      </span>
                    </div>
                    <label className="ghost-toggle-switch" title="Toggle Anonymous Ghost Mode">
                      <input 
                        type="checkbox" 
                        checked={isGhostMode} 
                        onChange={(e) => {
                          const val = e.target.checked;
                          setIsGhostMode(val);
                          if (val) {
                            setFormData(prev => ({
                              ...prev,
                              name: 'Anonymous Payer',
                              phone: '9800000000',
                              email: 'ghost@cloak.internal'
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              name: '',
                              phone: '',
                              email: ''
                            }));
                          }
                        }} 
                      />
                      <span className="toggle-slider"></span>
                    </label>
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
                        <label htmlFor="amount" className="field-label">Transfer Amount (INR) *</label>
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

                    {/* Non-Ghost Payer Contact Fields (Only displayed if Ghost Mode is toggled off) */}
                    {!isGhostMode && (
                      <div className="payer-contact-fields fade-in">
                        <div className="form-row-2col">
                          <div className="form-group">
                            <label htmlFor="name" className="field-label">Payer Full Name *</label>
                            <input
                              type="text"
                              id="name"
                              name="name"
                              className="form-control"
                              placeholder="Enter your name"
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

                        <div className="form-group">
                          <label htmlFor="email" className="field-label">Email Address (For Tax Receipt) *</label>
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
                      </div>
                    )}

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
                      <span>{isSubmitting ? 'Securing Session...' : `Generate UPI QR · ₹${formData.amount ? Number(formData.amount).toLocaleString('en-IN') : '0.00'}`}</span>
                      <IconArrowRight size={18} />
                    </button>

                    <div className="guarantee-footer">
                      <IconShieldCheck size={15} className="text-emerald" />
                      <span>Zero-Knowledge Relay • Bilateral Privacy Protected</span>
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
                      Transferring via CLOAK Zero-Knowledge Switch to <strong>{payee.displayName || 'Merchant'}</strong>
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

                    {/* Cloaked VPA Endpoint Display (Raw UPI ID is masked from payer) */}
                    <div className="vpa-display-pill shielded-pill">
                      <div className="vpa-info">
                        <div className="vpa-label-row">
                          <IconShieldCheck size={14} className="text-emerald" />
                          <span className="vpa-label">CLOAK PROTECTED ENDPOINT</span>
                        </div>
                        <span className="vpa-address mono">{maskVPA(payee.upiId)}</span>
                      </div>
                      <button 
                        type="button" 
                        onClick={handleCopyShareLink} 
                        className="copy-pill-btn"
                        title="Copy Shielded Payment Link"
                      >
                        {isCopiedLink ? <IconCheck size={14} className="text-emerald" /> : <IconCopy size={14} />}
                        <span>{isCopiedLink ? 'Copied' : 'Copy Pay Link'}</span>
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
                        <strong>Bank Statement Reconciliation:</strong> Receiver will match your 12-digit UTR against their statement.
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
                <UserDashboard 
                  onLogout={handleAdminLogout} 
                  onProfileUpdate={handleProfileUpdate}
                  onPreviewPayment={handlePreviewPayment}
                />
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
