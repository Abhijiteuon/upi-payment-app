import { supabase } from './supabaseClient.js';

const STORAGE_KEY = 'upi_payment_transactions';
const ADMIN_SESSION_KEY = 'upi_admin_session';

// Google Form & Google Sheet Endpoints for dual-backup
export const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSe6ijmXl90ufpUplEoEWZj8uL92_jHt-w6kJANlf18dCTgzhA/formResponse';
export const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1zfpeMPKzwkTGeGsGRI69ya6NW6y_N7NFsa3QQY1XIh8/edit?gid=450698937';

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

// Initial Seed Data for first run or offline fallback (Clean slate by default)
const INITIAL_TRANSACTIONS = [];

// LocalStorage helpers with safe browser environment guards
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
// GOOGLE FORMS DUAL-SYNC (Ensures Google Sheet receives every submission)
// =========================================================================

export const submitToGoogleForm = async (txData, statusOverride = null) => {
  if (!txData) return false;
  try {
    const data = new URLSearchParams();
    data.append("entry.1903499638", txData.name || '');
    data.append("entry.1388882637", txData.purpose || '');
    data.append("entry.635018705", txData.source || '');
    data.append("entry.794330962", String(txData.amount || '0.00'));
    data.append("entry.1805777836", txData.phone || '');
    data.append("entry.225713530", txData.email || '');
    data.append("entry.1730640862", txData.utr || '');
    data.append("entry.1090650382", txData.verificationId || '');

    const effectiveStatus = (statusOverride || txData.status || 'pending').toLowerCase();
    if (effectiveStatus.includes('success')) {
      data.append("entry.291880096", "Successful");
    } else if (effectiveStatus.includes('fail') || effectiveStatus.includes('reject')) {
      data.append("entry.291880096", "Failed");
    }

    await fetch(GOOGLE_FORM_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: data.toString()
    });
    return true;
  } catch (err) {
    console.warn("Google Form post notice:", err);
    return false;
  }
};

// =========================================================================
// GOOGLE SHEET GVIZ PARSER
// =========================================================================

function parseGoogleDate(val) {
  if (!val) return new Date().toISOString();
  try {
    if (typeof val === 'string' && val.startsWith('Date(') && val.endsWith(')')) {
      const parts = val.substring(5, val.length - 1).split(',').map(Number);
      if (parts.length >= 3) {
        const d = new Date(parts[0], parts[1] || 0, parts[2] || 1, parts[3] || 0, parts[4] || 0, parts[5] || 0);
        return !isNaN(d.getTime()) ? d.toISOString() : new Date().toISOString();
      }
    }
    const d = new Date(val);
    return !isNaN(d.getTime()) ? d.toISOString() : new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function parseGVizData(data) {
  if (!data || !data.table || !Array.isArray(data.table.rows)) return [];
  
  const cols = data.table.cols || [];
  let headers = cols.map(c => (c && c.label ? c.label.trim() : ''));
  const rawRows = data.table.rows;
  let startIndex = 0;
  
  if (headers.filter(Boolean).length < 3 && rawRows.length > 0) {
    const firstRowValues = (rawRows[0].c || []).map(cell => cell ? String(cell.v || cell.f || '').trim() : '');
    if (firstRowValues.some(v => /name|payment|amount|email|phone|timestamp/i.test(v))) {
      headers = firstRowValues;
      startIndex = 1;
    }
  }

  const txMap = new Map();

  for (let i = startIndex; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || !Array.isArray(row.c)) continue;
    
    const rowObj = {};
    row.c.forEach((cell, idx) => {
      const headerName = headers[idx] || `col_${idx}`;
      rowObj[headerName] = cell ? (cell.v !== null && cell.v !== undefined ? cell.v : cell.f || '') : '';
    });

    const keys = Object.keys(rowObj);
    const getVal = (pattern) => {
      const k = keys.find(key => pattern.test(key));
      return k ? String(rowObj[k]).trim() : '';
    };

    const name = getVal(/full\s*name|^name$/i);
    const verificationId = getVal(/payment\s*id|verification\s*id/i);
    const amount = getVal(/amount/i);
    const utr = getVal(/upi\s*ref|utr|reference/i);
    const phone = getVal(/phone|mobile/i);
    const email = getVal(/email/i);
    const purpose = getVal(/purpose/i);
    const source = getVal(/source/i);
    const rawStatus = getVal(/payment\s*status|^status$/i).toLowerCase();
    
    let status = 'pending';
    if (/success|verif|approv|complet|option\s*1/i.test(rawStatus)) {
      status = 'successful';
    } else if (/fail|reject|declin/i.test(rawStatus)) {
      status = 'failed';
    }

    const cleanVerificationId = (verificationId || '').trim().toUpperCase();
    const rowTimestamp = parseGoogleDate(getVal(/timestamp|date/i));

    if (name || cleanVerificationId) {
      const key = cleanVerificationId || `ROW_${i}_${(name || 'ANON').toUpperCase()}`;

      if (txMap.has(key)) {
        const existing = txMap.get(key);
        const mergedStatus = status !== 'pending' ? status : existing.status;
        const mergedVerifiedAt = mergedStatus === 'successful' 
          ? (existing.verifiedAt || (status === 'successful' ? rowTimestamp : new Date().toISOString()))
          : null;

        txMap.set(key, {
          verificationId: existing.verificationId || cleanVerificationId,
          name: name || existing.name,
          email: email || existing.email,
          phone: phone || existing.phone,
          purpose: purpose || existing.purpose,
          source: source || existing.source,
          amount: amount || existing.amount,
          utr: utr || existing.utr,
          status: mergedStatus,
          createdAt: existing.createdAt || rowTimestamp,
          verifiedAt: mergedVerifiedAt,
          notes: getVal(/notes|reason/i) || existing.notes || ''
        });
      } else {
        txMap.set(key, {
          verificationId: cleanVerificationId || `VER-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          name: (name || 'Anonymous').trim(),
          email: (email || '').trim(),
          phone: (phone || '').trim(),
          purpose: (purpose || 'UPI Payment').trim(),
          source: (source || 'Individual').trim(),
          amount: (amount || '0.00').trim(),
          utr: (utr || '').trim(),
          status,
          createdAt: rowTimestamp,
          verifiedAt: status === 'successful' ? rowTimestamp : null,
          notes: (getVal(/notes|reason/i) || '').trim()
        });
      }
    }
  }

  return Array.from(txMap.values()).reverse();
}

// =========================================================================
// HYBRID DATA OPERATIONS (Supabase Real-Time Database)
// =========================================================================

// Fetch all transactions from Supabase live database (excluding deleted)
export const fetchRemoteTransactions = async () => {
  try {
    const { data: sbData, error } = await supabase
      .from('transactions')
      .select('*')
      .neq('status', 'deleted')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(sbData)) {
      const clientTxs = sbData.map(toClientTx);
      saveTransactions(clientTxs);
      return { success: true, source: 'supabase', transactions: clientTxs };
    }
  } catch (err) {
    console.warn('Supabase fetch error:', err);
  }

  const localList = getTransactions().filter(t => t.status !== 'deleted');
  return { success: false, source: 'local', transactions: localList };
};

// Add new transaction: inserts into Supabase AND posts to Google Forms
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

  // 1. Immediate local cache update
  saveTransactions([newTx, ...localList]);

  // 2. Submit to Google Forms so Google Sheet gets a new row
  submitToGoogleForm(newTx, 'pending');

  // 3. Insert into Supabase
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
      return toClientTx(data);
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

  // 1. Check Supabase (excluding deleted)
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('verification_id', query)
      .neq('status', 'deleted')
      .maybeSingle();

    if (!error && data) {
      const clientTx = toClientTx(data);
      return clientTx;
    }
  } catch (err) {
    console.warn('Supabase fetchRemoteStatusById error:', err);
  }

  // 2. Fallback to local cache (excluding deleted)
  const local = getTransactions().filter(t => t.status !== 'deleted');
  return local.find(t => (t.verificationId || '').trim().toUpperCase() === query) || null;
};

// Update status and/or UTR in Supabase AND post status to Google Forms
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

  let targetTx = null;
  const updatedLocal = localList.map(t => {
    if ((t.verificationId || '').trim().toUpperCase() === query) {
      targetTx = {
        ...t,
        status,
        notes: notes !== undefined && notes !== '' ? notes : t.notes,
        utr: utr || t.utr,
        verifiedAt: updateFields.verified_at !== undefined ? updateFields.verified_at : t.verifiedAt
      };
      return targetTx;
    }
    return t;
  });

  if (!targetTx) {
    targetTx = {
      verificationId: query,
      name: '',
      purpose: '',
      source: '',
      amount: '0.00',
      phone: '',
      email: '',
      utr: utr || '',
      status,
      verifiedAt: updateFields.verified_at || null,
      notes
    };
    updatedLocal.unshift(targetTx);
  }

  saveTransactions(updatedLocal);

  // 1. Post to Google Forms so Google Sheet row updates with status!
  submitToGoogleForm(targetTx, status);

  // 2. Sync to Supabase so real-time WebSocket fires immediately
  try {
    await supabase
      .from('transactions')
      .update(updateFields)
      .eq('verification_id', query);
  } catch (err) {
    console.error('Supabase updateRemoteStatus error:', err);
  }

  return { success: true, transactions: updatedLocal };
};

export const updateTransactionStatus = updateRemoteStatus;

// Delete single transaction (marks as deleted in Supabase and clears from local cache)
export const deleteTransaction = async (verificationId) => {
  const query = (verificationId || '').trim().toUpperCase();
  const localList = getTransactions();
  const filtered = localList.filter(t => (t.verificationId || '').trim().toUpperCase() !== query);
  saveTransactions(filtered);

  try {
    await supabase.from('transactions').update({ status: 'deleted' }).eq('verification_id', query);
  } catch (err) {
    console.error('Error deleting from Supabase:', err);
  }

  return filtered;
};

// Clear all transactions (marks all active rows as deleted in Supabase and clears local cache)
export const clearAllTransactions = async () => {
  saveTransactions([]);
  try {
    await supabase.from('transactions').update({ status: 'deleted' }).neq('status', 'deleted');
  } catch (err) {
    console.error('Error clearing all transactions from Supabase:', err);
  }
  return [];
};

// =========================================================================
// REALTIME SUBSCRIPTIONS
// =========================================================================

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
