const STORAGE_KEY = 'upi_payment_transactions';
const ADMIN_SESSION_KEY = 'upi_admin_session';

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
    status: 'successful', // 'pending' | 'successful' | 'failed'
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(), // 1 day ago
    verifiedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    notes: 'Verified via ICICI statement'
  },
  {
    verificationId: 'VER-SAMPLE2',
    name: 'Priya Verma',
    email: 'priya.v@example.com',
    phone: '9812345678',
    purpose: 'Education-venture payment',
    source: 'Private',
    amount: '1200.00',
    utr: '419827364510',
    status: 'pending',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(), // 4 hours ago
    verifiedAt: null,
    notes: ''
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
    status: 'pending', // Pending by default
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

// Admin authentication verification
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
