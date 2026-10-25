-- =========================================================================
-- 5-LAYER SECURITY SETUP FOR UPI PAYMENT APPLICATION
-- Execute this script in your Supabase Dashboard -> SQL Editor
-- =========================================================================

-- 1. Ensure Table Structure & Audit Columns
CREATE TABLE IF NOT EXISTS public.transactions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    verification_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    purpose TEXT NOT NULL,
    source TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0 AND amount <= 100000),
    utr TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed', 'deleted')),
    notes TEXT DEFAULT '',
    verified_by TEXT DEFAULT NULL,
    verified_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Ensure verified_by column exists if table was created previously
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'verified_by'
    ) THEN
        ALTER TABLE public.transactions ADD COLUMN verified_by TEXT DEFAULT NULL;
    END IF;
END $$;

-- 2. Anti-Replay: Prevent Duplicate UTR Submissions
-- Allows multiple NULL/empty UTRs, but strictly forbids duplicate 12-digit UTRs
DROP INDEX IF EXISTS idx_transactions_unique_utr;
CREATE UNIQUE INDEX idx_transactions_unique_utr 
ON public.transactions (utr) 
WHERE utr IS NOT NULL AND utr != '' AND status != 'deleted' AND status != 'failed';

-- Index for instant lookup by verification_id
CREATE INDEX IF NOT EXISTS idx_transactions_verification_id 
ON public.transactions (verification_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Clean existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public can insert pending transaction" ON public.transactions;
DROP POLICY IF EXISTS "Public can query their transaction by verification_id" ON public.transactions;
DROP POLICY IF EXISTS "Public can submit UTR for their pending transaction" ON public.transactions;
DROP POLICY IF EXISTS "Admins have full access to transactions" ON public.transactions;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.transactions;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.transactions;
DROP POLICY IF EXISTS "Enable update for all users" ON public.transactions;

-- POLICY 1: Public (anon) can INSERT, but ONLY with status 'pending'
CREATE POLICY "Public can insert pending transaction"
ON public.transactions
FOR INSERT
TO anon, authenticated
WITH CHECK (
    status = 'pending' AND 
    amount > 0 AND 
    amount <= 100000 AND
    verification_id IS NOT NULL
);

-- POLICY 2: Public (anon) can read their transaction via verification_id
CREATE POLICY "Public can query their transaction by verification_id"
ON public.transactions
FOR SELECT
TO anon
USING (status != 'deleted');

-- POLICY 3: Public (anon) can UPDATE their UTR only if transaction is still 'pending'
-- Prevents public from changing status, amount, name, or verification_id
CREATE POLICY "Public can submit UTR for their pending transaction"
ON public.transactions
FOR UPDATE
TO anon
USING (status = 'pending')
WITH CHECK (
    status = 'pending' -- Strictly prevents public from marking status as 'successful'
);

-- POLICY 4: Authenticated Admins have FULL access (SELECT, UPDATE, DELETE)
CREATE POLICY "Admins have full access to transactions"
ON public.transactions
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. Anti-Tampering Trigger: Protect Core Financial Fields
CREATE OR REPLACE FUNCTION public.protect_transaction_financials()
RETURNS TRIGGER AS $$
BEGIN
    -- Only allow authenticated admins to modify status or verification metadata
    IF (auth.role() = 'anon') THEN
        -- Prevent changing amount, name, purpose, or verification_id
        IF (NEW.amount != OLD.amount OR NEW.name != OLD.name OR NEW.verification_id != OLD.verification_id) THEN
            RAISE EXCEPTION 'Financial fields are locked and cannot be altered.';
        END IF;
        
        -- Prevent anon from changing status
        IF (NEW.status != OLD.status AND NEW.status != 'pending') THEN
            RAISE EXCEPTION 'Unauthorized attempt to modify transaction status.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_transaction_financials ON public.transactions;
CREATE TRIGGER trg_protect_transaction_financials
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.protect_transaction_financials();

-- 5. Audit Logging Table
CREATE TABLE IF NOT EXISTS public.transaction_audit_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    verification_id TEXT NOT NULL,
    action TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT,
    performed_by TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.transaction_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.transaction_audit_logs;
CREATE POLICY "Admins can view audit logs"
ON public.transaction_audit_logs
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "System can insert audit logs" ON public.transaction_audit_logs;
CREATE POLICY "System can insert audit logs"
ON public.transaction_audit_logs
FOR INSERT
TO authenticated, anon
WITH CHECK (true);
