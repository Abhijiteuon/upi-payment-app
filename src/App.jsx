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
  IconSmartPhone,
  IconLock,
  IconQrCode
} from './components/Icons';
import './index.css';

const QUICK_AMOUNTS = ['100', '250', '500', '1000', '2000', '5000'];

function App() {
  // Views: 'pay', 'status', 'admin'
  // Default to 'admin' (Login Page) unless visiting a specific payment/status link
  const [currentView, setCurrentView] = useState(() => {
    if (typeof window === 'undefined') return 'admin';
    const params = new URLSearchParams(window.location.search);
    if (params.get('verify') || params.get('check')) return 'status';
    if (params.get('to') || params.get('payTo') || params.get('user')) return 'pay';
    const loggedIn = getAdminSession();
    if (loggedIn) return 'admin';
    return 'admin'; // Show Login Page first!
  });

  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => getAdminSession());
  const [activeProfileState, setActiveProfileState] = useState(() => getActiveProfile());
  const [activeVerificationId, setActiveVerificationId] = useState('');

  // Receiving Merchant / Payee Profile - starts with active profile or empty default
  const [payee, setPayee] = useState(() => {
    const activeProf = getActiveProfile();
    return (activeProf && activeProf.username) ? activeProf : DEFAULT_MERCHANT;
  });
  const [isPreSetAmount, setIsPreSetAmount] = useState(false);

  // Guest Checkout
  const [isGuestCheckout, setIsGuestCheckout] = useState(true);

  // Payment form state
  const [formData, setFormData] = useState({
    name: '',
    purpose: '',
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
  const [paymentMethodTab, setPaymentMethodTab] = useState('app'); // 'app' | 'qr'
  const [createdTransaction, setCreatedTransaction] = useState(null);
  const [isCopiedLink, setIsCopiedLink] = useState(false);
  const [isCopiedId, setIsCopiedId] = useState(false);
  const [isCopiedVpa, setIsCopiedVpa] = useState(false);
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

      // Default platform fallback: empty (no preset personal details)
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
      if (activeProf) {
        setActiveProfileState(activeProf);
        setPayee(activeProf);
      }
    }

    // Resolve Payee from URL or logged-in user
    syncPayee();

    // Check URL parameters
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
      } else if (params.get('to') || params.get('payTo') || params.get('user')) {
        setCurrentView('pay');
      } else if (!loggedIn) {
        // Enforce Login Page First when visiting directly without parameters
        setCurrentView('admin');
      }
    } catch (err) {
      console.warn('URL param parse notice:', err);
    }
  }, [syncPayee]);

  // Auto-logout: Inactivity timer (15 minutes) when merchant is logged in
  useEffect(() => {
    if (!isAdminLoggedIn) return;

    let timeoutId;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      sessionStorage.setItem('upi_session_timestamp', Date.now().toString());
      timeoutId = setTimeout(() => {
        handleAdminLogout();
      }, 15 * 60 * 1000); // 15 mins idle
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(evt => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const lastActive = sessionStorage.getItem('upi_session_timestamp');
        if (lastActive) {
          const diff = Date.now() - parseInt(lastActive, 10);
          if (diff > 15 * 60 * 1000) {
            handleAdminLogout();
          } else {
            sessionStorage.setItem('upi_session_timestamp', Date.now().toString());
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(timeoutId);
      events.forEach(evt => window.removeEventListener(evt, resetTimer));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAdminLoggedIn]);

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

  // Step 1 -> Step 2: Proceed to Pay
  const handleProceedToPay = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!payee || !payee.upiId) {
      setFormError('No recipient merchant found. Please open a valid payment link or sign in.');
      return;
    }

    const amountRes = validateAmount(formData.amount);
    if (!amountRes.valid) {
      setFormError(amountRes.error);
      return;
    }

    const purposeText = formData.purpose?.trim() || 'Payment';

    let finalName = formData.name?.trim() || 'Guest Payer';
    let finalEmail = formData.email?.trim() || 'guest@upipay.internal';
    let finalPhone = formData.phone?.trim() || '9800000000';

    if (!isGuestCheckout) {
      const cleanName = sanitizeText(formData.name, 80);
      if (!cleanName || cleanName.length < 2) {
        setFormError('Please enter your full name (minimum 2 characters).');
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
      purpose: purposeText,
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
      // On mobile, default to app; on desktop, default to QR
      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
      setPaymentMethodTab(isMobile ? 'app' : 'qr');
    } catch (err) {
      console.error('Payment registration error:', err);
      setFormError('Unable to start payment session. Please check your internet and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2 -> Step 3: User confirms payment made with UTR
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

  const handleCopyVpa = () => {
    if (!payee.upiId) return;
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
      purpose: '',
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
    if (!payee.upiId && !isAdminLoggedIn) {
      setCurrentView('admin');
    } else {
      setCurrentView('pay');
    }
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
    setCurrentView('admin');
  };

  const handleLoginSuccess = (profile) => {
    setIsAdminLoggedIn(true);
    setActiveProfileState(profile);
    setPayee(profile);
    setCurrentView('admin');
  };

  const handleProfileUpdate = (updatedProfile) => {
    setActiveProfileState(updatedProfile);
    setPayee(updatedProfile);
  };

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

  // Dynamic UPI URL pointing to receiver's configured UPI ID
  const upiLink = payee.upiId 
    ? `upi://pay?pa=${payee.upiId}&pn=${encodeURIComponent(payee.displayName || 'MERCHANT')}&mc=0000&tr=TXN${Date.now()}&am=${formData.amount}&cu=INR&tn=${encodeURIComponent(noteContent)}`
    : '';

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

      <div className="ambient-spotlight"></div>
      
      <main className="container">
        <div className={`glass-card ${currentView === 'admin' && isAdminLoggedIn ? 'admin-glass-card' : ''}`}>
          
          {/* VIEW: MAKE A PAYMENT */}
          {currentView === 'pay' && (
            <>
              {/* If no merchant is configured and not logged in, prompt user */}
              {!payee.upiId ? (
                <div className="fade-in no-payee-container text-center" style={{ padding: '2rem 1rem' }}>
                  <div className="status-notice-badge" style={{ marginBottom: '1.25rem' }}>
                    <IconLock size={36} className="text-emerald" />
                  </div>
                  <h2 className="main-title">No Merchant Selected</h2>
                  <p className="sub-title" style={{ maxWidth: 440, margin: '0.5rem auto 1.75rem', lineHeight: 1.5 }}>
                    To make a payment, please use a merchant's payment link (e.g. <code>?to=username</code>), or sign in to your merchant account to generate links.
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button 
                      type="button" 
                      className="primary-action-btn"
                      style={{ maxWidth: 220 }}
                      onClick={() => setCurrentView('admin')}
                    >
                      <span>Sign In to Account</span>
                      <IconArrowRight size={16} />
                    </button>
                    <button 
                      type="button" 
                      className="secondary-action-btn"
                      style={{ maxWidth: 220 }}
                      onClick={() => setCurrentView('status')}
                    >
                      <span>Track Payment Status</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Clean Step Indicator */}
                  <div className="stepper-bar">
                    <div className={`step-item ${paymentStep === 'form' ? 'active' : 'completed'}`}>
                      <div className="step-circle">
                        {paymentStep !== 'form' ? <IconCheck size={13} /> : '1'}
                      </div>
                      <span className="step-label">Amount</span>
                    </div>
                    <div className="step-connector"></div>
                    <div className={`step-item ${paymentStep === 'qr' ? 'active' : paymentStep === 'confirmed' ? 'completed' : ''}`}>
                      <div className="step-circle">
                        {paymentStep === 'confirmed' ? <IconCheck size={13} /> : '2'}
                      </div>
                      <span className="step-label">Pay</span>
                    </div>
                    <div className="step-connector"></div>
                    <div className={`step-item ${paymentStep === 'confirmed' ? 'active' : ''}`}>
                      <div className="step-circle">3</div>
                      <span className="step-label">Receipt</span>
                    </div>
                  </div>

                  {/* STEP 1: PAYMENT FORM */}
                  {paymentStep === 'form' && (
                    <div className="fade-in form-view-container">
                      
                      {/* Clean Recipient Banner */}
                      <div className="payee-profile-banner">
                        <div className="payee-avatar">
                          <span className="payee-initial">
                            {(payee.displayName || payee.username || 'M').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="payee-info">
                          <div className="payee-meta-line">
                            <span className="payee-verified-tag">
                              <IconCheck size={11} /> Verified Payee
                            </span>
                            <span className="cloaked-pill">
                              <IconLock size={10} /> Secure UPI
                            </span>
                          </div>
                          <div className="payee-title-line">
                            <span className="payee-name">{payee.displayName || 'Merchant'}</span>
                            <span className="payee-handle mono">@{payee.username}</span>
                          </div>
                          <span className="payee-privacy-note">
                            Direct bank-to-bank transfer via UPI
                          </span>
                        </div>
                        <div className="payee-vpa-chip mono" title="Verified Receiving UPI">
                          {maskVPA(payee.upiId)}
                        </div>
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
                        
                        {/* Big Touch-Friendly Amount Field */}
                        <div className="form-group amount-group">
                          <label htmlFor="amount" className="field-label">Enter Amount to Pay</label>
                          <div className="amount-input-box">
                            <span className="currency-symbol">₹</span>
                            <input
                              type="number"
                              id="amount"
                              name="amount"
                              className="amount-input"
                              placeholder="0"
                              min="1"
                              max="100000"
                              step="any"
                              inputMode="decimal"
                              value={formData.amount}
                              onChange={handleChange}
                              required
                              autoFocus={!isPreSetAmount}
                            />
                          </div>

                          {/* Quick Amount Chips */}
                          <div className="quick-amount-row">
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

                        {/* Note / Purpose Field */}
                        <div className="form-group">
                          <label htmlFor="purpose" className="field-label">Add a Note (Optional)</label>
                          <input
                            type="text"
                            id="purpose"
                            name="purpose"
                            className="form-control"
                            placeholder="e.g. Dinner, Rent, Freelance work"
                            value={formData.purpose}
                            onChange={handleChange}
                            maxLength={80}
                          />
                        </div>

                        {/* Fast Guest Checkout Toggle */}
                        <div className="guest-mode-card">
                          <div className="guest-info-col">
                            <div className="guest-title-row">
                              <IconShieldCheck size={16} className="text-emerald" />
                              <span className="guest-title">Fast Guest Checkout</span>
                            </div>
                            <span className="guest-desc">
                              Pay directly without entering personal contact info.
                            </span>
                          </div>
                          <label className="ghost-toggle-switch" title="Toggle Guest Mode">
                            <input 
                              type="checkbox" 
                              checked={isGuestCheckout} 
                              onChange={(e) => {
                                const val = e.target.checked;
                                setIsGuestCheckout(val);
                                if (!val) {
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

                        {/* Optional Contact Fields (Only if Guest Checkout is unchecked) */}
                        {!isGuestCheckout && (
                          <div className="payer-contact-fields fade-in">
                            <div className="form-group">
                              <label htmlFor="name" className="field-label">Your Name *</label>
                              <input
                                type="text"
                                id="name"
                                name="name"
                                className="form-control"
                                placeholder="Enter your full name"
                                value={formData.name}
                                onChange={handleChange}
                                maxLength={80}
                                required
                              />
                            </div>

                            <div className="form-row-2col">
                              <div className="form-group">
                                <label htmlFor="phone" className="field-label">Mobile Number *</label>
                                <input
                                  type="tel"
                                  id="phone"
                                  name="phone"
                                  className="form-control mono"
                                  placeholder="10-digit mobile"
                                  inputMode="numeric"
                                  value={formData.phone}
                                  onChange={handleChange}
                                  maxLength={15}
                                  required
                                />
                              </div>

                              <div className="form-group">
                                <label htmlFor="email" className="field-label">Email (For Receipt) *</label>
                                <input
                                  type="email"
                                  id="email"
                                  name="email"
                                  className="form-control"
                                  placeholder="name@email.com"
                                  value={formData.email}
                                  onChange={handleChange}
                                  required
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Submit Button */}
                        <button type="submit" className="primary-action-btn" disabled={isSubmitting}>
                          <span>{isSubmitting ? 'Starting...' : `Proceed to Pay · ₹${formData.amount ? Number(formData.amount).toLocaleString('en-IN') : '0'}`}</span>
                          <IconArrowRight size={18} />
                        </button>

                        <div className="guarantee-footer">
                          <IconShieldCheck size={15} className="text-emerald" />
                          <span>100% Direct UPI Settlement • Zero Extra Fees</span>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* STEP 2: UPI PAYMENT & UTR CONFIRMATION */}
                  {paymentStep === 'qr' && (
                    <div className="fade-in qr-view-container">
                      <div className="card-header-block text-center">
                        <div className="header-meta-pill">
                          <IconCheck size={13} className="text-emerald" />
                          <span>READY TO PAY</span>
                        </div>
                        <h2 className="main-title">
                          Pay ₹{Number(formData.amount).toLocaleString('en-IN')}
                        </h2>
                        <p className="sub-title">
                          Transferring to <strong>{payee.displayName || 'Merchant'}</strong>
                        </p>
                      </div>

                      {/* Android-Optimized Mode Switcher: App vs QR */}
                      <div className="pay-mode-switcher">
                        <button 
                          type="button" 
                          className={`pay-mode-tab ${paymentMethodTab === 'app' ? 'active' : ''}`}
                          onClick={() => setPaymentMethodTab('app')}
                        >
                          <IconSmartPhone size={16} />
                          <span>Pay via App</span>
                        </button>
                        <button 
                          type="button" 
                          className={`pay-mode-tab ${paymentMethodTab === 'qr' ? 'active' : ''}`}
                          onClick={() => setPaymentMethodTab('qr')}
                        >
                          <IconQrCode size={16} />
                          <span>Scan QR Code</span>
                        </button>
                      </div>

                      {/* TAB 1: ONE-TAP ANDROID UPI PAY */}
                      {paymentMethodTab === 'app' && (
                        <div className="android-app-pay-card fade-in">
                          <div className="app-pay-intro">
                            <span className="app-pay-badge">FASTEST ON MOBILE</span>
                            <p className="app-pay-text">
                              Tap below to open your installed UPI app with the amount and payee pre-filled.
                            </p>
                          </div>

                          {/* Primary Android One-Tap Action */}
                          <a 
                            href={upiLink} 
                            className="android-primary-pay-btn"
                          >
                            <IconSmartPhone size={22} />
                            <span>Pay with Any UPI App</span>
                            <IconArrowRight size={18} />
                          </a>

                          {/* Popular UPI App Shortcuts */}
                          <div className="upi-apps-grid">
                            <a href={upiLink} className="upi-app-button gpay-btn" title="Open Google Pay">
                              <span className="upi-app-name">Google Pay</span>
                            </a>
                            <a href={upiLink} className="upi-app-button phonepe-btn" title="Open PhonePe">
                              <span className="upi-app-name">PhonePe</span>
                            </a>
                            <a href={upiLink} className="upi-app-button paytm-btn" title="Open Paytm">
                              <span className="upi-app-name">Paytm</span>
                            </a>
                            <a href={upiLink} className="upi-app-button bhim-btn" title="Open BHIM">
                              <span className="upi-app-name">BHIM / Other</span>
                            </a>
                          </div>

                          {/* Manual UPI Copy Option */}
                          <div className="manual-upi-copy-box">
                            <div className="manual-upi-info">
                              <span className="manual-upi-label">Receiving UPI ID</span>
                              <span className="manual-upi-val mono">{payee.upiId}</span>
                            </div>
                            <button 
                              type="button" 
                              onClick={handleCopyVpa}
                              className="copy-pill-btn"
                            >
                              {isCopiedVpa ? <IconCheck size={14} className="text-emerald" /> : <IconCopy size={14} />}
                              <span>{isCopiedVpa ? 'Copied' : 'Copy UPI ID'}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* TAB 2: QR CODE (FOR SECOND PHONE OR DESKTOP) */}
                      {paymentMethodTab === 'qr' && (
                        <div className="qr-terminal-card fade-in">
                          <div className="qr-instruction-header">
                            <span>Scan with any UPI app on another phone</span>
                          </div>

                          <div className="qr-terminal-frame">
                            <QRCodeSVG 
                              value={upiLink} 
                              size={190}
                              level="H"
                              includeMargin={false}
                              className="rendered-qr-svg"
                            />
                          </div>

                          <div className="vpa-display-pill">
                            <div className="vpa-info">
                              <span className="vpa-label">UPI ID:</span>
                              <span className="vpa-address mono">{payee.upiId}</span>
                            </div>
                            <button 
                              type="button" 
                              onClick={handleCopyShareLink} 
                              className="copy-pill-btn"
                              title="Copy Payment Link"
                            >
                              {isCopiedLink ? <IconCheck size={14} className="text-emerald" /> : <IconCopy size={14} />}
                              <span>{isCopiedLink ? 'Copied' : 'Copy Link'}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* UTR / Reference Capture Section */}
                      <div className="utr-capture-card">
                        <div className="utr-label-row">
                          <label htmlFor="utr" className="utr-main-label">
                            Enter 12-Digit Reference Number (UTR)
                          </label>
                        </div>
                        <p className="utr-instruction-text">
                          After completing the payment in your UPI app, enter the 12-digit UTR or Reference ID from your payment receipt:
                        </p>

                        <div className="utr-input-wrapper">
                          <input
                            type="text"
                            id="utr"
                            name="utr"
                            className="form-control mono utr-field-control"
                            placeholder="e.g. 410293847561"
                            maxLength={12}
                            inputMode="numeric"
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
                          <span>{isSubmitting ? 'Confirming...' : 'I Have Paid — Confirm Payment'}</span>
                          <IconCheck size={18} />
                        </button>

                        <button 
                          onClick={() => setPaymentStep('form')} 
                          className="ghost-back-btn"
                        >
                          <IconArrowLeft size={16} />
                          <span>Change Amount</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: PAYMENT SUBMITTED */}
                  {paymentStep === 'confirmed' && createdTransaction && (
                    <div className="fade-in confirmed-view-container">
                      <div className="status-success-circle">
                        <IconCheck size={36} className="text-white" />
                      </div>

                      <h2 className="main-title text-center">
                        Payment Submitted!
                      </h2>
                      <p className="sub-title text-center">
                        Your payment details have been recorded. Track your status or view your receipt below.
                      </p>

                      <div className="verification-code-card">
                        <span className="ver-card-subtitle">YOUR REFERENCE ID</span>
                        <div className="ver-card-number">{createdTransaction.verificationId}</div>
                        <button 
                          onClick={handleCopyVerificationId}
                          className="copy-ver-id-btn"
                        >
                          {isCopiedId ? <IconCheck size={15} className="text-emerald" /> : <IconCopy size={15} />}
                          <span>{isCopiedId ? 'ID Copied!' : 'Copy Reference ID'}</span>
                        </button>
                      </div>

                      <div className="simple-summary-card">
                        <div className="summary-row">
                          <span>Amount:</span>
                          <strong className="text-emerald">₹{Number(formData.amount).toLocaleString('en-IN')}</strong>
                        </div>
                        <div className="summary-row">
                          <span>Recipient:</span>
                          <strong>{payee.displayName}</strong>
                        </div>
                        {formData.utr && (
                          <div className="summary-row">
                            <span>Submitted UTR:</span>
                            <strong className="mono">{formData.utr}</strong>
                          </div>
                        )}
                      </div>

                      <div className="confirmation-cta-actions">
                        <button 
                          onClick={handleTrackCreatedPayment}
                          className="primary-action-btn"
                        >
                          <span>Track Status & View Receipt</span>
                          <IconArrowRight size={17} />
                        </button>
                        
                        <button 
                          onClick={handleResetToPay}
                          className="ghost-back-btn"
                        >
                          <span>Make Another Payment</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
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
                  onCancel={() => setCurrentView('status')}
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
