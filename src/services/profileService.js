import { supabase } from './supabaseClient.js';
import { validateUPI, validateUsername, validateEmail } from './security.js';

const ACTIVE_PROFILE_KEY = 'cloak_active_profile';
const KNOWN_PROFILES_KEY = 'cloak_known_profiles';

export const DEFAULT_MERCHANT = {
  id: 'master-001',
  username: 'abhijit',
  displayName: 'Abhijit Kumar',
  upiId: 'euonabhijit@okicici',
  bio: 'Lead Architect & Independent Consultant'
};

// Seed known profiles with default merchant
const getKnownProfiles = () => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { abhijit: DEFAULT_MERCHANT };
    }
    const raw = localStorage.getItem(KNOWN_PROFILES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed['abhijit']) {
      parsed['abhijit'] = DEFAULT_MERCHANT;
    }
    return parsed;
  } catch {
    return { abhijit: DEFAULT_MERCHANT };
  }
};

const saveKnownProfile = (profile) => {
  if (!profile || !profile.username) return;
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const known = getKnownProfiles();
    known[profile.username.toLowerCase()] = {
      id: profile.id,
      username: profile.username.toLowerCase(),
      displayName: profile.displayName || profile.display_name || profile.username,
      upiId: profile.upiId || profile.upi_id,
      bio: profile.bio || ''
    };
    localStorage.setItem(KNOWN_PROFILES_KEY, JSON.stringify(known));
  } catch (err) {
    console.warn('Failed to cache known profile locally:', err);
  }
};

/**
 * Sign up a new merchant account with Supabase Auth & Profile record
 */
export const signUpMerchant = async ({ email, password, displayName, username, upiId, bio = '' }) => {
  const cleanEmail = validateEmail(email);
  if (!cleanEmail.valid) {
    return { success: false, error: cleanEmail.error };
  }

  if (!password || password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' };
  }

  const cleanName = (displayName || '').trim();
  if (!cleanName || cleanName.length < 2) {
    return { success: false, error: 'Please enter a valid display/business name (min 2 characters).' };
  }

  const userRes = validateUsername(username);
  if (!userRes.valid) {
    return { success: false, error: userRes.error };
  }
  const cleanUsername = userRes.clean;

  const upiRes = validateUPI(upiId);
  if (!upiRes.valid) {
    return { success: false, error: upiRes.error };
  }
  const cleanUpi = upiRes.clean;

  try {
    // 1. Create Auth user with metadata
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: cleanEmail.clean,
      password: password,
      options: {
        data: {
          username: cleanUsername,
          display_name: cleanName,
          upi_id: cleanUpi,
          bio: bio.trim()
        }
      }
    });

    if (authErr) {
      return { success: false, error: authErr.message };
    }

    const user = authData?.user;
    const profile = {
      id: user?.id || `user_${Date.now()}`,
      username: cleanUsername,
      displayName: cleanName,
      upiId: cleanUpi,
      bio: bio.trim(),
      email: cleanEmail.clean
    };

    // 2. Persist to profiles table if table exists in Supabase
    if (user?.id) {
      try {
        await supabase.from('profiles').upsert([
          {
            id: user.id,
            username: cleanUsername,
            display_name: cleanName,
            upi_id: cleanUpi,
            bio: bio.trim()
          }
        ]);
      } catch (dbErr) {
        console.warn('Supabase profiles table notice:', dbErr);
      }
    }

    // 3. Cache locally
    saveKnownProfile(profile);
    setActiveProfile(profile);

    return { 
      success: true, 
      user, 
      profile,
      needsConfirmation: !authData?.session
    };
  } catch (err) {
    console.error('Merchant sign up error:', err);
    return { success: false, error: err.message || 'Registration failed.' };
  }
};

/**
 * Sign in an existing merchant with email and password
 */
export const loginMerchant = async (email, password) => {
  const cleanEmail = (email || '').trim();
  const cleanPassword = (password || '').trim();

  if (!cleanEmail || !cleanPassword) {
    return { success: false, error: 'Email and password are required.' };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const user = data?.user;
    let profile = null;

    // 1. Try fetching from profiles table
    try {
      const { data: dbProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (dbProfile) {
        profile = {
          id: dbProfile.id,
          username: dbProfile.username,
          displayName: dbProfile.display_name,
          upiId: dbProfile.upi_id,
          bio: dbProfile.bio || '',
          email: user.email
        };
      }
    } catch {
      // fallback
    }

    // 2. Fallback to auth user_metadata if table row not found
    if (!profile && user?.user_metadata?.username) {
      profile = {
        id: user.id,
        username: user.user_metadata.username,
        displayName: user.user_metadata.display_name || user.email.split('@')[0],
        upiId: user.user_metadata.upi_id || 'user@upi',
        bio: user.user_metadata.bio || '',
        email: user.email
      };
    }

    // 3. Ultimate fallback: generate from email
    if (!profile) {
      const emailUsername = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '');
      profile = {
        id: user.id,
        username: emailUsername || 'merchant',
        displayName: user.email.split('@')[0],
        upiId: 'notconfigured@upi',
        bio: '',
        email: user.email
      };
    }

    saveKnownProfile(profile);
    setActiveProfile(profile);

    return { success: true, user, profile, session: data?.session };
  } catch (err) {
    console.error('Merchant sign in error:', err);
    return { success: false, error: err.message || 'Login failed.' };
  }
};

/**
 * Update merchant profile (e.g. changing UPI ID or Display Name)
 */
export const updateMerchantProfile = async (updates) => {
  const current = getActiveProfile();
  if (!current) return { success: false, error: 'No active session.' };

  const cleanName = (updates.displayName || current.displayName).trim();
  const upiRes = validateUPI(updates.upiId || current.upiId);
  if (!upiRes.valid) {
    return { success: false, error: upiRes.error };
  }

  const updatedProfile = {
    ...current,
    displayName: cleanName,
    upiId: upiRes.clean,
    bio: (updates.bio !== undefined ? updates.bio : current.bio || '').trim()
  };

  try {
    // 1. Update user_metadata
    await supabase.auth.updateUser({
      data: {
        display_name: updatedProfile.displayName,
        upi_id: updatedProfile.upiId,
        bio: updatedProfile.bio
      }
    });

    // 2. Update profiles table
    try {
      await supabase.from('profiles').upsert([
        {
          id: current.id,
          username: current.username,
          display_name: updatedProfile.displayName,
          upi_id: updatedProfile.upiId,
          bio: updatedProfile.bio,
          updated_at: new Date().toISOString()
        }
      ]);
    } catch {
      // non-blocking
    }

    saveKnownProfile(updatedProfile);
    setActiveProfile(updatedProfile);

    return { success: true, profile: updatedProfile };
  } catch (err) {
    console.error('Failed to update merchant profile:', err);
    return { success: false, error: err.message || 'Profile update failed.' };
  }
};

/**
 * Public lookup: Fetch a merchant's public payment profile by username (used by Payers)
 */
export const getPublicProfileByUsername = async (rawUsername) => {
  if (!rawUsername) return DEFAULT_MERCHANT;
  const username = rawUsername.trim().toLowerCase();

  // 1. Quick check for default merchant
  if (username === 'abhijit' || username === 'euona' || username === 'default') {
    return DEFAULT_MERCHANT;
  }

  // 2. Try Supabase profiles table
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, upi_id, bio')
      .eq('username', username)
      .maybeSingle();

    if (!error && data && data.upi_id) {
      const pub = {
        id: data.id,
        username: data.username,
        displayName: data.display_name,
        upiId: data.upi_id,
        bio: data.bio || ''
      };
      saveKnownProfile(pub);
      return pub;
    }
  } catch (err) {
    console.warn('Public profile lookup notice:', err);
  }

  // 3. Fallback to local known profiles cache
  const known = getKnownProfiles();
  if (known[username]) {
    return known[username];
  }

  // If username not found, fallback to default merchant
  return {
    ...DEFAULT_MERCHANT,
    customQueryNotFound: true,
    queriedUsername: username
  };
};

/**
 * Active session helpers
 */
export const setActiveProfile = (profile) => {
  if (!profile) {
    sessionStorage.removeItem(ACTIVE_PROFILE_KEY);
  } else {
    sessionStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(profile));
    sessionStorage.setItem('upi_admin_session', 'true');
    sessionStorage.setItem('upi_admin_name', profile.displayName || profile.username);
  }
};

export const getActiveProfile = () => {
  try {
    const raw = sessionStorage.getItem(ACTIVE_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const logoutMerchantSession = async () => {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('Sign out notice:', err);
  }
  sessionStorage.removeItem(ACTIVE_PROFILE_KEY);
  sessionStorage.removeItem('upi_admin_session');
  sessionStorage.removeItem('upi_admin_name');
};

/**
 * Build a shareable payment request link
 */
export const buildPaymentRequestUrl = (username, amount = '', purpose = '') => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://cloak.pay';
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  
  const params = new URLSearchParams();
  params.set('to', (username || 'abhijit').toLowerCase());

  if (amount && parseFloat(amount) > 0) {
    params.set('am', parseFloat(amount).toFixed(2));
  }

  if (purpose && purpose.trim()) {
    params.set('desc', purpose.trim());
  }

  return `${origin}${pathname}?${params.toString()}`;
};
