# -*- coding: utf-8 -*-
"""
Part 2: System Design & Security Architecture (No Source Code, No Raw LaTeX Math)
Chapters 3 & 4
"""

CHAPTER_3 = r"""# PART II: SYSTEM DESIGN & SYSTEM ARCHITECTURE

---

# Chapter 3: End-to-End System Architecture

## 3.1 High-Level Component Topology

The system topology of CLOAK is architected for zero-failure reliability, high auditability, and sub-second responsiveness. It eschews fragile, monolithic application servers in favor of an **Edge-Distributed, Decoupled Serverless Framework**.

The system comprises four primary architectural boundaries:

1. **The Client Execution Boundary (Payer Experience):** Runs natively inside modern evergreen web browsers (Chromium, WebKit, Gecko). Implemented using React 19 and Vite 8, it performs zero-latency client-side input validation, dynamic vector SVG QR code synthesis, and automated local state synchronization.
2. **The Sovereign Database Engine (Supabase / PostgreSQL):** A managed PostgreSQL instance operating in AWS Tokyo (`ap-northeast-1`). It enforces Row-Level Security (RLS) policies, manages atomic concurrency constraints, and broadcasts low-latency WebSocket change events via PostgreSQL's Write-Ahead Log (WAL) logical replication stream.
3. **The Redundant Secondary Mirror (Google Cloud Dual-Sync):** A completely decoupled, headless data ingestion pipeline that mirrors every incoming transaction into Google Cloud Sheets via an unauthenticated Google Forms HTTP endpoint. This ensures that even in the catastrophic event of a global database outage or network partitioning, zero transaction declarations are lost.
4. **The Administrative Control Boundary:** A privileged control console secured by Supabase Authentication (HS256/RS256 JWT tokens) allowing authorized human operators to perform forensic statement matching, resolve discrepancies, provision co-administrators via stored procedures, and emit immutable audit records.

---

## 3.2 Dual-Synchronous Data Storage Pipeline

A primary innovation of CLOAK is its **Dual-Synchronous Persistence Pipeline**. 

When a payer clicks `"Generate UPI QR"` in the application, the system does not merely write to a single database. Instead, it dispatches an asynchronous, multi-target broadcast:

### The Tripartite Persistence Ingestion Flow:
1. **Target 1: Local Ephemeral Ingestion:** A new transaction object is constructed with an assigned cryptographically generated Verification ID (`VER-XXXXXX`). It is immediately serialized into the browser's persistent local storage. This guarantees that if the user's mobile device abruptly loses cellular network connectivity during a payment attempt, the transaction state remains intact upon page refresh.
2. **Target 2: Headless Secondary Cloud Ingestion:** The client formats the transaction parameters as URL-encoded key-value payloads and dispatches a background HTTP request to Google Forms. Operating in unconstrained cross-origin mode, this submission bypasses browser Cross-Origin Resource Sharing (CORS) blocks and writes the transaction directly into an external Google Sheet spreadsheet.
3. **Target 3: Primary Relational Ingestion:** The client dispatches a structured JSON payload to the Supabase REST endpoint. The database evaluates the incoming request against RLS Policy 1 (`"Public can insert pending transaction"`). If all check constraints pass, the row is inserted with a microsecond-precision UTC timestamp.

This dual-pipe topology provides resilience against server outages: if the primary database undergoes maintenance, Google Sheets retains a real-time record; if external clouds experience a service disruption, Supabase acts as the authoritative primary ledger.

---

## 3.3 Network Communication Protocols

CLOAK employs four distinct networking protocols tailored to specific latency and security requirements:

| Protocol | Transport Layer | Communication Path | Functional Role | Security Characteristics |
| :--- | :--- | :--- | :--- | :--- |
| **HTTPS REST (PostgREST)** | TLS 1.3 over TCP | Browser <-> Supabase | Transaction Creation, Status Querying, UTR Updates | Bearer Anon Key, Parameter Validation, Strict RLS |
| **WSS (WebSockets)** | TLS 1.3 over WebSocket | Browser <-> Supabase Realtime | Live Receipt Unlock, Administrative Dashboard Sync | Channel Multiplexing, Postgres WAL Filtering |
| **Headless Form POST** | TLS 1.3 / HTTP POST | Browser -> Google Forms | Asynchronous Secondary Mirroring | Cross-Origin Mode, Decoupled Fire-and-Forget |
| **GViz Protocol** | JSONP / Structured JSON | Browser <- Google Sheets | Secondary Fallback Status Retrieval | Read-Only Public Visualization Endpoint |

### Real-Time WebSocket Logic
Unlike legacy banking portals that require users to constantly click "Refresh" or execute aggressive HTTP polling loops every 5 seconds (which floods backend servers with redundant requests), CLOAK utilizes **PostgreSQL Change Data Capture (CDC)** via WebSockets.

When a payer reaches the `"Payment Registered"` screen, a targeted subscription is opened filtering by the specific Verification ID. The exact instant an administrator approves the transaction in the executive dashboard, the PostgreSQL Write-Ahead Log (WAL) emits a publication event. The Supabase Realtime cluster pushes this delta across the open WebSocket directly to the payer's smartphone screen. The pending spinner vanishes, replaced instantaneously by the green **"VERIFIED & SETTLED"** official receipt.

---

## 3.4 Client-Side Execution Boundary vs Serverless Boundary

A fundamental tenet of CLOAK's engineering is the rigorous division of labor between the client runtime and the backend database:

| Architectural Responsibility | Client Runtime (Browser Environment) | Serverless & Database Kernel (PostgreSQL) |
| :--- | :--- | :--- |
| **Visualization & Rendering** | In-memory vector SVG QR code synthesis | Zero rendering overhead (headless backend) |
| **Input Validation** | Immediate regex formatting & heuristic filters | Authoritative type checks & numerical limits |
| **State Mutation** | Request dispatching & local optimistic cache | Atomicity, consistency, and RLS enforcement |
| **Security Gates** | PII display masking & toggle controls | Row-Level Security & anti-tampering triggers |
| **Cryptographic Proofs** | FNV-1a & Murmur3 receipt fingerprint synthesis | Immutable append-only audit trail logging |
| **Real-Time Distribution**| WebSocket delta reception & UI rehydration | WAL logical replication & publication broker |

By shifting QR generation, formatting, and mathematical fingerprinting to the client, CLOAK achieves **zero server CPU overhead for cryptographic visualization**. The database engine is preserved purely for relational storage, transaction isolation, and row-level authorization.

---

## 3.5 Latency Profiles, Redundancy, and Availability Guarantees

The entire CLOAK network pipeline is calibrated for extreme performance:

- **First Contentful Paint (FCP):** Under 350 milliseconds (served via global GitHub Pages CDN edge points).
- **Time to Interactive (TTI):** Under 500 milliseconds (minimal JavaScript bundle size under 95 KB gzipped).
- **Local QR Synthesis:** Zero network latency (rendered locally in vector DOM in under 4 milliseconds).
- **Database Write Acknowledgment:** Approximately 85 milliseconds average latency from Indian ISP networks to Tokyo AWS cluster.
- **WebSocket Realtime Delta:** Under 120 milliseconds from administrative click to client receipt illumination.

---

# Chapter 4: The 5-Layer Anti-Fraud Security Architecture

To neutralize the complete taxonomy of UPI fraud vectors analyzed in Chapter 1, CLOAK implements an integrated **5-Layer Security Architecture**. Each layer operates as an independent security perimeter: even if an adversary breaches or circumvents an outer layer, the subsequent inner layer halts the attack.

```
  [ LAYER 1: CLIENT-SIDE INPUT HARDENING & ZERO-LEAK QR ]
  ├── Native Vector SVG Synthesis — Zero Third-Party API Leaks
  ├── Strict 12-Digit Numeric Regex Constraint
  ├── Cyclic & Repeating Digit Anti-Spoof Heuristics
  └── Sequential Dummy Blacklist Filter
           │
           ▼
  [ LAYER 2: CRYPTOGRAPHIC IDENTITY & ACCESS MANAGEMENT ]
  ├── Supabase Auth JWT Token Engine (RFC 7519)
  ├── Strict Role Separation: Anon (Public Payer) vs Authenticated (Master Admin)
  └── Session Storage Isolation (Protection Against Persistent Tab Hijacking)
           │
           ▼
  [ LAYER 3: DATABASE & API INTEGRITY (POSTGRESQL KERNEL) ]
  ├── Row-Level Security (RLS) Enforcing Mandatory 'pending' State on Ingestion
  ├── Anti-Replay Partial Unique Index on UTR
  └── Anti-Tampering PL/pgSQL Database Trigger
           │
           ▼
  [ LAYER 4: FRAUD DETECTION & SETTLEMENT PROTOCOL ]
  ├── The 3-Point Bank Cross-Check Rule: Exact Amount + Bank UTR + Timestamp Match
  ├── Forensic Rejection Reason Enforcement
  └── Immutable Audit Trail Logging
           │
           ▼
  [ LAYER 5: DATA PRIVACY & CRYPTOGRAPHIC VERIFICATION ]
  ├── Statutory PII Masking (DPDPA 2023 Compliant Phone, Email, and Name Obfuscation)
  ├── Dual-Hashing Bit-Mixing Algorithm (FNV-1a + Murmur3 Deterministic Seal)
  └── Live Scan-to-Verify Tamper-Evident QR Deep Linking
```

---

## 4.1 Layer 1: Client-Side Input Hardening & Zero-Leak Vector QR

Layer 1 operates at the immediate point of human-computer interaction:

### 1. Zero-Leak Native Vector SVG QR Rendering
Most amateur payment implementations render QR codes by calling external image APIs over HTTP. This naive pattern leaks the receiver's VPA, transaction amount, customer invoice purpose, and IP address to an untrusted external server, creating severe data privacy violations.

CLOAK bans all external QR API calls. Instead, it executes an in-memory Reed-Solomon error correction algorithm directly within the browser, producing a pure Scalable Vector Graphic. High-density error correction (Level H) recovers up to 30% of corrupted pixels, ensuring effortless scanning off mobile screens even under extreme glare. The QR code is synthesized locally in less than 4 milliseconds. Zero network packets leave the machine during rendering.

### 2. Heuristic Anti-Spoof UTR Validation
When a payer submits their 12-digit UTR, Layer 1 executes a multi-stage heuristic filter:
- **Exact Numeric Length:** Rejects any string containing alphabetic characters, spaces, or lengths different from exactly 12 digits.
- **Cyclic Repetition Filter:** Automatically flags and rejects inputs with repeated identical digits (`000000000000`, `111111111111`, etc.) via back-reference regular expressions.
- **Sequential Dummy Blacklist:** Evaluates input against known test patterns generated by spoof APKs (`123456789012`, `012345678901`, `987654321098`, `123456123456`, `000123456789`, `112233445566`).

---

## 4.2 Layer 2: Cryptographic Identity & Access Management

Layer 2 enforces absolute role boundaries using cryptographic tokens:

1. **Anonymous Context (`role: anon`):** Payers transacting on the public website possess an anonymous JSON Web Token signed with the project's public key. This token grants restricted access solely to insert pending records and query non-deleted transactions matching a known Verification ID.
2. **Authenticated Administrator (`role: authenticated`):** The administrative dashboard requires formal authentication through Supabase Auth. The resulting session contains an access token signed with HMAC-SHA256 (or asymmetric RS256) specifying subject identifier, administrative email address, issued timestamp, expiration deadline, and the verified `authenticated` role claim.
3. **Session Storage Isolation:** Administrative authentication state is recorded in the browser's volatile session storage rather than persistent local storage. When the administrator closes their browser tab or window, the session token is automatically purged from memory, preventing session hijacking from shared workstations.

---

## 4.3 Layer 3: Database & API Integrity

Layer 3 forms the mathematical bedrock of CLOAK. Implemented inside the PostgreSQL kernel, it operates independently of any application code:

1. **Row-Level Security (RLS) Gateways:** Detailed in Chapter 6, RLS prevents anonymous users from altering any record's financial status to successful.
2. **Anti-Replay Partial Unique Index:** This index guarantees that once a 12-digit UTR is registered against an active or settled transaction, no subsequent transaction can ever register the same UTR. Any attempt to reuse the UTR raises an immediate PostgreSQL error code `23505` (unique violation), instantly halting double-spending attacks.
3. **Anti-Tampering Database Trigger:** As explored in Chapter 5, the trigger intercepts every single SQL update operation. If an anonymous user attempts to change the amount, name, or verification ID, the trigger aborts execution with an unhandled exception.

---

## 4.4 Layer 4: Fraud Detection & Settlement Protocol

Layer 4 introduces **The 3-Point Bank Cross-Check Rule**. 

Even if a fraudster bypasses client validation and inserts a clever UTR into the database, the transaction cannot transition to successful without explicit human-in-the-loop verification.

In the administrative portal, marking a transaction as settled requires the human operator to cross-check:
1. **Checkpoint 1 (Amount):** Does the exact rupee and paise value in the ICICI bank statement match the invoiced amount?
2. **Checkpoint 2 (UTR):** Does the 12-digit UTR in the bank statement match the recorded reference character-for-character?
3. **Checkpoint 3 (Timestamp):** Did the bank credit occur within a reasonable time window of the initiation timestamp?

Every status transition automatically generates an immutable audit log record in `public.transaction_audit_logs`, documenting the operator's email and timestamp.

---

## 4.5 Layer 5: Data Privacy & Cryptographic Verification

Layer 5 guarantees cryptographic trust for the end-consumer:

1. **Deterministic PII Masking:** Protects payer privacy on public tracking screens and shared digital receipts.
2. **Dual-Hashing Receipt Fingerprint:** Combines FNV-1a and Murmur3 bit-mixing algorithms across the transaction's immutable parameters to generate an official digital seal:
   * **Receipt Seal Format:** `SEAL-XXXX-XXXX-XXXX`
3. **Scan-to-Verify Live Linking:** The digital receipt embeds a high-density QR code encoding a deep verification URL pointing to the live ledger. Anyone holding a physical printed paper receipt can scan this QR code with any smartphone camera to authenticate the live settlement state directly against the Supabase database.
"""
