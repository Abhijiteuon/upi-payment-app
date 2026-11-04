-- =========================================================================
-- CLOAK MULTI-USER MERCHANT PLATFORM MIGRATION
-- Run this script in your Supabase Dashboard -> SQL Editor
-- =========================================================================

-- 1. Create Merchant Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    upi_id TEXT NOT NULL,
    bio TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Index for instant username lookup (for ?to=username payment links)
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(LOWER(username));

-- 2. Add Payee Scoping Columns to Transactions Table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'payee_username'
    ) THEN
        ALTER TABLE public.transactions ADD COLUMN payee_username TEXT DEFAULT 'abhijit';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'payee_id'
    ) THEN
        ALTER TABLE public.transactions ADD COLUMN payee_id UUID REFERENCES auth.users(id) DEFAULT NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_payee_username ON public.transactions(LOWER(payee_username));
CREATE INDEX IF NOT EXISTS idx_transactions_payee_id ON public.transactions(payee_id);

-- 3. Row-Level Security for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view merchant profiles" ON public.profiles;
CREATE POLICY "Public can view merchant profiles"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4. Update Row-Level Security on Transactions Table
-- Clean existing policies to ensure clean multi-tenant isolation
DROP POLICY IF EXISTS "Admins have full access to transactions" ON public.transactions;
DROP POLICY IF EXISTS "Merchants can view their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Merchants can update their own transactions" ON public.transactions;

-- POLICY: Merchants can SELECT transactions made to their account
CREATE POLICY "Merchants can view their own transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (
    payee_id = auth.uid() 
    OR LOWER(payee_username) = (SELECT LOWER(username) FROM public.profiles WHERE id = auth.uid())
    OR payee_username IS NULL
);

-- POLICY: Merchants can UPDATE status for transactions made to their account
CREATE POLICY "Merchants can update their own transactions"
ON public.transactions
FOR UPDATE
TO authenticated
USING (
    payee_id = auth.uid() 
    OR LOWER(payee_username) = (SELECT LOWER(username) FROM public.profiles WHERE id = auth.uid())
    OR payee_username IS NULL
)
WITH CHECK (
    payee_id = auth.uid() 
    OR LOWER(payee_username) = (SELECT LOWER(username) FROM public.profiles WHERE id = auth.uid())
    OR payee_username IS NULL
);

-- 5. Seed Primary Architect Profile (Safe Upsert)
-- (If you already have a master admin user in auth.users, you can link their profile)
INSERT INTO public.profiles (id, username, display_name, upi_id, bio)
SELECT 
    id, 
    'abhijit', 
    'Abhijit Kumar', 
    'euonabhijit@okicici', 
    'Lead Architect & Platform Creator'
FROM auth.users
WHERE email = 'euonabhijit@gmail.com' OR email ILIKE '%abhijit%'
LIMIT 1
ON CONFLICT (username) DO NOTHING;
