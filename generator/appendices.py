# -*- coding: utf-8 -*-
"""
Appendices: Pure Specifications, Dictionaries & Mathematical Formulations (No Source Code)
Appendices A-E
"""

APPENDICES = r"""# APPENDICES & SPECIFICATION REFERENCES

---

# Appendix A: Relational Database Schema & Policy Specification Dictionary

### 1. Master Table Definition: `public.transactions`

| Column Identifier | PostgreSQL Datatype | Nullable | Primary Constraints | Default Assignment | Business Rule & Security Invariant |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`id`** | `BIGINT` | No | Primary Key | `GENERATED ALWAYS AS IDENTITY` | Monotonic 64-bit surrogate primary key; prevents arbitrary client key injection. |
| **`verification_id`** | `TEXT` | No | Unique Key | None | Primary business domain key exposed to payers and auditors (e.g., `VER-8F2K9M`). |
| **`name`** | `TEXT` | No | Sanitized text | None | Legal full name of the payer counterparty; used for audit attribution. |
| **`email`** | `TEXT` | No | RFC 5322 check | None | Electronic mail address for digital receipt delivery and notification. |
| **`phone`** | `TEXT` | No | 10-digit check | None | Primary communication handle; normalized to 10 digits starting with 6–9. |
| **`purpose`** | `TEXT` | No | Non-empty text | None | Commercial classification (e.g., Freelance Project, Engineering Advisory). |
| **`source`** | `TEXT` | No | Enumerated set | None | Entity category: Individual, Private, or Organisation. |
| **`amount`** | `NUMERIC(10, 2)`| No | Value boundary | None | Fixed-point currency; strictly constrained: 0 < amount <= 100,000. |
| **`utr`** | `TEXT` | Yes | Partial Unique | None | 12-digit Indian UPI banking reference; unique across non-failed records. |
| **`status`** | `TEXT` | No | State set check | `'pending'` | Finite State Machine (FSM) ledger state: pending, successful, failed, deleted. |
| **`notes`** | `TEXT` | Yes | Free text | `''` | Forensic notes, failure reasons, or administrative remarks. |
| **`verified_by`** | `TEXT` | Yes | Email check | `NULL` | Authenticated email address of the administrator who executed settlement. |
| **`verified_at`** | `TIMESTAMPTZ`| Yes | Timestamp check| `NULL` | Microsecond-precision UTC timestamp marking the exact moment of verification. |
| **`created_at`** | `TIMESTAMPTZ`| No | Timestamp check| `timezone('utc', now())`| Server-side immutable UTC timestamp recording initial record creation. |

---

### 2. Forensic Audit Log Table: `public.transaction_audit_logs`

| Column Identifier | PostgreSQL Datatype | Nullable | Primary Constraints | Default Assignment | Functional Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`id`** | `BIGINT` | No | Primary Key | `GENERATED ALWAYS AS IDENTITY` | Monotonic event sequence identifier. |
| **`verification_id`** | `TEXT` | No | Domain reference| None | Target transaction domain key. |
| **`action`** | `TEXT` | No | Non-empty label | None | Categorical action label (e.g., `STATUS_SUCCESSFUL`, `STATUS_FAILED`). |
| **`previous_status`**| `TEXT` | Yes | State capture | None | State of transaction prior to mutation. |
| **`new_status`** | `TEXT` | Yes | State capture | None | New state of transaction after mutation. |
| **`performed_by`** | `TEXT` | Yes | Cryptographic ID| None | Email address of the authenticated administrator. |
| **`notes`** | `TEXT` | Yes | Operator note | None | Mandatory explanation for declines or audits. |
| **`created_at`** | `TIMESTAMPTZ`| No | Timestamp check| `timezone('utc', now())`| Server-assigned UTC execution timestamp. |

---

### 3. Row-Level Security (RLS) Policy Specification Truth Matrix

| Policy Identifier | Target Operations | Permitted Roles | Evaluation Clause (Using) | Validation Gate (With Check) | Enforced Invariant |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Policy 1: Ingestion** | `INSERT` | `anon`, `authenticated` | N/A | `status = 'pending' AND amount > 0 AND amount <= 100000 AND verification_id IS NOT NULL` | Unauthenticated public clients can only initialize pending records within valid numerical thresholds. |
| **Policy 2: Querying** | `SELECT` | `anon` | `status != 'deleted'` | N/A | Payers can look up active and settled records; soft-deleted records are completely hidden. |
| **Policy 3: Reference** | `UPDATE` | `anon` | `status = 'pending'` | `status = 'pending'` | Anonymous clients can attach a UTR to pending rows, but cannot alter status to successful. |
| **Policy 4: Admin** | `ALL` | `authenticated` | `TRUE` | `TRUE` | Authenticated administrators holding valid JWT credentials possess full administrative ledger access. |

---

### 4. Database Trigger Execution & Anti-Tamper Specification

- **Trigger Name:** `trg_protect_transaction_financials`
- **Execution Event:** Before any SQL `UPDATE` operation executes on `public.transactions` (Row-Level).
- **Execution Mode:** Security Definer with explicit search path binding (`public, auth`).
- **Rule 1 (Financial Lock):** If the calling role is anonymous and any of `amount`, `name`, or `verification_id` differ between the existing tuple and the proposed tuple, raise an unhandled exception: *Financial fields are locked and cannot be altered*.
- **Rule 2 (Status Lock):** If the calling role is anonymous and the proposed `status` differs from the existing `status` and does not equal `'pending'`, raise an unhandled exception: *Unauthorized attempt to modify transaction status*.
- **Outcome:** The transaction is rolled back by the database engine, preserving ledger integrity.

---

# Appendix B: Security & Fraud Detection Algorithmic Specifications

### 1. Indian UPI 12-Digit UTR Heuristic Detection Algorithm

The reference validation engine processes user inputs across four sequential analytical stages:
1. **Stage 1 (Type & Length Sanitization):** Verifies that the input is a valid non-empty string. Strips surrounding whitespace. Evaluates against a 12-digit numeric regular expression requiring exactly twelve numeric digits (0 through 9).
2. **Stage 2 (Cyclic & Repeating Repetition):** Applies a back-reference regular expression capturing the leading digit and evaluating whether the following eleven characters are identical. Rejects sequences such as `000000000000` or `111111111111`.
3. **Stage 3 (Sequential Dummy Pattern Blacklist):** Compares the normalized string against known dummy sequences generated by mock payment applications:
   - Linear ascending sequences: `012345678901`, `123456789012`
   - Linear descending sequences: `987654321098`
   - Repetitive 6-digit blocks: `123456123456`
   - Leading-zero sequences: `000123456789`
   - Paired sequences: `112233445566`
4. **Stage 4 (Acceptance & Sanitized Return):** If all gates pass, the reference is marked as heuristically valid and passed to the ledger registration pipeline.

---

### 2. Indian Mobile Number Normalization Algorithm

1. **Stage 1 (Character Filtering):** Strips all international formatting glyphs, including whitespace, hyphens, brackets, and leading addition signs.
2. **Stage 2 (Prefix Normalization):** Inspects whether the sanitized string has a length of 12 and begins with the national country code `91`. If present, cleanly strips the leading `91`, isolating the 10-digit National Significant Number.
3. **Stage 3 (Regulatory Allocation Check):** Evaluates the 10-digit string against Department of Telecommunications (DoT) National Numbering Plan rules, verifying that the leading digit is strictly within the set {6, 7, 8, 9} and is followed by exactly nine numeric digits.

---

### 3. Dual-Hashing Receipt Seal Mathematical Model

The cryptographic seal generation operates across five formal deterministic transformations:

1. **Seed Construction:**
   ```
   Seed = v || "|" || a || "|" || u || "|" || t || "|" || K_salt
   ```
   *(where v = Verification ID, a = Amount, u = UTR, t = Verified Timestamp, K_salt = Static System Pepper, and || denotes string concatenation)*

2. **Accumulator Initialization:**
   ```
   h1_0 = 0xDEADBEEF XOR L
   h2_0 = 0x41C6CE57 XOR L
   ```
   *(where L = byte length of Seed)*

3. **Character Byte Iteration (for each character byte c_i):**
   ```
   h1_(i+1) = ((h1_i XOR c_i) * 2654435761) mod 2^32
   h2_(i+1) = ((h2_i XOR c_i) * 1597334677) mod 2^32
   ```

4. **Final Avalanche Bit-Mixing:**
   ```
   h1_prime = ((h1 XOR (h1 >> 16)) * 2246822507) XOR ((h2 XOR (h2 >> 13)) * 3266489909)
   h2_prime = ((h2 XOR (h2 >> 16)) * 2246822507) XOR ((h1 XOR (h1 >> 13)) * 3266489909)
   ```

5. **Deterministic Hexadecimal Seal Emission:**
   ```
   SEAL-[h1_prime[0..3]]-[h1_prime[4..7]]-[h2_prime[0..3]]
   ```
   *(producing a 16-character hyphenated uppercase hexadecimal string, e.g., SEAL-A7F2-9C4B-E180)*

---

# Appendix C: Dual-Sync Storage Engine & Network Protocol Specification

### 1. Dual-Write Asynchronous Ingestion Topology

When a transaction is created, the client execution engine dispatches concurrent persistence commands:
- **Stream 1 (Local Ephemeral):** Synchronously writes the full transaction entity to browser storage under the key `upi_payment_transactions`.
- **Stream 2 (Secondary Cloud Mirror):** Encodes fields into form entry identifiers and dispatches a background POST request to Google Forms in unconstrained cross-origin mode.
- **Stream 3 (Primary Relational):** Dispatches a structured JSON payload over TLS 1.3 to the Supabase REST endpoint.

---

### 2. Google Visualization (GViz) Dynamic Sheet Parsing Protocol

When operating in fallback status mode, the engine reads directly from Google Cloud Sheets:
1. Dispatches an HTTP GET request to the Google Visualization API endpoint:
   `https://docs.google.com/spreadsheets/d/[SHEET_ID]/gviz/tq?tqx=out:json`
2. Strips the JSONP encapsulation wrapper.
3. Applies regular expression pattern matching to identify table column headers regardless of physical column order:
   - Full Name matches regular expression: `full\s*name` or exact word `name`
   - Verification ID matches regular expression: `payment\s*id|verification\s*id`
   - UTR Reference matches regular expression: `upi\s*ref|utr|reference`
   - Monetary Amount matches regular expression: `amount`
   - Payment Status matches regular expression: `payment\s*status` or exact word `status`
4. Iterates rows in chronological order, deduplicating records by Verification ID and preserving the most recent settlement status.

---

# Appendix D: Verification Test Vectors & Heuristic Benchmark Matrices

### 1. UTR Heuristic Benchmark Test Suite

| Test Identifier | Input Vector | Expected Classification | Rationale & Gate Evaluated |
| :--- | :--- | :--- | :--- |
| **UTR-TEST-01** | `""` (Empty string) | Rejected | Fails Gate 1: Required string input. |
| **UTR-TEST-02** | `"12345"` | Rejected | Fails Gate 1: Truncated character length (< 12). |
| **UTR-TEST-03** | `"4102938475612"` | Rejected | Fails Gate 1: Excessive character length (> 12). |
| **UTR-TEST-04** | `"41029384ABCD"` | Rejected | Fails Gate 1: Contains non-numeric characters. |
| **UTR-TEST-05** | `"000000000000"` | Rejected | Fails Gate 2: Cyclic repetition of identical zero glyphs. |
| **UTR-TEST-06** | `"777777777777"` | Rejected | Fails Gate 2: Cyclic repetition of identical seven glyphs. |
| **UTR-TEST-07** | `"123456789012"` | Rejected | Fails Gate 3: Matches known ascending dummy sequence. |
| **UTR-TEST-08** | `"987654321098"` | Rejected | Fails Gate 3: Matches known descending dummy sequence. |
| **UTR-TEST-09** | `"410293847561"` | **Accepted** | Passes all gates: Authentic 12-digit Indian banking format. |
| **UTR-TEST-10** | `"629104857201"` | **Accepted** | Passes all gates: Authentic 12-digit Indian banking format. |

---

### 2. Amount Boundary Test Suite

| Test Identifier | Input Amount | Expected Result | Enforcement Boundary |
| :--- | :--- | :--- | :--- |
| **AMT-TEST-01** | `₹0.00` | Rejected | Enforces strictly positive balance rule (> 0). |
| **AMT-TEST-02** | `-₹500.00` | Rejected | Rejects negative numerical input. |
| **AMT-TEST-03** | `₹0.50` | Rejected | Enforces sub-rupee micro-transaction floor (>= INR 1.00). |
| **AMT-TEST-04** | `₹1,00,001.00` | Rejected | Enforces NPCI statutory ceiling (<= INR 1,00,000.00). |
| **AMT-TEST-05** | `₹5,000.00` | **Accepted** | Valid standard integer consulting payment. |
| **AMT-TEST-06** | `₹250.75` | **Accepted** | Valid fixed-point decimal payment with paise precision. |

---

# Appendix E: Comprehensive Bibliography & NPCI Standards Reference

1. **National Payments Corporation of India (NPCI).** (2016–2026). *Unified Payments Interface (UPI) System Specifications and API Architecture (v2.0 & v2.1)*. Mumbai, India.
2. **Reserve Bank of India (RBI).** (2020). *Guidelines on Regulation of Payment Aggregators and Payment Gateways (DPSS.CO.PD.No.1810/02.14.008/2019-20)*. Central Office, Mumbai.
3. **Ministry of Electronics and Information Technology (MeitY).** (2023). *The Digital Personal Data Protection Act, 2023 (Act No. 22 of 2023)*. The Gazette of India, New Delhi.
4. **Fowler, G., Noll, L. C., & Vo, P.** (1991). *The FNV Non-Cryptographic Hash Algorithm*. IETF Internet-Draft.
5. **Appleby, A.** (2011). *MurmurHash3 Algorithms and Bit-Mixing Verification*. SMHasher Project Repository.
6. **PostgreSQL Global Development Group.** (2026). *PostgreSQL 16.x Documentation: Chapter 41 (Row-Level Security) and Chapter 43 (Triggers)*.
7. **Internet Engineering Task Force (IETF).** (2015). *RFC 7519: JSON Web Token (JWT)*. Authored by M. Jones, J. Bradley, N. Sakimura.
8. **World Wide Web Consortium (W3C).** (2018). *Web Content Accessibility Guidelines (WCAG) 2.1*. W3C Recommendation.
"""
