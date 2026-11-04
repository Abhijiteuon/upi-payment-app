# -*- coding: utf-8 -*-
"""
Part 3: Database Engineering & Data Persistence (No Source Code, No Raw LaTeX Math)
Chapters 5, 6, & 7
"""

CHAPTER_5 = r"""# PART III: DATABASE ENGINEERING & DATA PERSISTENCE

---

# Chapter 5: Relational Data Modeling & PostgreSQL Schemas

## 5.1 The `transactions` Table Specification

At the center of CLOAK's relational persistence engine lies the `public.transactions` table. Engineered inside PostgreSQL, its schema is hardened through strict datatype allocations, field-level check constraints, and default timestamp initializers.

### Comprehensive Schema Data Dictionary:

| Field Name | SQL Datatype | Nullable | Constraints & Invariants | Functional Role & Business Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **`id`** | `BIGINT` | No | `GENERATED ALWAYS AS IDENTITY PRIMARY KEY` | Monotonic 64-bit surrogate primary key; prevents arbitrary client key injection. |
| **`verification_id`** | `TEXT` | No | `UNIQUE`, Indexed via B-Tree | Primary business domain key exposed to payers and auditors (e.g., `VER-8F2K9M`). |
| **`name`** | `TEXT` | No | Sanitized text | Legal full name of the payer counterparty; used for audit attribution. |
| **`email`** | `TEXT` | No | Standard email format check | Electronic mail address for digital receipt delivery and notification. |
| **`phone`** | `TEXT` | No | 10-digit Indian mobile format | Primary communication handle; normalized to 10 digits starting with 6–9. |
| **`purpose`** | `TEXT` | No | Non-empty classification string | Commercial classification (e.g., Freelance Project, Engineering Advisory). |
| **`source`** | `TEXT` | No | Enumerated: Individual / Private / Organisation | Entity category of the remitter for accounting segregation. |
| **`amount`** | `NUMERIC(10, 2)`| No | `CHECK (amount > 0 AND amount <= 100000)` | Fixed-point arbitrary precision currency; strictly capped between INR 1.00 and INR 1,00,000.00. |
| **`utr`** | `TEXT` | Yes | Filtered Partial Unique Index | 12-digit Indian UPI banking reference; unique across non-failed records. |
| **`status`** | `TEXT` | No | `DEFAULT 'pending'`, `CHECK IN ('pending', 'successful', 'failed', 'deleted')` | Finite State Machine (FSM) ledger state; governs settlement lifecycle. |
| **`notes`** | `TEXT` | Yes | `DEFAULT ''` | Forensic notes, failure reasons, or administrative remarks. |
| **`verified_by`** | `TEXT` | Yes | `DEFAULT NULL` | Authenticated email address of the administrator who executed settlement. |
| **`verified_at`** | `TIMESTAMPTZ`| Yes | `DEFAULT NULL` | Microsecond-precision UTC timestamp marking the exact moment of verification. |
| **`created_at`** | `TIMESTAMPTZ`| No | `DEFAULT timezone('utc', now())` | Server-side immutable UTC timestamp recording initial record creation. |

### Deep Architectural & Invariant Analysis:
1. **Financial Fixed-Point Arithmetic (`NUMERIC(10, 2)`):**  
   In financial systems, floating-point representations are strictly prohibited due to binary rounding inaccuracies where base-2 representations cannot cleanly express fractional decimals (such as 0.1 + 0.2 != 0.3). `NUMERIC(10, 2)` allocates arbitrary-precision fixed-point arithmetic guaranteeing exact representation of rupees and paise down to two decimal places.
2. **Boundary Invariant Constraints:**  
   The database physically enforces that no transaction can be recorded with an amount of zero or less, and caps the maximum single transaction value at INR 1,00,000.00, directly aligning with the statutory NPCI retail UPI transaction ceiling.
3. **Surrogate Monotonicity (`GENERATED ALWAYS`):**  
   Using identity generation prevents any application client or administrator from manually inserting an arbitrary sequence ID, guaranteeing absolute surrogate monotonicity.

---

## 5.2 The `transaction_audit_logs` Immutable Audit Table

To satisfy banking compliance and administrative transparency, all status transitions and operational interventions are mirrored into an append-only audit table:

| Field Name | SQL Datatype | Nullable | Constraints | Functional Role |
| :--- | :--- | :--- | :--- | :--- |
| **`id`** | `BIGINT` | No | `GENERATED ALWAYS AS IDENTITY PRIMARY KEY` | Monotonic event sequence identifier. |
| **`verification_id`** | `TEXT` | No | Indexed reference | Target transaction domain key. |
| **`action`** | `TEXT` | No | Event taxonomy label | Categorical action label (e.g., `STATUS_SUCCESSFUL`, `STATUS_FAILED`). |
| **`previous_status`**| `TEXT` | Yes | State transition capture | State of transaction prior to mutation. |
| **`new_status`** | `TEXT` | Yes | Target state capture | New state of transaction after mutation. |
| **`performed_by`** | `TEXT` | Yes | Cryptographic identity | Email address of the authenticated administrator. |
| **`notes`** | `TEXT` | Yes | Operator rationale | Mandatory explanation for declines or audits. |
| **`created_at`** | `TIMESTAMPTZ`| No | `DEFAULT timezone('utc', now())` | Server-assigned UTC execution timestamp. |

### Immutability Security Invariants:
- Row-Level Security is active on the audit log.
- Only authenticated administrators possess read permissions.
- System functions and triggers possess append permissions.
- **No user or role possesses update or delete permissions under any circumstances.** This guarantees that forensic audit logs are cryptographically permanent and cannot be modified to cover up malicious reconciliation actions.

---

## 5.3 Anti-Tamper Database Triggers: Function `protect_transaction_financials`

One of the most dangerous vulnerabilities in decoupled architectures is the potential for an anonymous attacker to issue direct update commands via REST. While RLS filters rows, triggers enforce deep procedural invariants on row mutations.

CLOAK implements an anti-tampering trigger executed directly by the PostgreSQL kernel:

### Trigger Functional Specification & Invariant Logic:
1. **Invocation Context:** Fires automatically before any SQL `UPDATE` operation executes on `public.transactions` for each individual row.
2. **Security Definer Context:** Executes with elevated kernel security to inspect the invoker's cryptographic authorization context.
3. **Role Inspection:** Determines whether the executing role is `'anon'` (public internet client) or `'authenticated'` (verified administrator).
4. **Anonymous Mutation Invariants:**
   - **Financial Invariance:** If proposed amount != existing amount, proposed name != existing name, or proposed verification ID != existing verification ID, the trigger aborts execution with an exception: `'Financial fields are locked and cannot be altered.'`
   - **Status Escalation Invariance:** If proposed status != existing status AND proposed status != `'pending'`, the trigger aborts execution with an exception: `'Unauthorized attempt to modify transaction status.'`
5. **Execution Outcome:** If any invariant is violated, PostgreSQL issues an immediate transaction rollback, writing an error to the server log and returning an HTTP 400 error to the client.

Consequently, an anonymous payer can **only** update the row by attaching a 12-digit UTR string to their own pending record. All other financial and state parameters remain strictly immutable.

---

## 5.4 Indexing Strategies: B-Tree & Partial Filtered Indexes

Relational query performance in high-concurrency fintech applications depends heavily on indexing design. CLOAK deploys two targeted indexing structures:

### 1. The Verification ID B-Tree Index
- **Structure:** Standard Balanced Tree (B-Tree).
- **Time Complexity:** Search, insertion, and deletion operate in O(log n) disk block reads.
- **Purpose:** Optimizes public status lookup when querying by `verification_id`.

### 2. The Anti-Replay Partial Filtered Unique Index
- **Structural Innovation:** A filtered unique index evaluated strictly against non-empty UTR strings for non-deleted, non-failed rows.
- **The Engineering Problem:** In standard SQL, a simple unique constraint on UTR would fail:
  1. When transactions are initially created, their UTR is null or empty. A simple unique constraint would reject all subsequent new transactions because duplicate null or empty values would collide.
  2. If a transaction is rejected due to a typo in the UTR, the payer or merchant should be permitted to re-enter the correct reference without permanent collision locks.
- **The Partial Index Solution:** By filtering the index predicate to active and settled transactions with populated UTRs, PostgreSQL only indexes valid payment attempts.
- **Anti-Replay Invariant:** If an attacker attempts to bind a valid UTR (`410293847561`) that already exists in any active or settled transaction, PostgreSQL immediately detects the index collision and throws exception `23505` (`unique_violation`).

---

## 5.5 Entity-Relationship Model (ERD) & Invariant Proofs

The relational topology maintains a strict 1-to-many relationship between `public.transactions` and `public.transaction_audit_logs`:
- One transaction record can have multiple historical audit events (Creation, UTR Submission, Verification Approval, or Administrative Rejection).
- The audit table references the transaction via `verification_id`, ensuring full traceability across the entire lifecycle.

---

# Chapter 6: Row-Level Security (RLS) Policy Formulation

## 6.1 Principles of Row-Level Security in Zero-Trust Architectures

In traditional web applications, data authorization is handled at the application server layer. The application connects to the database as a superuser, and software bugs in the backend routing or middleware frequently result in catastrophic Broken Object Level Authorization (BOLA / IDOR) vulnerabilities.

Supabase and PostgreSQL invert this architecture via **Row-Level Security (RLS)**:
* **Table Access Default Rule:** DENY ALL ACCESS TO PUBLIC
Every single SQL query issued by any client connection is intercepted by the database kernel and evaluated against mathematically rigorous boolean policy predicates before a single byte of data is returned or mutated.

---

## 6.2 The Four Foundational RLS Security Policies

CLOAK establishes four distinct policies governing the lifecycle of financial records:

### Policy 1: Anonymous Insertion with Mandatory Pending Encasement
- **Target Role:** `anon`, `authenticated`
- **Operation:** `INSERT`
- **Validation Predicate:**
  - Status must equal `'pending'`
  - Amount must be greater than 0
  - Amount must be less than or equal to 100,000
  - Verification ID must not be null
- **Security Guarantee:** Prevents malicious actors from injecting already-settled transactions directly into the ledger.

### Policy 2: Scoped Public Querying by Verification ID
- **Target Role:** `anon`
- **Operation:** `SELECT`
- **Validation Predicate:**
  - Status must not equal `'deleted'`
- **Security Guarantee:** Allows payers to query and track their transaction status, while ensuring that soft-deleted administrative records remain completely invisible to the public internet.

### Policy 3: Constrained Public UTR Updates Without Privilege Escalation
- **Target Role:** `anon`
- **Operation:** `UPDATE`
- **Using Predicate:** Current status must equal `'pending'`
- **Check Predicate:** Resulting status must remain `'pending'`
- **Security Guarantee:** Payer can only update their own record if it is still pending, and is physically blocked from mutating the status to `'successful'`.

### Policy 4: Authenticated Master Administrator Full-Spectrum Access
- **Target Role:** `authenticated`
- **Operation:** `ALL` (`SELECT`, `INSERT`, `UPDATE`, `DELETE`)
- **Validation Predicate:** Unconditionally permitted for authenticated administrators
- **Security Guarantee:** Empowers verified administrators holding an authenticated JWT session to inspect the full ledger, perform 3-Point Bank Cross-Checks, approve settlements, and manage records.

---

## 6.3 Comprehensive RLS Policy Truth Table & Penetration Audit

| Injected Attack Scenario | Method | Proposed Target State | Active Policy Evaluated | Database Kernel Decision | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Direct Settlement Injection** | `POST` | `status = 'successful'` | Policy 1 Check Condition | Check expression evaluates to False | Blocked (403 Forbidden) |
| **Negative Value Exploit** | `POST` | `amount = -500.00` | Policy 1 Check Condition | Numeric constraint evaluates to False | Blocked (400 Bad Request) |
| **Status Escalation via Update**| `PATCH`| `status = 'successful'` | Policy 3 Check Condition | Status mismatch on check expression | Blocked (403 Forbidden) |
| **Amount Tampering via Update** | `PATCH`| `amount = 1.00` | Trigger `protect_financials` | Trigger raises unhandled exception | Aborted & Rolled Back |
| **Duplicate UTR Injection** | `PATCH`| `utr = '410293847561'` (reused) | Partial Unique Index | B-Tree duplicate key collision | Aborted (Error 23505) |
| **Deleted Record Snooping** | `GET` | `status = 'deleted'` row | Policy 2 Using Condition | Row filtered out from query view | Zero Rows Returned |

---

# Chapter 7: Dual-Sync Storage Engine & Resilient Fallback Mechanics

## 7.1 Architecture of the Unified Storage Facade

The frontend persistence layer of CLOAK is unified under an **Abstract Storage Facade**. Rather than tightly coupling UI components directly to database SDK methods, the storage facade encapsulates:
- Primary CRUD operations to Supabase PostgreSQL.
- Background asynchronous mirroring to Google Forms / Google Sheets.
- Parsing of Google Sheets GViz protocol feeds.
- Dynamic fallback to browser local storage during offline or partitioned network states.
- Client-side data transformation functions converting database records into immutable React domain entities.

---

## 7.2 Google Forms Headless REST Ingestion

To implement an independent off-site secondary ledger without provisioning a secondary database server, CLOAK exploits Google Forms' public ingestion engine:

### Ingestion Protocol Mechanics:
1. **Payload Serialization:** Form data is serialized into standard URL-encoded parameters.
2. **Form Entry Mapping:** Field parameters are mapped directly to Google Form internal entry identifiers:
   - Payer Full Name maps to Form Entry 1903499638
   - Payment Purpose maps to Form Entry 1388882637
   - Entity Source maps to Form Entry 635018705
   - Invoiced Amount maps to Form Entry 794330962
   - Mobile Number maps to Form Entry 1805777836
   - Email Address maps to Form Entry 225713530
   - 12-Digit UTR maps to Form Entry 1730640862
   - Verification ID maps to Form Entry 1090650382
   - Settlement Status maps to Form Entry 291880096
3. **Cross-Origin Execution Mode:** The HTTP POST request is dispatched in cross-origin opaque mode. Standard cross-origin requests to Google Forms would normally be blocked by browser CORS security policies. By executing an opaque POST request, the browser submits the form data directly to Google's edge servers, appending a new row into the associated Google Sheet ledger without throwing browser console errors.

---

## 7.3 Google Visualization API (GViz) Dynamic Sheet Parsing Engine

When the administrative dashboard or status tracker operates in secondary fallback mode, it reads directly from Google Cloud Sheets via the **Google Visualization (GViz) Wire Protocol**:

1. **Endpoint Topology:** The client queries the public GViz table endpoint of the linked spreadsheet, requesting structured JSON output.
2. **GViz Stream De-encapsulation:** Google responds with a JSONP payload. The parsing engine strips the wrapper, extracts the internal JSON table structure, and parses column metadata and cell value matrices.
3. **Fuzzy Header Mapping:** Because spreadsheet column positions may shift if an operator manually inserts a column, the parser uses regular expression pattern matching across header labels (matching patterns for name, verification ID, amount, UTR, phone, email, purpose, and status).
4. **Deduplication & State Merging:** The parser iterates rows chronologically, building an internal deduplication map keyed by the clean Verification ID. If multiple rows exist for the same Verification ID (e.g., initial creation row followed by status update rows), the parser merges the records, preserving the most recent settlement status.

---

## 7.4 Client-Side LocalStorage Fallback & Rehydration Strategy

In scenarios where both internet endpoints face temporary DNS resolution issues, CLOAK falls back seamlessly to the client's local cache:
- High-concurrency operations write optimistically to browser local storage.
- If a network partition occurs, cached transactions are loaded locally, allowing the payer to view their Verification ID and instructions offline.
- When network connectivity is re-established, the administrative console re-queries Supabase, updates in-memory state, and silently overwrites the local cache with authoritative relational truth.
"""
