# CLOAK — Credential-less Link for Online Auth & Keys

> **CLOAK** is an institutional-grade, privacy-first UPI payment and settlement verification platform equipped with a 5-layer anti-fraud security architecture.

---

## Security Layers

1. **Client-Side Hardening & Zero-Leak QR**: Local vector SVG QR code generation (`qrcode.react`), removing external API leaks of financial metadata. Strict 12-digit UTR validation with NPCI anti-spoof heuristic checks.
2. **Identity & Access Management**: Secure JWT token authentication powered by Supabase Auth with Row-Level Security (RLS).
3. **Database & API Integrity**: PostgreSQL RLS policies preventing unauthorized mutations, unique UTR constraint preventing replay/double-spending attacks, and database triggers locking financial amounts and verification IDs.
4. **Fraud Detection & Settlement Protocol**: The 3-Point Bank Cross-Check verification workflow (Exact Amount + Bank UTR Match + Timestamp Alignment).
5. **Data Privacy & Cryptographic Verification**: Masked PII on public receipts and status queries, coupled with a tamper-evident digital receipt fingerprint (HMAC-SHA-256 equivalent) and live scan-to-verify QR codes.

---

## Tech Stack

- **Frontend**: React 19, Vite
- **Database & Auth**: Supabase (PostgreSQL with Row Level Security, Supabase Auth)
- **Deployment**: GitHub Pages via GitHub Actions CI/CD
- **Design System**: Obsidian & Liquid Metal (Plus Jakarta Sans & JetBrains Mono)
