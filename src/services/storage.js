const STORAGE_KEY = 'upi_payment_transactions';
const ADMIN_SESSION_KEY = 'upi_admin_session';
const APPS_SCRIPT_URL_KEY = 'upi_apps_script_url';

// Default Apps Script URL placeholder (can be updated by Admin in the dashboard)
const DEFAULT_APPS_SCRIPT_URL = '';

export const getAppsScriptUrl = () => {
  return localStorage.getItem(APPS_SCRIPT_URL_KEY) || DEFAULT_APPS_SCRIPT_URL;
};

export const setAppsScriptUrl = (url) => {
  localStorage.setItem(APPS_SCRIPT_URL_KEY, (url || '').trim());
};

// Helper to generate a unique Verification ID (e.g., VER-8F2K9M)
export const generateVerificationId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'VER-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Default seed data for initial testing if storage is empty
const INITIAL_TRANSACTIONS = [
  {
    verificationId: 'VER-SAMPLE1',
    name: 'Rahul Sharma',
    email: 'rahul.sharma@example.com',
    phone: '9876543210',
    purpose: 'Freelance project completion Payment',
    source: 'Individual',
    amount: '2500.00',
    utr: '410293847561',
    status: 'successful',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    verifiedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    notes: 'Verified via ICICI statement'
  }
];

export const getTransactions = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_TRANSACTIONS));
      return INITIAL_TRANSACTIONS;
    }
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading transactions from localStorage', err);
    return INITIAL_TRANSACTIONS;
  }
};

export const saveTransactions = (transactions) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (err) {
    console.error('Error saving transactions to localStorage', err);
  }
};

export const addTransaction = (formData) => {
  const transactions = getTransactions();
  const verificationId = generateVerificationId();
  const newTx = {
    verificationId,
    name: formData.name || '',
    email: formData.email || '',
    phone: formData.phone || '',
    purpose: formData.purpose || '',
    source: formData.source || '',
    amount: formData.amount || '0.00',
    utr: formData.utr || '',
    status: 'pending',
    createdAt: new Date().toISOString(),
    verifiedAt: null,
    notes: ''
  };

  const updated = [newTx, ...transactions];
  saveTransactions(updated);
  return newTx;
};

export const getTransactionById = (verificationId) => {
  if (!verificationId) return null;
  const transactions = getTransactions();
  const query = verificationId.trim().toUpperCase();
  return transactions.find(t => t.verificationId.toUpperCase() === query) || null;
};

export const updateTransactionStatus = (verificationId, status, notes = '') => {
  const transactions = getTransactions();
  const updated = transactions.map(t => {
    if (t.verificationId.toUpperCase() === verificationId.toUpperCase()) {
      return {
        ...t,
        status,
        verifiedAt: status !== 'pending' ? new Date().toISOString() : null,
        notes: notes || t.notes
      };
    }
    return t;
  });
  saveTransactions(updated);
  return updated;
};

export const deleteTransaction = (verificationId) => {
  const transactions = getTransactions();
  const updated = transactions.filter(t => t.verificationId.toUpperCase() !== verificationId.toUpperCase());
  saveTransactions(updated);
  return updated;
};

// =========================================================================
// LIVE GOOGLE APPS SCRIPT / SHEETS SYNC
// =========================================================================

export const fetchRemoteTransactions = async () => {
  const scriptUrl = getAppsScriptUrl();
  if (!scriptUrl) {
    return { success: false, error: 'NO_URL', transactions: getTransactions() };
  }

  try {
    const res = await fetch(`${scriptUrl}?action=getTransactions&t=${Date.now()}`);
    const data = await res.json();
    if (data && data.success && Array.isArray(data.transactions)) {
      // Merge remote with local transactions (remote takes precedence)
      const remoteTxs = data.transactions;
      saveTransactions(remoteTxs);
      return { success: true, transactions: remoteTxs };
    }
    return { success: false, error: 'INVALID_DATA', transactions: getTransactions() };
  } catch (err) {
    console.error('Error fetching remote transactions from Google Sheet', err);
    return { success: false, error: err.message, transactions: getTransactions() };
  }
};

export const fetchRemoteStatusById = async (verificationId) => {
  const scriptUrl = getAppsScriptUrl();
  const query = (verificationId || '').trim().toUpperCase();
  
  if (!scriptUrl) {
    return getTransactionById(query);
  }

  try {
    const res = await fetch(`${scriptUrl}?action=getTransactions&t=${Date.now()}`);
    const data = await res.json();
    if (data && data.success && Array.isArray(data.transactions)) {
      const match = data.transactions.find(t => (t.verificationId || '').toUpperCase() === query);
      if (match) {
        // Update local cache
        const local = getTransactions();
        const existingIdx = local.findIndex(l => (l.verificationId || '').toUpperCase() === query);
        if (existingIdx !== -1) {
          local[existingIdx] = match;
        } else {
          local.unshift(match);
        }
        saveTransactions(local);
        return match;
      }
    }
    return getTransactionById(query);
  } catch (err) {
    console.error('Error querying live status from Google Sheet', err);
    return getTransactionById(query);
  }
};

export const updateRemoteStatus = async (verificationId, status, notes = '') => {
  // Update local immediately for instant UI responsiveness
  const localUpdated = updateTransactionStatus(verificationId, status, notes);

  const scriptUrl = getAppsScriptUrl();
  if (!scriptUrl) {
    return { success: true, localOnly: true, transactions: localUpdated };
  }

  try {
    const res = await fetch(scriptUrl, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action: 'updateStatus',
        verificationId,
        status,
        notes
      })
    });
    const data = await res.json();
    return { success: data.success, transactions: localUpdated };
  } catch (err) {
    console.error('Error updating status on Google Sheet', err);
    return { success: false, error: err.message, transactions: localUpdated };
  }
};

// =========================================================================
// ADMIN AUTHENTICATION
// =========================================================================

export const validateAdminCredentials = (name, nickname, password) => {
  const cleanName = (name || '').trim().toLowerCase();
  const cleanNickname = (nickname || '').trim().toLowerCase();
  const cleanPassword = (password || '').trim();

  const isNameValid = cleanName === 'abhijit';
  const isNicknameValid = cleanNickname === 'gopu';
  const isPasswordValid = cleanPassword === 'Arya@2709';

  return isNameValid && isNicknameValid && isPasswordValid;
};

export const setAdminSession = (isValid) => {
  if (isValid) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
  } else {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
  }
};

export const getAdminSession = () => {
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
};
