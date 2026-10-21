import { supabase } from './supabaseClient.js';

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

// Transform DB row (snake_case) to client transaction object (camelCase)
export const toClientTx = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    verificationId: row.verification_id,
    name: row.name || 'Anonymous',
    email: row.email || '',
    phone: row.phone || '',
    purpose: row.purpose || 'UPI Payment',
    source: row.source || 'Individual',
    amount: row.amount !== null && row.amount !== undefined ? String(row.amount) : '0.00',
    utr: row.utr || '',
    status: row.status || 'pending',
    notes: row.notes || '',
    createdAt: row.created_at || new Date().toISOString(),
    verifiedAt: row.verified_at || null
  };
};

// Initial Seed Data for first run or offline fallback
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

// LocalStorage helpers for offline persistence / speed
export const getTransactions = () => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return INITIAL_TRANSACTIONS;
    }
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
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    }
  } catch (err) {
    console.error('Error saving transactions to localStorage', err);
  }
};

// =========================================================================
// SUPABASE OPERATIONS
// =========================================================================

// Fetch all transactions from Supabase (for Admin Dashboard)
export const fetchRemoteTransactions = async () => {
  const localList = getTransactions();
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetch error, using local fallback:', error.message);
      return { success: false, source: 'local', transactions: localList };
    }

    if (Array.isArray(data)) {
      const clientTxs = data.map(toClientTx);
      saveTransactions(clientTxs);
      return { success: true, source: 'supabase', transactions: clientTxs };
    }
  } catch (err) {
    console.warn('Network error querying Supabase:', err);
  }

  return { success: false, source: 'local', transactions: localList };
};

// Add new transaction to Supabase
export const addTransaction = async (formData) => {
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

  // Immediate local cache update
  saveTransactions([newTx, ...localList]);

  // Insert into Supabase
  try {
    const { data, error } = await supabase
      .from('transactions')
      .insert([
        {
          verification_id: verificationId,
          name: newTx.name,
          email: newTx.email,
          phone: newTx.phone,
          purpose: newTx.purpose,
          source: newTx.source,
          amount: parseFloat(newTx.amount) || 0,
          utr: newTx.utr || null,
          status: 'pending',
          notes: ''
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error inserting transaction into Supabase:', error);
    } else if (data) {
      const inserted = toClientTx(data);
      return inserted;
    }
  } catch (err) {
    console.error('Failed to sync new transaction to Supabase:', err);
  }

  return newTx;
};

// Fetch single transaction by Verification ID
export const fetchRemoteStatusById = async (verificationId) => {
  const query = (verificationId || '').trim().toUpperCase();
  if (!query) return null;

  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('verification_id', query)
      .maybeSingle();

    if (!error && data) {
      const clientTx = toClientTx(data);
      // Update local copy
      const localList = getTransactions();
      const existingIdx = localList.findIndex(t => t.verificationId === query);
      if (existingIdx >= 0) {
        localList[existingIdx] = clientTx;
      } else {
        localList.unshift(clientTx);
      }
      saveTransactions(localList);
      return clientTx;
    }
  } catch (err) {
    console.warn('Supabase fetchRemoteStatusById error:', err);
  }

  // Fallback to local cache
  const local = getTransactions();
  return local.find(t => (t.verificationId || '').trim().toUpperCase() === query) || null;
};

// Update status and/or UTR in Supabase
export const updateRemoteStatus = async (verificationId, status, notes = '', utr = '') => {
  const query = (verificationId || '').trim().toUpperCase();
  const localList = getTransactions();

  const updateFields = {
    status,
    notes: notes !== undefined ? notes : ''
  };

  if (status === 'successful') {
    updateFields.verified_at = new Date().toISOString();
  } else if (status === 'pending') {
    updateFields.verified_at = null;
  }

  if (utr) {
    updateFields.utr = utr;
  }

  // 1. Optimistic local update
  const updatedLocal = localList.map(t => {
    if ((t.verificationId || '').trim().toUpperCase() === query) {
      return {
        ...t,
        status,
        notes: notes !== undefined && notes !== '' ? notes : t.notes,
        utr: utr || t.utr,
        verifiedAt: updateFields.verified_at !== undefined ? updateFields.verified_at : t.verifiedAt
      };
    }
    return t;
  });
  saveTransactions(updatedLocal);

  // 2. Sync to Supabase
  try {
    const { data, error } = await supabase
      .from('transactions')
      .update(updateFields)
      .eq('verification_id', query)
      .select();

    if (error) {
      console.error('Error updating transaction in Supabase:', error);
    } else if (data && data.length > 0) {
      const updatedTxs = await fetchRemoteTransactions();
      return { success: true, transactions: updatedTxs.transactions };
    }
  } catch (err) {
    console.error('Supabase updateRemoteStatus error:', err);
  }

  return { success: true, transactions: updatedLocal };
};

export const updateTransactionStatus = updateRemoteStatus;

// Delete transaction
export const deleteTransaction = async (verificationId) => {
  const query = (verificationId || '').trim().toUpperCase();
  const localList = getTransactions();
  const filtered = localList.filter(t => (t.verificationId || '').trim().toUpperCase() !== query);
  saveTransactions(filtered);

  try {
    await supabase.from('transactions').delete().eq('verification_id', query);
  } catch (err) {
    console.error('Error deleting from Supabase:', err);
  }

  return filtered;
};

// =========================================================================
// REALTIME SUBSCRIPTIONS
// =========================================================================

// Listen to changes for a specific Verification ID (used in StatusCheck screen)
export const subscribeToTransaction = (verificationId, onUpdate) => {
  if (!verificationId) return () => {};
  const query = verificationId.trim().toUpperCase();

  const channel = supabase
    .channel(`tx_${query}_${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'transactions',
        filter: `verification_id=eq.${query}`
      },
      (payload) => {
        if (payload && payload.new) {
          const clientTx = toClientTx(payload.new);
          onUpdate(clientTx);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// Listen to all transaction changes (used in AdminDashboard)
export const subscribeToAllTransactions = (onChange) => {
  const channel = supabase
    .channel(`admin_all_${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'transactions'
      },
      () => {
        onChange();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
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
