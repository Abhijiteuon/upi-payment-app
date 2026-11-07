import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wgmvsifckxazgdlbvwhb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnbXZzaWZja3hhemdkbGJ2d2hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1ODg3MjksImV4cCI6MjEwODE2NDcyOX0.E1Uba0W0KN7_gDFsyXrUwP95cWbpsEMfr-cxwo_vasI';

export const AUTH_CLEAN_VERSION = 'upi_app_clean_v7_reset';

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

// Force a clean one-time purge of all legacy sessions so the user starts at the Login Page
if (typeof window !== 'undefined') {
  try {
    const activeVersion = window.localStorage.getItem('upi_auth_version');
    if (activeVersion !== AUTH_CLEAN_VERSION) {
      // 1. Clear any persistent tokens in localStorage
      if (window.localStorage) {
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith('sb-') || k.includes('auth') || k.includes('cloak') || k.includes('upi_admin')) {
            localStorage.removeItem(k);
          }
        });
      }
      // 2. Clear lingering mobile tab sessionStorage
      if (window.sessionStorage) {
        window.sessionStorage.clear();
      }
      // 3. Mark version as upgraded
      window.localStorage.setItem('upi_auth_version', AUTH_CLEAN_VERSION);
    }
  } catch (err) {
    console.warn('Storage purge error:', err);
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
