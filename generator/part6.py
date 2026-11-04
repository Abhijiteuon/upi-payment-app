# -*- coding: utf-8 -*-
"""
Part 6: Administrative Operations & Fraud Mitigation Workflow (No Source Code, No Raw LaTeX Math)
Chapters 13 & 14
"""

CHAPTER_13 = r"""# PART VI: ADMINISTRATIVE OPERATIONS & FRAUD MITIGATION WORKFLOW

---

# Chapter 13: The 3-Point Bank Cross-Check Settlement Protocol

## 13.1 Step-by-Step Operator Workflow

The core operational mechanism distinguishing CLOAK from automated payment gateways is its structured **Human-in-the-Loop Settlement Protocol**. While fully automated webhook verification is suitable for commodities, high-value consulting, engineering deliverables, and sovereign financial settlements require an absolute, fail-safe verification protocol.

The operational workflow for the authorized receiver proceeds in six sequential phases:

```
  [Phase 1: Ingestion & Live Push]
  ├── Payer completes transfer and submits 12-digit UTR in CLOAK.
  └── Supabase Realtime pushes notification to the Admin Dashboard.
           │
           ▼
  [Phase 2: Bank Portal Access]
  ├── Administrator logs into ICICI NetBanking portal or Mobile App.
  └── Navigates to Account Statement / Detailed Transaction History.
           │
           ▼
  [Phase 3: The 3-Point Cross-Check Modal Activation]
  ├── Administrator locates the pending transaction in CLOAK Dashboard.
  └── Clicks "Verify & Approve", launching the modal dialogue.
           │
           ▼
  [Phase 4: Checkpoint Execution (Hard Verification Gates)]
  ├── Checkpoint 1: EXACT AMOUNT MATCH (Rupees & Paise)
  ├── Checkpoint 2: BANK UTR REFERENCE MATCH (Character-for-character)
  └── Checkpoint 3: TIMESTAMP & CREDIT ALIGNMENT (Chronological sync)
           │
           ▼
  [Phase 5: Status Transition & Audit Emission]
  ├── Database updates: status = 'successful', verified_by = adminEmail, verified_at = now().
  └── Append immutable record to public.transaction_audit_logs.
           │
           ▼
  [Phase 6: Live Client Receipt Illumination]
  └── PostgreSQL WAL logical replication stream fires WebSocket delta to Payer screen.
```

---

## 13.2 Checkpoint 1: Exact Amount Match (Rupees & Paise)

### Threat Vector Addressed: Value Substitution Fraud
As analyzed in Section 1.5, fraudsters frequently transfer INR 1.00 or INR 10.00 via UPI while claiming an order fulfillment value of INR 10,000.00. Because banking SMS alerts often summarize transactions briefly, an inattentive merchant may see the incoming credit from the buyer's name and assume the full balance was settled.

### Verification Rule:
The operator must visually locate the specific credit entry in the ICICI bank statement and confirm that:

* **Verification Criterion:** `Bank Credit Principal === Transaction Invoiced Amount`

If the transaction in CLOAK specifies INR 12,500.00, the bank statement must reflect a credit of exactly +12,500.00. If there is a discrepancy of even one single paisa, Checkpoint 1 fails, and approval is aborted.

---

## 13.3 Checkpoint 2: Bank UTR Reference Match

### Threat Vector Addressed: Synthetic Reference Fraud & Spoofed APKs
Counterfeit receipt generator applications display a synthesized 12-digit number (e.g., `410293847561`). This number appears superficially valid to naive observers, but it does not exist within the NPCI clearing switch.

### Verification Rule:
The operator must copy the 12-digit reference from the bank statement's transaction narrative and cross-reference it against the UTR field displayed in the CLOAK interface. 

The match must be identical across all 12 characters:

* **Verification Criterion:** `UTR (Bank Statement) === UTR (CLOAK Ledger)`

If the UTR is missing from the bank ledger, the transaction is recognized as a spoof attempt.

---

## 13.4 Checkpoint 3: Timestamp & Credit Alignment

### Threat Vector Addressed: Recycled Receipt Fraud & Timing Manipulation
Attackers may execute an authentic transaction for the requested amount, but attempt to present it as proof for a different invoice hours or days later.

### Verification Rule:
The operator verifies that the bank statement entry's execution timestamp corresponds to the transaction's creation window. For instant UPI transfers, credit occurs within 2 to 60 seconds of remitter authorization. A bank statement entry generated three days prior cannot validate a transaction initiated today.

---

## 13.5 Audit Log Emission & Admin Identity Attribution

When the administrator checks all three confirmation boxes in the verification modal, the system executes an atomic update:
1. Status is transitioned to `'successful'`.
2. Verified timestamp is locked to the current UTC time.
3. Verified by is stamped with the authenticated administrator's email.
4. An immutable audit record is appended to `public.transaction_audit_logs`.

This guarantees **Non-Repudiation**: every single transaction settled on the platform is permanently attributed to the specific authenticated administrator account that executed the cross-check.

---

## 13.6 Handling Discrepancies, Rejected Transactions, and Fraud Escalation

If an incoming transaction fails any of the three checkpoints, the administrator selects `"Decline / Reject"`. 

The system triggers an interactive prompt requiring a mandatory explanation. When confirmed:
1. `status` is transitioned to `'failed'`.
2. The custom reason is appended to `transactions.notes`.
3. The failure is mirrored to Google Forms/Sheets.
4. An audit record `STATUS_FAILED` is recorded.
5. The public tracking screen updates immediately, notifying the payer that their payment could not be verified and prompting them to contact support with authentic banking proof.

---

# Chapter 14: Multi-Admin Provisioning & Security Governance

## 14.1 The Security Dilemma of Open Registration vs Manual Provisioning

In standard SaaS platforms, administrative onboarding typically utilizes an open sign-up page (`/signup`) or an email invite link. In an institutional payment infrastructure handling real gross settlements, this pattern presents severe security hazards:

1. **Endpoint Probing & Credential Stuffing:** An exposed public registration endpoint invites automated bot attacks, account stuffing, and brute-force password spraying.
2. **Email Interception Vulnerabilities:** Relying on unencrypted SMTP email delivery for administrative confirmation tokens introduces Man-in-the-Middle (MITM) risks if an attacker compromises a domain's MX records or DNS infrastructure.

CLOAK adopts an uncompromising security posture:
- **Zero Public Registration:** There is no public registration page, API route, or client button for account creation.
- **In-Portal Provisioning:** New administrative accounts can **only be created from within an existing, fully authenticated administrative session**.

---

## 14.2 The Supabase RPC `confirm_admin_user` Security Architecture

When an account is created in Supabase Auth, it defaults to unconfirmed until the user clicks an email link. In closed enterprise deployments, administrators require the ability to provision co-administrators directly.

To accomplish this securely without granting client-side access to Supabase's high-privilege `service_role` master secret, CLOAK implements a dedicated Remote Procedure Call (RPC) stored procedure in PostgreSQL:

### Stored Procedure Security Characteristics:
1. **Security Definer Context:** The function executes with the privileges of the database owner, allowing it to modify the protected internal `auth.users` system table.
2. **Explicit Search Path Hardening:** Explicitly binds execution to `public, auth`, preventing search-path hijacking attacks where a malicious user could define a fake table in another schema.
3. **Execution Guard:** The function inspects the cryptographic context of the caller. If the caller's JWT role is not strictly `'authenticated'`, the function aborts execution with an `'Access denied'` security exception.

---

## 14.3 Administrator Creation Workflow from Dashboard Portal

Inside the active administrative dashboard, an authorized operator clicks `"Manage Admins"` -> `"Provision New Admin"`.

The provisioning workflow executes:
1. Validates proposed co-admin email and enforces minimum password entropy.
2. Dispatches an account registration call to Supabase Auth.
3. Automatically executes the internal RPC function to mark the account's email as confirmed, bypassing external SMTP delivery.
4. Records the provisioning action in system audit logs.

This ensures that administrative provisioning is fully autonomous, cryptographically authenticated, and completely decoupled from external SMTP mail services.

---

## 14.4 Session Storage Management & Cross-Tab Security

CLOAK implements strict session hygiene:
- Administrative authentication state is recorded in browser session storage rather than local storage.
- **Why session storage instead of local storage?**  
  Local storage persists indefinitely across browser restarts and is accessible to all tabs and windows sharing the domain. If an administrator walks away from their workstation or uses a shared laptop, another user opening the browser could access the administrative dashboard.
  By contrast, session storage is strictly scoped to the active browser tab. The instant the tab is closed, the session token is destroyed by the browser engine.

---

## 14.5 Revocation of Credentials and Incident Response

In the event that an administrator's credentials are compromised:
1. **Immediate Revocation:** The primary administrator connects to the Supabase console, deletes or disables the compromised user in `auth.users`, and revokes all active refresh tokens.
2. **Forensic Audit:** The security team queries `public.transaction_audit_logs` filtering by `performed_by = compromised_email` to identify every single settlement action taken by the account.
3. **Rollback:** Any illegitimate status transitions are reverted to `'pending'` or `'failed'`, and the partial unique index ensures that no duplicate UTR damage persists.
"""
