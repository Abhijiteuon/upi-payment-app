import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wgmvsifckxazgdlbvwhb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnbXZzaWZja3hhemdkbGJ2d2hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1ODg3MjksImV4cCI6MjEwODE2NDcyOX0.E1Uba0W0KN7_gDFsyXrUwP95cWbpsEMfr-cxwo_vasI';

// Safe sessionStorage adapter: auto-terminates session when user closes browser or shuts down system
const customSessionStorage = {
  getItem: (key) => {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(key);
  },
  setItem: (key, value) => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(key, value);
    }
  },
  removeItem: (key) => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(key);
    }
  }
};

// Purge any older tokens saved to persistent localStorage from disk
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith('sb-') || k.includes('auth-token') || k.includes('cloak_active')) {
        localStorage.removeItem(k);
      }
    });
  } catch {
    // ignore
  }
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: customSessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});
