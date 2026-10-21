import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wgmvsifckxazgdlbvwhb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnbXZzaWZja3hhemdkbGJ2d2hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1ODg3MjksImV4cCI6MjEwODE2NDcyOX0.E1Uba0W0KN7_gDFsyXrUwP95cWbpsEMfr-cxwo_vasI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
