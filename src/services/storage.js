const STORAGE_KEY = 'upi_payment_transactions';
const ADMIN_SESSION_KEY = 'upi_admin_session';
const SHEET_URL_KEY = 'upi_sheet_url';

// Default Google Sheet for the UPI Payment App Form Responses
export const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1zfpeMPKzwkTGeGsGRI69ya6NW6y_N7NFsa3QQY1XIh8/edit?gid=450698937';

export const getSheetUrl = () => {
  const stored = localStorage.getItem(SHEET_URL_KEY);
  if (!stored || (!stored.includes('docs.google.com') && !stored.includes('script.google.com'))) {
    return DEFAULT_SHEET_URL;
  }
  return stored.trim();
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

export const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSe6ijmXl90ufpUplEoEWZj8uL92_jHt-w6kJANlf18dCTgzhA/formResponse';

// Submit response payload to Google Form in the background
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
    // If pending, we omit entry.291880096 so Google Form accepts submission cleanly without 400 error

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
    console.warn("Background Google Form submission notice:", err);
    return false;
  }
};

// =========================================================================
// GOOGLE SHEET / APPS SCRIPT SYNC PARSER
// =========================================================================

// Robust Google Date format parser (handles Date(year,month,day,hour,min,sec) and standard strings)
function parseGoogleDate(val) {
  if (!val) return new Date().toISOString();
  try {
    if (typeof val === 'string' && val.startsWith('Date(') && val.endsWith(')')) {
      const parts = val.substring(5, val.length - 1).split(',').map(Number);
      if (parts.length >= 3) {
        // parts: [year, month, day, hours, minutes, seconds]
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

// Parses Google GViz JSON output directly from shared Google Sheet, consolidating multi-row responses
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

  // Use a Map to consolidate multiple row submissions for the same verificationId
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
        // If the new row has a concrete verified/failed status, it takes precedence
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

  // Reverse so newest transactions appear first in UI
  return Array.from(txMap.values()).reverse();
}

export const fetchRemoteTransactions = async () => {
  const configuredUrl = getSheetUrl();
  const localList = getTransactions();

  try {
    // 1. Check if URL is an Apps Script Web App
    if (configuredUrl && configuredUrl.includes('script.google.com')) {
      const res = await fetch(`${configuredUrl}?action=getTransactions&t=${Date.now()}`);
      const data = await res.json();
      if (data && data.success && Array.isArray(data.transactions)) {
        saveTransactions(data.transactions);
        return { success: true, source: 'apps_script', transactions: data.transactions };
      }
    } 
    // 2. Check if URL is a Google Spreadsheet Link
    else {
      const urlToUse = configuredUrl || DEFAULT_SHEET_URL;
      const match = urlToUse.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        const sheetId = match[1];
        
        // Extract gid if present
        let gid = '';
        const gidMatch = urlToUse.match(/gid=([0-9]+)/);
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
          const remoteMap = new Map();
          parsedTxs.forEach(tx => {
            const k = (tx.verificationId || '').trim().toUpperCase();
            if (k) remoteMap.set(k, tx);
          });

          // Update parsed transactions with local non-pending overrides
          const merged = parsedTxs.map(remoteTx => {
            if (remoteTx.status !== 'pending') {
              return remoteTx;
            }
            const localMatch = localList.find(l => (l.verificationId || '').trim().toUpperCase() === (remoteTx.verificationId || '').trim().toUpperCase());
            if (localMatch && localMatch.status !== 'pending') {
              return { ...remoteTx, status: localMatch.status, notes: localMatch.notes || remoteTx.notes };
            }
            return remoteTx;
          });

          // Prepend any local transactions that haven't appeared in the Google Sheet yet
          const localOnly = localList.filter(l => {
            const k = (l.verificationId || '').trim().toUpperCase();
            return k && !remoteMap.has(k);
          });

          const finalTransactions = [...localOnly, ...merged];
          saveTransactions(finalTransactions);
          return { success: true, source: 'google_sheet', transactions: finalTransactions };
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
  return transactions.find(t => (t.verificationId || '').trim().toUpperCase() === query) || null;
};

export const fetchRemoteStatusById = async (verificationId) => {
  const query = (verificationId || '').trim().toUpperCase();
  if (!query) return null;

  // 1. Pull latest from remote
  try {
    const result = await fetchRemoteTransactions();
    if (result && Array.isArray(result.transactions) && result.transactions.length > 0) {
      const match = result.transactions.find(t => (t.verificationId || '').trim().toUpperCase() === query);
      if (match) return match;
    }
  } catch (err) {
    console.warn('fetchRemoteTransactions error in fetchRemoteStatusById:', err);
  }

  // 2. Direct hard fallback to Google Sheet GViz API
  try {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/1zfpeMPKzwkTGeGsGRI69ya6NW6y_N7NFsa3QQY1XIh8/gviz/tq?tqx=out:json&gid=450698937&t=${Date.now()}`;
    const res = await fetch(gvizUrl);
    const text = await res.text();
    if (!text.includes('<!DOCTYPE') && text.includes('{')) {
      const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
      const data = JSON.parse(jsonStr);
      const parsedTxs = parseGVizData(data);
      const match = parsedTxs.find(t => (t.verificationId || '').trim().toUpperCase() === query);
      if (match) return match;
    }
  } catch (err) {
    console.warn('Direct GViz fallback error:', err);
  }

  // 3. Fallback to local storage cache
  return getTransactionById(query);
};

export const updateRemoteStatus = async (verificationId, status, notes = '', utr = '') => {
  const localList = getTransactions();
  const query = (verificationId || '').trim().toUpperCase();

  let targetTx = null;
  const updated = localList.map(t => {
    if ((t.verificationId || '').trim().toUpperCase() === query) {
      targetTx = {
        ...t,
        status,
        utr: utr || t.utr,
        verifiedAt: status === 'successful' ? (t.verifiedAt || new Date().toISOString()) : (status === 'pending' ? null : t.verifiedAt),
        notes: notes !== undefined && notes !== '' ? notes : t.notes
      };
      return targetTx;
    }
    return t;
  });

  // If not found in localList, construct a record
  if (!targetTx) {
    targetTx = {
      verificationId: query,
      name: '',
      purpose: '',
      source: '',
      amount: '',
      phone: '',
      email: '',
      utr: utr || '',
      status,
      verifiedAt: status === 'successful' ? new Date().toISOString() : null,
      notes
    };
    updated.unshift(targetTx);
  }

  saveTransactions(updated);

  // Submit response to Google Forms in background so Google Sheet gets marked with status
  await submitToGoogleForm(targetTx, status);

  // If Google Apps Script Web App configured, also post to script
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
  const updated = transactions.filter(t => (t.verificationId || '').trim().toUpperCase() !== query);
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
