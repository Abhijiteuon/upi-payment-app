const STORAGE_KEY = 'upi_payment_transactions';
const ADMIN_SESSION_KEY = 'upi_admin_session';
const APPS_SCRIPT_URL_KEY = 'upi_apps_script_url';

// Primary Automated Cloud Database Store for Cross-Device Synchronization
const CLOUD_STORE_ID = 'ff808181a09d98f701a117f4495e19a8';
const CLOUD_API_URL = `https://api.restful-api.dev/objects/${CLOUD_STORE_ID}`;

export const getAppsScriptUrl = () => {
  return localStorage.getItem(APPS_SCRIPT_URL_KEY) || '';
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

// Initial Seed Data
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

// =========================================================================
// AUTOMATED CLOUD SYNC ENGINE (CROSS-DEVICE REAL-TIME)
// =========================================================================

// Sync helper to save array to Cloud Database
const syncToCloud = async (transactions) => {
  try {
    const res = await fetch(CLOUD_API_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'ABHIJIT_UPI_TRANSACTIONS_STORE',
        data: {
          transactions,
          lastUpdated: new Date().toISOString()
        }
      })
    });
    return res.ok;
  } catch (err) {
    console.warn('Cloud sync background warning:', err);
    return false;
  }
};

export const fetchRemoteTransactions = async () => {
  // 1. Try Custom Google Apps Script if user configured one
  const scriptUrl = getAppsScriptUrl();
  if (scriptUrl) {
    try {
      const res = await fetch(`${scriptUrl}?action=getTransactions&t=${Date.now()}`);
      const data = await res.json();
      if (data && data.success && Array.isArray(data.transactions)) {
        saveTransactions(data.transactions);
        return { success: true, source: 'apps_script', transactions: data.transactions };
      }
    } catch (err) {
      console.warn('Google Apps script fetch error, falling back to cloud sync', err);
    }
  }

  // 2. Fetch from Automated Cloud Database
  try {
    const res = await fetch(`${CLOUD_API_URL}?t=${Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.data && Array.isArray(data.data.transactions)) {
        const cloudList = data.data.transactions;
        saveTransactions(cloudList);
        return { success: true, source: 'cloud_db', transactions: cloudList };
      }
    }
  } catch (err) {
    console.warn('Cloud DB fetch error', err);
  }

  return { success: false, source: 'local', transactions: getTransactions() };
};

export const addTransaction = (formData) => {
  const localList = getTransactions();
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

  const updated = [newTx, ...localList];
  saveTransactions(updated);

  // Asynchronously push to Cloud Database so Admin instantly sees it
  (async () => {
    try {
      // Pull latest first to avoid overwriting concurrent transactions
      const res = await fetch(`${CLOUD_API_URL}?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        const existing = (data && data.data && Array.isArray(data.data.transactions)) ? data.data.transactions : [];
        const merged = [newTx, ...existing.filter(e => e.verificationId !== newTx.verificationId)];
        await syncToCloud(merged);
        saveTransactions(merged);
      } else {
        await syncToCloud(updated);
      }
    } catch (err) {
      console.warn('Background addTransaction cloud sync error', err);
      syncToCloud(updated);
    }
  })();

  return newTx;
};

export const getTransactionById = (verificationId) => {
  if (!verificationId) return null;
  const transactions = getTransactions();
  const query = verificationId.trim().toUpperCase();
  return transactions.find(t => (t.verificationId || '').toUpperCase() === query) || null;
};

export const fetchRemoteStatusById = async (verificationId) => {
  const query = (verificationId || '').trim().toUpperCase();
  if (!query) return null;

  // Query live cloud transactions
  const result = await fetchRemoteTransactions();
  if (result && Array.isArray(result.transactions)) {
    const match = result.transactions.find(t => (t.verificationId || '').toUpperCase() === query);
    if (match) return match;
  }

  return getTransactionById(query);
};

export const updateRemoteStatus = async (verificationId, status, notes = '') => {
  const localList = getTransactions();
  const query = (verificationId || '').trim().toUpperCase();

  const updated = localList.map(t => {
    if ((t.verificationId || '').toUpperCase() === query) {
      return {
        ...t,
        status,
        verifiedAt: status !== 'pending' ? new Date().toISOString() : null,
        notes: notes !== undefined ? notes : t.notes
      };
    }
    return t;
  });

  saveTransactions(updated);

  // Sync to Cloud Store
  await syncToCloud(updated);

  // Also sync to Apps Script if configured
  const scriptUrl = getAppsScriptUrl();
  if (scriptUrl) {
    try {
      fetch(scriptUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'updateStatus', verificationId: query, status, notes })
      }).catch(e => console.warn('Apps script post warning', e));
    } catch (e) {
      console.warn('Apps script post error', e);
    }
  }

  return { success: true, transactions: updated };
};

export const updateTransactionStatus = updateRemoteStatus;

export const deleteTransaction = (verificationId) => {
  const query = (verificationId || '').trim().toUpperCase();
  const transactions = getTransactions();
  const updated = transactions.filter(t => (t.verificationId || '').toUpperCase() !== query);
  saveTransactions(updated);
  syncToCloud(updated);
  return updated;
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
