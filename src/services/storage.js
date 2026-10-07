const STORAGE_KEY = 'upi_payment_transactions';
const ADMIN_SESSION_KEY = 'upi_admin_session';
const SHEET_URL_KEY = 'upi_sheet_url';

// Default Google Sheet for the UPI Payment App Form Responses
export const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1zfpeMPKzwkTGeGsGRI69ya6NW6y_N7NFsa3QQY1XIh8/edit?gid=450698937';

export const getSheetUrl = () => {
  return localStorage.getItem(SHEET_URL_KEY) || DEFAULT_SHEET_URL;
};

export const setSheetUrl = (url) => {
  localStorage.setItem(SHEET_URL_KEY, (url || DEFAULT_SHEET_URL).trim());
};

// Aliases for compatibility
export const getAppsScriptUrl = getSheetUrl;
export const setAppsScriptUrl = setSheetUrl;

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
// GOOGLE SHEET / APPS SCRIPT SYNC PARSER
// =========================================================================

// Parses Google GViz JSON output directly from any shared Google Sheet
function parseGVizData(data) {
  if (!data || !data.table || !Array.isArray(data.table.rows)) return [];
  
  const cols = data.table.cols || [];
  let headers = cols.map(c => (c && c.label ? c.label.trim() : ''));
  
  const rawRows = data.table.rows;
  let startIndex = 0;
  
  // If headers are empty in cols, check if row 0 contains column names
  if (headers.filter(Boolean).length < 3 && rawRows.length > 0) {
    const firstRowValues = (rawRows[0].c || []).map(cell => cell ? String(cell.v || cell.f || '').trim() : '');
    if (firstRowValues.some(v => /name|payment|amount|email|phone|timestamp/i.test(v))) {
      headers = firstRowValues;
      startIndex = 1;
    }
  }

  const transactions = [];

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
    const status = getVal(/status/i).toLowerCase() || 'pending';
    const notes = getVal(/notes|reason/i);
    const timestamp = getVal(/timestamp|date/i);

    if (name || verificationId) {
      transactions.push({
        verificationId: verificationId || `VER-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        name: name || 'Anonymous',
        email,
        phone,
        purpose: purpose || 'UPI Payment',
        source: source || 'Individual',
        amount: amount || '0.00',
        utr,
        status: (status === 'successful' || status === 'failed') ? status : 'pending',
        createdAt: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
        verifiedAt: status === 'successful' ? new Date().toISOString() : null,
        notes
      });
    }
  }

  // Reverse so newest appears first
  return transactions.reverse();
}

export const fetchRemoteTransactions = async () => {
  const configuredUrl = getSheetUrl();
  const localList = getTransactions();

  if (!configuredUrl) {
    return { success: true, source: 'local', transactions: localList };
  }

  try {
    // 1. Check if URL is an Apps Script Web App
    if (configuredUrl.includes('script.google.com')) {
      const res = await fetch(`${configuredUrl}?action=getTransactions&t=${Date.now()}`);
      const data = await res.json();
      if (data && data.success && Array.isArray(data.transactions)) {
        saveTransactions(data.transactions);
        return { success: true, source: 'apps_script', transactions: data.transactions };
      }
    } 
    // 2. Check if URL is a Google Spreadsheet Link
    else if (configuredUrl.includes('spreadsheets/d/')) {
      const match = configuredUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        const sheetId = match[1];
        
        // Extract gid if present
        let gid = '';
        const gidMatch = configuredUrl.match(/gid=([0-9]+)/);
        if (gidMatch && gidMatch[1]) {
          gid = gidMatch[1];
        }

        const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json${gid ? `&gid=${gid}` : ''}&t=${Date.now()}`;
        const res = await fetch(gvizUrl);
        const text = await res.text();

        // Check if sheet access is restricted
        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
          console.warn('Google Sheet returned HTML login page. Access is set to Restricted.');
          return { 
            success: false, 
            error: 'RESTRICTED', 
            message: 'Google Sheet is Restricted. Please set Share access to "Anyone with the link can view".', 
            transactions: localList 
          };
        }

        const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
        const data = JSON.parse(jsonStr);
        const parsedTxs = parseGVizData(data);
        
        if (parsedTxs.length > 0) {
          // Merge local status overrides with sheet rows
          const merged = parsedTxs.map(remoteTx => {
            const localMatch = localList.find(l => (l.verificationId || '').toUpperCase() === (remoteTx.verificationId || '').toUpperCase());
            if (localMatch && localMatch.status !== 'pending' && remoteTx.status === 'pending') {
              return { ...remoteTx, status: localMatch.status, notes: localMatch.notes || remoteTx.notes };
            }
            return remoteTx;
          });
          saveTransactions(merged);
          return { success: true, source: 'google_sheet', transactions: merged };
        }
      }
    }
  } catch (err) {
    console.warn('Error fetching remote Google Sheet data:', err);
  }

  return { success: false, source: 'local', transactions: localList };
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

  // Pull latest from remote
  const result = await fetchRemoteTransactions();
  if (result && Array.isArray(result.transactions)) {
    const match = result.transactions.find(t => (t.verificationId || '').toUpperCase() === query);
    if (match) return match;
  }

  return getTransactionById(query);
};

export const updateRemoteStatus = async (verificationId, status, notes = '', utr = '') => {
  const localList = getTransactions();
  const query = (verificationId || '').trim().toUpperCase();

  const updated = localList.map(t => {
    if ((t.verificationId || '').toUpperCase() === query) {
      return {
        ...t,
        status,
        utr: utr || t.utr,
        verifiedAt: status !== 'pending' ? new Date().toISOString() : null,
        notes: notes !== undefined && notes !== '' ? notes : t.notes
      };
    }
    return t;
  });

  saveTransactions(updated);

  // If Google Apps Script Web App configured, post to sheet
  const scriptUrl = getSheetUrl();
  if (scriptUrl && scriptUrl.includes('script.google.com')) {
    try {
      fetch(scriptUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'updateStatus', verificationId: query, status, notes, utr })
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
