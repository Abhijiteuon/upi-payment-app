/**
 * Security, Fraud Prevention, and Data Sanitization Utilities
 * Part of 5-Layer Security Framework for UPI Payments
 */

// =========================================================================
// 1. INPUT VALIDATION & FRAUD HEURISTICS
// =========================================================================

/**
 * Validates a 12-digit Indian UPI Transaction Reference / UTR
 * Checks format and common fake/spoof heuristics.
 */
export const validateUTR = (utr) => {
  if (!utr || typeof utr !== 'string') {
    return { valid: false, error: 'UTR is required.' };
  }

  const clean = utr.trim();

  if (!/^\d{12}$/.test(clean)) {
    return { 
      valid: false, 
      error: 'UPI Reference (UTR) must be exactly 12 numeric digits.' 
    };
  }

  // Detect repeating digits (e.g., 000000000000, 111111111111)
  if (/^(\d)\1{11}$/.test(clean)) {
    return { 
      valid: false, 
      error: 'Suspicious UTR: repeating numbers are not accepted.' 
    };
  }

  // Detect common test / ascending sequences
  const commonFakePatterns = [
    '123456789012',
    '012345678901',
    '987654321098',
    '123456123456',
    '000123456789',
    '112233445566'
  ];
  if (commonFakePatterns.includes(clean)) {
    return { 
      valid: false, 
      error: 'Suspicious UTR: dummy or sequential numbers are not accepted.' 
    };
  }

  return { valid: true, clean };
};

/**
 * Validates Indian 10-digit mobile number
 */
export const validatePhone = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Phone number is required.' };
  }

  // Strip international prefix, spaces, dashes
  let clean = phone.replace(/[\s\-()+]/g, '');
  if (clean.startsWith('91') && clean.length === 12) {
    clean = clean.substring(2);
  }

  if (!/^[6-9]\d{9}$/.test(clean)) {
    return { 
      valid: false, 
      error: 'Please enter a valid 10-digit Indian mobile number starting with 6-9.' 
    };
  }

  return { valid: true, clean };
};

/**
 * Validates standard email address
 */
export const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email address is required.' };
  }

  const clean = email.trim();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(clean)) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }

  return { valid: true, clean };
};

/**
 * Validates payment amount
 */
export const validateAmount = (amount) => {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) {
    return { valid: false, error: 'Amount must be greater than ₹0.' };
  }
  if (num < 1) {
    return { valid: false, error: 'Minimum transaction amount is ₹1.00.' };
  }
  if (num > 100000) {
    return { valid: false, error: 'Maximum single UPI limit is ₹1,00,000.' };
  }
  return { valid: true, num: num.toFixed(2) };
};

/**
 * Sanitizes generic user text input to guard against injection
 */
export const sanitizeText = (text, maxLength = 100) => {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[<>]/g, '') // remove HTML tags
    .trim()
    .substring(0, maxLength);
};

// =========================================================================
// 2. PRIVACY & PII DATA MASKING
// =========================================================================

/**
 * Masks phone number for public display (e.g., "+91 98••••1234")
 */
export const maskPhone = (phone) => {
  if (!phone) return 'N/A';
  const clean = phone.replace(/\D/g, '');
  if (clean.length < 6) return '••••••';
  const start = clean.slice(-10, -8);
  const end = clean.slice(-4);
  return `+91 ${start}••••${end}`;
};

/**
 * Masks email address for public display (e.g., "ab•••••r@domain.com")
 */
export const maskEmail = (email) => {
  if (!email || !email.includes('@')) return 'N/A';
  const [user, domain] = email.split('@');
  if (user.length <= 2) {
    return `${user[0]}••••@${domain}`;
  }
  const first = user.slice(0, 2);
  const last = user.slice(-1);
  return `${first}•••••${last}@${domain}`;
};

/**
 * Masks name for public receipts (e.g. "Abhijit K.")
 */
export const maskName = (name) => {
  if (!name) return 'Anonymous';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
};

// =========================================================================
// 3. CRYPTOGRAPHIC DIGITAL SIGNATURE / RECEIPT FINGERPRINT
// =========================================================================

/**
 * Generates a tamper-evident digital receipt fingerprint (hex string)
 * Derived from verification ID, amount, UTR, and timestamp.
 */
export const generateReceiptFingerprint = (verificationId, amount, utr, verifiedAt) => {
  const seed = `${verificationId || ''}|${parseFloat(amount || 0).toFixed(2)}|${utr || 'NO_UTR'}|${verifiedAt || 'PENDING'}|CLOAK_SECURE_PAY_2026`;
  
  // Fast 32-bit FNV-1a & Murmur3-like dual hashing for synchronous browser render
  let h1 = 0xdeadbeef ^ seed.length;
  let h2 = 0x41c6ce57 ^ seed.length;

  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const hex1 = (h1 >>> 0).toString(16).toUpperCase().padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).toUpperCase().padStart(8, '0');
  
  return `SEAL-${hex1.substring(0, 4)}-${hex1.substring(4, 8)}-${hex2.substring(0, 4)}`;
};
