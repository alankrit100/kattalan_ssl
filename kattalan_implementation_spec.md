# Kattalan — AI Build Specification
> Version 1.0 | For use with AI coding models (Codex, Claude Code, Cursor, etc.)
> This document is the single source of truth for building Kattalan phase by phase.
> The model must not deviate from this spec unless explicitly instructed by the human.

---

## Table of Contents
1. [Product Overview](#1-product-overview)
2. [Tech Stack](#2-tech-stack)
3. [Environment Variables](#3-environment-variables)
4. [Data Models & Firestore Schema](#4-data-models--firestore-schema)
5. [Directory & File Structure](#5-directory--file-structure)
6. [API Routes — Flowcharts & Contracts](#6-api-routes--flowcharts--contracts)
7. [Service Layer — Logic Diagrams](#7-service-layer--logic-diagrams)
8. [GitHub Actions — Cron Job Design](#8-github-actions--cron-job-design)
9. [Email System](#9-email-system)
10. [Phase-by-Phase Build Plan](#10-phase-by-phase-build-plan)
11. [Health Check Log System](#11-health-check-log-system)
12. [Security Rules & Constraints](#12-security-rules--constraints)
13. [Edge Cases the Model Must Handle](#13-edge-cases-the-model-must-handle)
14. [What the Model Must Never Do](#14-what-the-model-must-never-do)

---

## 1. Product Overview

**Product name:** Kattalan
**Tagline:** Your website's weekly health report.
**Core value:** Peace-of-mind monitoring for freelancers and small agencies managing multiple websites. Not a DevOps tool — a calm, minimal weekly briefing.

### What Kattalan Does (MVP Scope — Strict)

| Feature | Included |
|---|---|
| User authentication (email + Google) | ✅ |
| Add / remove monitored sites | ✅ |
| SSL certificate expiry monitoring | ✅ |
| Domain expiry monitoring | ✅ |
| Instant email alerts (SSL/domain critical) | ✅ |
| Weekly digest email (every Monday 8am UTC) | ✅ |
| Minimal dashboard UI | ✅ |
| Health check run log | ✅ |
| Uptime monitoring | ❌ |
| Stripe billing | ❌ |
| Redis / Bull Queue | ❌ |
| Teams / multi-user | ❌ |
| Graphs / historical analytics | ❌ |
| Status pages | ❌ |

### User Personas
- **Freelancer:** manages 3–10 client websites, wants to know if anything is broken before the client notices
- **Small agency:** manages 10–30 sites, wants a clean weekly summary to share or review internally

---

## 2. Tech Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Frontend framework | Next.js | 15 (App Router) | Use server components where possible |
| UI components | shadcn/ui + Tailwind CSS | Latest | Use shadcn CLI to add components |
| Auth | Firebase Authentication | v10 SDK | Email/password + Google OAuth |
| Database | Firestore | v10 SDK | NoSQL; use Admin SDK server-side only |
| Email sending | Resend | Latest | react-email for templates |
| Scheduled jobs | GitHub Actions | — | Cron syntax; see Section 8 |
| Hosting | Vercel | — | Auto-deploy from main branch |
| Validation | Zod | v3 | Shared schemas across client and server |
| Language | TypeScript | 5.x | Strict mode enabled |
| Package manager | pnpm | v9 | Use pnpm workspaces |
| SSL checking | ssl-checker | npm | + tls.connect() fallback |
| WHOIS / domain | whois npm | Latest | + Domainr API fallback |
| Logging | Console (structured JSON) | — | No external logger for MVP |

### Constraints
- No Express server. All API logic lives in Next.js Route Handlers (`app/api/`)
- No persistent Node process. All background work runs via GitHub Actions
- Firebase Admin SDK is used **only** in server-side code (Route Handlers, GitHub Actions scripts)
- Firebase client SDK is used **only** in browser-side code

---

## 3. Environment Variables

The model must generate a `.env.example` file at the repo root. The model must **never** hardcode values. Every env var must have a comment explaining what it is and where to get it.

```bash
# .env.example
# Copy this file to .env.local and fill in values
# NEVER commit .env.local to git

# ─── Firebase Client SDK (public — safe to expose in browser) ───────────────
NEXT_PUBLIC_FIREBASE_API_KEY=           # Firebase Console > Project Settings > Web App
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=       # e.g. kattalan-prod.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=        # e.g. kattalan-prod
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=    # e.g. kattalan-prod.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# ─── Firebase Admin SDK (secret — server-side only, NEVER in browser) ────────
FIREBASE_ADMIN_PROJECT_ID=              # Same as NEXT_PUBLIC_FIREBASE_PROJECT_ID
FIREBASE_ADMIN_CLIENT_EMAIL=            # Firebase Console > Service Account > Generate key
FIREBASE_ADMIN_PRIVATE_KEY=             # Paste full key including -----BEGIN/END----- lines

# ─── Resend (email sending) ───────────────────────────────────────────────────
RESEND_API_KEY=                         # Resend dashboard > API Keys
RESEND_FROM_EMAIL=                      # e.g. alerts@kattalan.com (must be verified domain)

# ─── GitHub Actions (used in cron job scripts only) ──────────────────────────
# These are set as GitHub Actions Secrets, not in .env.local
# FIREBASE_ADMIN_PROJECT_ID      → same value as above
# FIREBASE_ADMIN_CLIENT_EMAIL    → same value as above
# FIREBASE_ADMIN_PRIVATE_KEY     → same value as above
# RESEND_API_KEY                 → same value as above
# RESEND_FROM_EMAIL              → same value as above

# ─── App config ──────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=                    # e.g. https://kattalan.com (no trailing slash)
CRON_SECRET=                            # Random 32-char string — used to secure manual trigger endpoint
```

### Where each variable is used

| Variable | Used in |
|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | `lib/firebase-client.ts` — browser auth |
| `FIREBASE_ADMIN_*` | `lib/firebase-admin.ts` — all Route Handlers |
| `RESEND_API_KEY` | `lib/email.ts` + GitHub Actions scripts |
| `RESEND_FROM_EMAIL` | `lib/email.ts` + GitHub Actions scripts |
| `NEXT_PUBLIC_APP_URL` | Email templates (unsubscribe links, dashboard links) |
| `CRON_SECRET` | `/api/cron/trigger` route — manual run endpoint |

---

## 4. Data Models & Firestore Schema

### Collections Structure

```
firestore/
├── users/
│   └── {userId}/                        # Document ID = Firebase Auth UID
│       ├── email: string
│       ├── displayName: string
│       ├── createdAt: Timestamp
│       ├── alertsEnabled: boolean        # Master toggle for all email alerts
│       ├── digestEnabled: boolean        # Toggle for weekly digest
│       └── plan: "free"                  # Always "free" for MVP
│
└── users/{userId}/
    ├── sites/
    │   └── {siteId}/                     # Auto-generated Firestore ID
    │       ├── url: string               # Normalized: https://example.com (no trailing slash)
    │       ├── label: string             # Display name, user-defined
    │       ├── addedAt: Timestamp
    │       ├── lastCheckedAt: Timestamp | null
    │       │
    │       ├── ssl: {
    │       │   ├── status: "valid" | "expiring_soon" | "expired" | "error" | "unknown"
    │       │   ├── daysUntilExpiry: number | null
    │       │   ├── expiresAt: Timestamp | null
    │       │   ├── issuer: string | null
    │       │   └── lastCheckedAt: Timestamp | null
    │       │ }
    │       │
    │       ├── domain: {
    │       │   ├── status: "valid" | "expiring_soon" | "expired" | "error" | "unknown"
    │       │   ├── daysUntilExpiry: number | null
    │       │   ├── expiresAt: Timestamp | null
    │       │   ├── registrar: string | null
    │       │   └── lastCheckedAt: Timestamp | null
    │       │ }
    │       │
    │       └── alertsSent: {
    │           ├── ssl_30d: boolean
    │           ├── ssl_14d: boolean
    │           ├── ssl_7d: boolean
    │           ├── ssl_expired: boolean
    │           ├── domain_30d: boolean
    │           ├── domain_14d: boolean
    │           ├── domain_7d: boolean
    │           └── domain_expired: boolean
    │         }
    │
    └── cronLogs/
        └── {logId}/                      # Auto-generated
            ├── runAt: Timestamp
            ├── trigger: "scheduled" | "manual"
            ├── jobType: "ssl_check" | "domain_check" | "weekly_digest"
            ├── status: "started" | "completed" | "failed"
            ├── sitesProcessed: number
            ├── alertsSent: number
            ├── errors: string[]           # Array of error messages if any
            └── durationMs: number
```

### Zod Schemas (shared — `packages/shared/schemas.ts`)

```typescript
// All Zod schemas the model must implement

import { z } from "zod"
import { Timestamp } from "firebase-admin/firestore"

// ─── URL normalization ────────────────────────────────────────────────────────
export const normalizeUrl = (raw: string): string => {
  const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`)
  return `${url.protocol}//${url.hostname}` // strip path, trailing slash, port if standard
}

// ─── Blocked IP ranges (SSRF protection) ─────────────────────────────────────
export const BLOCKED_HOSTNAMES = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "169.254.169.254", // AWS metadata
  "metadata.google.internal",
]
export const BLOCKED_IP_PREFIXES = ["10.", "172.16.", "172.17.", "172.18.", "172.19.",
  "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.", "172.26.", "172.27.",
  "172.28.", "172.29.", "172.30.", "172.31.", "192.168."]

// ─── Add site input ────────────────────────────────────────────────────────────
export const AddSiteSchema = z.object({
  url: z.string()
    .min(1, "URL is required")
    .transform(normalizeUrl)
    .refine((url) => {
      try {
        const parsed = new URL(url)
        const host = parsed.hostname
        if (BLOCKED_HOSTNAMES.includes(host)) return false
        if (BLOCKED_IP_PREFIXES.some(prefix => host.startsWith(prefix))) return false
        return true
      } catch { return false }
    }, "Invalid or private URL"),
  label: z.string().min(1).max(100).trim(),
})

// ─── Site status types ─────────────────────────────────────────────────────────
export const SslStatusSchema = z.enum(["valid", "expiring_soon", "expired", "error", "unknown"])
export const DomainStatusSchema = z.enum(["valid", "expiring_soon", "expired", "error", "unknown"])

// ─── Cron log ─────────────────────────────────────────────────────────────────
export const CronLogSchema = z.object({
  jobType: z.enum(["ssl_check", "domain_check", "weekly_digest"]),
  trigger: z.enum(["scheduled", "manual"]),
  status: z.enum(["started", "completed", "failed"]),
  sitesProcessed: z.number().default(0),
  alertsSent: z.number().default(0),
  errors: z.array(z.string()).default([]),
  durationMs: z.number().default(0),
})

export type AddSiteInput = z.infer<typeof AddSiteSchema>
export type CronLog = z.infer<typeof CronLogSchema>
```

### Free Tier Limits

```typescript
// lib/constants.ts
export const PLAN_LIMITS = {
  free: {
    maxSites: 10,       // MVP: generous free tier to maximize signups
  }
} as const

export const ALERT_THRESHOLDS = {
  ssl: [30, 14, 7],     // Alert at these many days before expiry
  domain: [30, 14, 7],  // Alert at these many days before expiry
} as const
```

---

## 5. Directory & File Structure

```
kattalan/
│
├── .github/
│   └── workflows/
│       ├── ssl-check.yml              # Runs every 6 hours
│       ├── domain-check.yml           # Runs every 6 hours (offset by 1h from ssl)
│       └── weekly-digest.yml          # Runs every Monday at 08:00 UTC
│
├── apps/
│   └── web/                           # Next.js 15 application
│       │
│       ├── app/
│       │   ├── (auth)/
│       │   │   ├── login/
│       │   │   │   └── page.tsx
│       │   │   └── signup/
│       │   │       └── page.tsx
│       │   │
│       │   ├── (dashboard)/
│       │   │   ├── layout.tsx         # Auth-protected layout
│       │   │   ├── page.tsx           # Dashboard home — site list + status cards
│       │   │   └── settings/
│       │   │       └── page.tsx       # Alert preferences, account info
│       │   │
│       │   ├── api/
│       │   │   ├── sites/
│       │   │   │   ├── route.ts       # GET (list), POST (add site)
│       │   │   │   └── [siteId]/
│       │   │   │       └── route.ts   # DELETE (remove site)
│       │   │   ├── auth/
│       │   │   │   └── verify/
│       │   │   │       └── route.ts   # POST — verify Firebase token, return user record
│       │   │   ├── cron/
│       │   │   │   ├── ssl/
│       │   │   │   │   └── route.ts   # POST — triggered by GitHub Actions
│       │   │   │   ├── domain/
│       │   │   │   │   └── route.ts   # POST — triggered by GitHub Actions
│       │   │   │   └── digest/
│       │   │   │       └── route.ts   # POST — triggered by GitHub Actions
│       │   │   └── health/
│       │   │       └── route.ts       # GET — public health check endpoint
│       │   │
│       │   ├── layout.tsx             # Root layout (fonts, metadata)
│       │   └── page.tsx               # Landing page
│       │
│       ├── components/
│       │   ├── ui/                    # shadcn/ui auto-generated components
│       │   ├── auth/
│       │   │   ├── LoginForm.tsx
│       │   │   └── SignupForm.tsx
│       │   ├── dashboard/
│       │   │   ├── SiteCard.tsx       # Per-site status card
│       │   │   ├── SiteList.tsx       # Grid of SiteCards
│       │   │   ├── AddSiteModal.tsx   # Modal with URL + label inputs
│       │   │   ├── StatusBadge.tsx    # "Valid" / "Expiring" / "Expired" badge
│       │   │   └── EmptyState.tsx     # Shown when user has no sites
│       │   └── landing/
│       │       ├── Hero.tsx
│       │       ├── Features.tsx
│       │       └── Pricing.tsx        # Simple free tier card (no billing yet)
│       │
│       ├── lib/
│       │   ├── firebase-client.ts     # Firebase client SDK (browser only)
│       │   ├── firebase-admin.ts      # Firebase Admin SDK (server only)
│       │   ├── email.ts               # Resend client + send helpers
│       │   ├── ssl.ts                 # SSL check logic
│       │   ├── domain.ts              # Domain/WHOIS check logic
│       │   ├── auth-middleware.ts     # verifyToken() helper for Route Handlers
│       │   ├── constants.ts           # PLAN_LIMITS, ALERT_THRESHOLDS
│       │   └── utils.ts               # normalizeUrl, formatDate, etc.
│       │
│       ├── hooks/
│       │   ├── useAuth.ts             # Firebase auth state hook
│       │   └── useSites.ts            # Fetch + mutate sites via API
│       │
│       ├── emails/
│       │   ├── AlertEmail.tsx         # react-email: SSL/domain alert template
│       │   └── DigestEmail.tsx        # react-email: weekly digest template
│       │
│       ├── scripts/                   # Standalone Node scripts run by GitHub Actions
│       │   ├── run-ssl-check.ts
│       │   ├── run-domain-check.ts
│       │   └── run-weekly-digest.ts
│       │
│       ├── middleware.ts              # Next.js middleware — route protection
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── package.json
│
├── .env.example                       # All env vars with comments — NO values
├── .gitignore                         # Must include .env.local
├── package.json                       # pnpm workspace root
├── pnpm-workspace.yaml
└── tsconfig.base.json                 # Shared TS config
```

---

## 6. API Routes — Flowcharts & Contracts

### Auth Middleware (used by all protected routes)

```
Every protected Route Handler must call verifyToken() before any logic:

Request arrives
      │
      ▼
Extract Authorization header
      │
      ├── Missing? → 401 { error: "Missing token" }
      │
      ▼
firebase-admin.auth().verifyIdToken(token)
      │
      ├── Throws? → 401 { error: "Invalid token" }
      │
      ▼
Extract uid from decoded token
      │
      ▼
Pass uid to route handler logic
```

```typescript
// lib/auth-middleware.ts
import { adminAuth } from "./firebase-admin"
import { NextRequest } from "next/server"

export async function verifyToken(req: NextRequest): Promise<string> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("UNAUTHORIZED")
  }
  const token = authHeader.split("Bearer ")[1]
  const decoded = await adminAuth.verifyIdToken(token)
  return decoded.uid
}
```

---

### GET /api/sites

```
Flow:
  verifyToken(req) → uid
        │
        ▼
  Firestore: query users/{uid}/sites ordered by addedAt desc
        │
        ▼
  Return array of site documents (serialize Timestamps to ISO strings)
        │
        ▼
  200 { sites: Site[] }
```

**Response shape:**
```typescript
type SiteResponse = {
  id: string
  url: string
  label: string
  addedAt: string          // ISO string
  lastCheckedAt: string | null
  ssl: {
    status: SslStatus
    daysUntilExpiry: number | null
    expiresAt: string | null
    issuer: string | null
    lastCheckedAt: string | null
  }
  domain: {
    status: DomainStatus
    daysUntilExpiry: number | null
    expiresAt: string | null
    registrar: string | null
    lastCheckedAt: string | null
  }
}
```

---

### POST /api/sites

```
Flow:
  verifyToken(req) → uid
        │
        ▼
  Parse + validate body with AddSiteSchema (Zod)
        │
        ├── Validation fails? → 400 { error: "...", issues: ZodIssue[] }
        │
        ▼
  Count existing sites: users/{uid}/sites
        │
        ├── Count >= PLAN_LIMITS.free.maxSites?
        │         → 403 { error: "Site limit reached", limit: 10 }
        │
        ▼
  Check for duplicate URL in user's sites
        │
        ├── Duplicate found? → 409 { error: "Site already monitored" }
        │
        ▼
  Create Firestore document with initialized ssl/domain/alertsSent fields
        │
        ▼
  201 { site: SiteResponse }
```

**Request body:**
```typescript
{ url: string, label: string }
```

---

### DELETE /api/sites/[siteId]

```
Flow:
  verifyToken(req) → uid
        │
        ▼
  Verify document users/{uid}/sites/{siteId} exists
        │
        ├── Not found? → 404 { error: "Site not found" }
        │
        ▼
  Delete document
        │
        ▼
  200 { success: true }
```

---

### POST /api/cron/ssl  |  POST /api/cron/domain  |  POST /api/cron/digest

```
Flow (same pattern for all three):

  Verify CRON_SECRET header
        │
        ├── Missing or wrong? → 401 { error: "Unauthorized" }
        │
        ▼
  Call corresponding script logic (ssl / domain / digest)
  (This route is just an HTTP wrapper — actual logic is in scripts/)
        │
        ▼
  202 { accepted: true, jobType: "..." }

NOTE: The route returns 202 immediately and runs the job asynchronously.
      Job result is written to cronLogs collection by the script itself.
```

**Cron secret verification:**
```typescript
// At top of every cron route handler
const secret = req.headers.get("x-cron-secret")
if (secret !== process.env.CRON_SECRET) {
  return Response.json({ error: "Unauthorized" }, { status: 401 })
}
```

---

### GET /api/health

```
Public endpoint — no auth required.

Returns:
  200 {
    status: "ok",
    timestamp: ISO string,
    version: "1.0.0"
  }
```

---

## 7. Service Layer — Logic Diagrams

### SSL Check Service (`lib/ssl.ts`)

```
checkSsl(url: string) → SslCheckResult

      Parse hostname from url
              │
              ▼
      Attempt ssl-checker(hostname)
              │
              ├── Success → extract daysRemaining, validTo, issuer
              │
              └── Throws → attempt tls.connect() fallback
                                │
                                ├── Success → parse cert manually
                                │
                                └── Throws → return { status: "error", ... }
              │
              ▼
      Map daysRemaining to status:
        daysRemaining <= 0   → "expired"
        daysRemaining <= 30  → "expiring_soon"
        otherwise            → "valid"
              │
              ▼
      Return SslCheckResult {
        status, daysUntilExpiry, expiresAt, issuer
      }

─────────────────────────────────────────────────────
type SslCheckResult = {
  status: "valid" | "expiring_soon" | "expired" | "error" | "unknown"
  daysUntilExpiry: number | null
  expiresAt: Date | null
  issuer: string | null
}
```

### Domain Check Service (`lib/domain.ts`)

```
checkDomain(url: string) → DomainCheckResult

      Parse hostname from url
              │
              ▼
      Strip subdomain → get root domain
      (e.g. blog.example.com → example.com)
              │
              ▼
      Attempt whois(rootDomain)
              │
              ├── Returns expiry date → parse it
              │
              └── Returns no date (GDPR masked / unusual TLD)
                        │
                        └── Attempt Domainr API fallback
                                  │
                                  ├── Returns data → parse it
                                  │
                                  └── No data → return { status: "unknown" }
              │
              ▼
      Calculate daysUntilExpiry from today
              │
              ▼
      Map to status:
        daysUntilExpiry <= 0   → "expired"
        daysUntilExpiry <= 30  → "expiring_soon"
        otherwise              → "valid"
              │
              ▼
      Return DomainCheckResult {
        status, daysUntilExpiry, expiresAt, registrar
      }
```

### Alert Decision Service (inside cron scripts)

```
shouldSendAlert(site, checkType, daysUntilExpiry) → boolean

      checkType = "ssl" | "domain"
              │
              ▼
      Read site.alertsSent[checkType + threshold]
              │
      For each threshold in [7, 14, 30]:
              │
              ├── daysUntilExpiry <= threshold
              │   AND alertsSent[`${checkType}_${threshold}d`] === false
              │         │
              │         └── → return true (send alert for this threshold)
              │
              └── daysUntilExpiry <= 0
                  AND alertsSent[`${checkType}_expired`] === false
                        │
                        └── → return true (send "expired" alert)
              │
              ▼
      No condition matched → return false (do not send)

After sending alert: update alertsSent flag to true in Firestore.

RESET LOGIC: When a new certificate is detected (expiresAt changed),
reset ALL alertsSent flags for that checkType to false.
```

### Master Cron Script Flow (`scripts/run-ssl-check.ts`)

```
START
  │
  ▼
Initialize Firebase Admin SDK from env vars
  │
  ▼
Write cronLog: { status: "started", jobType: "ssl_check", trigger, runAt }
  │
  ▼
Query ALL users from Firestore (users collection)
  │
  ▼
For each user:
  │
  ├── Query users/{uid}/sites
  │
  └── For each site:
        │
        ├── checkSsl(site.url)
        │
        ├── Update site.ssl fields in Firestore
        │
        ├── Update site.lastCheckedAt
        │
        └── shouldSendAlert()?
              │
              ├── YES → sendAlertEmail(user.email, site, result)
              │         Update site.alertsSent flag
              │         Increment alertsSent counter
              │
              └── NO  → continue
  │
  ▼
Write cronLog update: {
  status: "completed",
  sitesProcessed: N,
  alertsSent: N,
  durationMs: N,
  errors: []
}
  │
  ▼
END

ON ANY UNHANDLED ERROR:
  → Write cronLog: { status: "failed", errors: [error.message] }
  → process.exit(1)  (GitHub Actions marks job as failed)
```

---

## 8. GitHub Actions — Cron Job Design

### Important Known Limitation
GitHub Actions scheduled jobs can drift by 15–30 minutes. Jobs may be skipped if the repo has no pushes for 60 days. This is documented to the user. Mitigation: the manual trigger endpoint exists for verification.

### ssl-check.yml

```yaml
# .github/workflows/ssl-check.yml
name: SSL Certificate Check

on:
  schedule:
    - cron: '0 */6 * * *'   # Every 6 hours: 00:00, 06:00, 12:00, 18:00 UTC
  workflow_dispatch:          # Allow manual trigger from GitHub UI

jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run SSL check
        working-directory: apps/web
        env:
          FIREBASE_ADMIN_PROJECT_ID: ${{ secrets.FIREBASE_ADMIN_PROJECT_ID }}
          FIREBASE_ADMIN_CLIENT_EMAIL: ${{ secrets.FIREBASE_ADMIN_CLIENT_EMAIL }}
          FIREBASE_ADMIN_PRIVATE_KEY: ${{ secrets.FIREBASE_ADMIN_PRIVATE_KEY }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          RESEND_FROM_EMAIL: ${{ secrets.RESEND_FROM_EMAIL }}
          NEXT_PUBLIC_APP_URL: ${{ secrets.NEXT_PUBLIC_APP_URL }}
          JOB_TRIGGER: ${{ github.event_name == 'workflow_dispatch' && 'manual' || 'scheduled' }}
        run: pnpm tsx scripts/run-ssl-check.ts
```

### domain-check.yml

```yaml
# .github/workflows/domain-check.yml
name: Domain Expiry Check

on:
  schedule:
    - cron: '0 1,7,13,19 * * *'   # Offset by 1h from SSL check to avoid thundering herd
  workflow_dispatch:

jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      - name: Run domain check
        working-directory: apps/web
        env:
          FIREBASE_ADMIN_PROJECT_ID: ${{ secrets.FIREBASE_ADMIN_PROJECT_ID }}
          FIREBASE_ADMIN_CLIENT_EMAIL: ${{ secrets.FIREBASE_ADMIN_CLIENT_EMAIL }}
          FIREBASE_ADMIN_PRIVATE_KEY: ${{ secrets.FIREBASE_ADMIN_PRIVATE_KEY }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          RESEND_FROM_EMAIL: ${{ secrets.RESEND_FROM_EMAIL }}
          NEXT_PUBLIC_APP_URL: ${{ secrets.NEXT_PUBLIC_APP_URL }}
          JOB_TRIGGER: ${{ github.event_name == 'workflow_dispatch' && 'manual' || 'scheduled' }}
        run: pnpm tsx scripts/run-domain-check.ts
```

### weekly-digest.yml

```yaml
# .github/workflows/weekly-digest.yml
name: Weekly Digest Email

on:
  schedule:
    - cron: '0 8 * * 1'   # Every Monday at 08:00 UTC
  workflow_dispatch:

jobs:
  digest:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      - name: Run weekly digest
        working-directory: apps/web
        env:
          FIREBASE_ADMIN_PROJECT_ID: ${{ secrets.FIREBASE_ADMIN_PROJECT_ID }}
          FIREBASE_ADMIN_CLIENT_EMAIL: ${{ secrets.FIREBASE_ADMIN_CLIENT_EMAIL }}
          FIREBASE_ADMIN_PRIVATE_KEY: ${{ secrets.FIREBASE_ADMIN_PRIVATE_KEY }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          RESEND_FROM_EMAIL: ${{ secrets.RESEND_FROM_EMAIL }}
          NEXT_PUBLIC_APP_URL: ${{ secrets.NEXT_PUBLIC_APP_URL }}
          JOB_TRIGGER: ${{ github.event_name == 'workflow_dispatch' && 'manual' || 'scheduled' }}
        run: pnpm tsx scripts/run-weekly-digest.ts
```

---

## 9. Email System

### Templates Required

**1. Alert Email** (`emails/AlertEmail.tsx`)
- Triggered when SSL or domain crosses alert threshold
- Subject line format:
  - `"⚠️ SSL expiring in 7 days — example.com"`
  - `"🔴 SSL certificate EXPIRED — example.com"`
  - `"⚠️ Domain expiring in 30 days — example.com"`
- Content: site label, URL, what's expiring, exact expiry date, days remaining, link to dashboard
- Footer: unsubscribe link, Kattalan branding

**2. Weekly Digest Email** (`emails/DigestEmail.tsx`)
- Triggered every Monday 08:00 UTC for all users with `digestEnabled: true`
- Subject line: `"Your 5 sites are healthy this week"` OR `"⚠️ 2 of your 5 sites need attention"`
- Content:
  - Overall health summary line
  - Table of all sites: label, SSL status + days, domain status + days
  - "Needs attention" section — only shown if any site has status `expiring_soon` or `expired`
  - Footer: manage preferences link, unsubscribe link

### Sending Logic (`lib/email.ts`)

```typescript
// lib/email.ts skeleton — model must implement fully

import { Resend } from "resend"
import { render } from "@react-email/render"
import AlertEmail from "../emails/AlertEmail"
import DigestEmail from "../emails/DigestEmail"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendAlertEmail(params: {
  to: string
  siteLabel: string
  siteUrl: string
  alertType: "ssl" | "domain"
  severity: "warning" | "expired"
  daysUntilExpiry: number
  expiresAt: Date
}): Promise<void> {
  // render react-email template to HTML
  // send via resend.emails.send()
  // throw on failure — caller handles retry/logging
}

export async function sendDigestEmail(params: {
  to: string
  sites: DigestSiteRow[]
}): Promise<void> {
  // render DigestEmail template
  // send via resend
}
```

### Unsubscribe Handling
- Every email footer has two links:
  1. "Unsubscribe from alerts" → `GET /api/unsubscribe?token=...&type=alerts`
  2. "Unsubscribe from digest" → `GET /api/unsubscribe?token=...&type=digest`
- Token = base64 encoded `uid:type` (simple for MVP — not cryptographic)
- Route sets `user.alertsEnabled = false` OR `user.digestEnabled = false` in Firestore

---

## 10. Phase-by-Phase Build Plan

The model must build exactly one phase at a time. It must not build ahead. It must not add features not listed in the phase.

---

### Phase 1 — Foundation

**Goal:** Repo running, auth working, one site persisted to Firestore.

**Build in this order:**
1. Init pnpm monorepo with `apps/web` workspace
2. Create Next.js 15 app with App Router, TypeScript strict, Tailwind
3. Add shadcn/ui — install: `button`, `input`, `dialog`, `badge`, `card`, `label`, `toast`
4. Create `.env.example` with all variables documented
5. Create `lib/firebase-client.ts` — client SDK init with env vars
6. Create `lib/firebase-admin.ts` — Admin SDK init, singleton pattern
7. Create `lib/auth-middleware.ts` — `verifyToken()` function
8. Create `lib/constants.ts` — PLAN_LIMITS, ALERT_THRESHOLDS
9. Create `lib/utils.ts` — normalizeUrl, formatDate helpers
10. Create Firestore Security Rules file (`firestore.rules`)
11. Build auth pages: `/login`, `/signup` with Firebase Auth
12. Build `middleware.ts` — redirect unauthenticated users from `/dashboard` to `/login`
13. Build `POST /api/sites` — add site with Zod validation + SSRF protection + limit check
14. Build `GET /api/sites` — list user's sites
15. Build `DELETE /api/sites/[siteId]` — remove site
16. Build `GET /api/health` — simple health check
17. Build minimal dashboard (`/dashboard`) — shows site list, add button, delete button
18. Build `AddSiteModal` component
19. Build `SiteCard` component — shows URL, label, "pending first check" status
20. Deploy to Vercel

**Phase 1 exit criteria (model must verify before declaring phase complete):**
- `pnpm build` passes with zero TypeScript errors
- Auth flow works end-to-end (signup → login → see dashboard → logout → login again → same sites)
- Add site: valid URL accepted, private IP rejected, duplicate rejected, limit enforced
- Delete site: works for own site, returns 404 for non-existent
- Unauthenticated request to `/api/sites` returns 401
- `/api/health` returns 200

---

### Phase 2 — SSL + Domain Monitoring

**Goal:** Both check services working, cron scripts running, results written to Firestore.

**Build in this order:**
1. Install dependencies: `ssl-checker`, `whois`, `tsx` (for running TS scripts directly)
2. Create `lib/ssl.ts` — `checkSsl(url)` with ssl-checker + tls fallback
3. Create `lib/domain.ts` — `checkDomain(url)` with whois + Domainr fallback
4. Create `scripts/run-ssl-check.ts` — full cron script with logging
5. Create `scripts/run-domain-check.ts` — full cron script with logging
6. Create `.github/workflows/ssl-check.yml`
7. Create `.github/workflows/domain-check.yml`
8. Build `POST /api/cron/ssl` and `POST /api/cron/domain` — CRON_SECRET gated wrappers
9. Update `SiteCard` component to display real SSL + domain status from Firestore data
10. Build `StatusBadge` component

**Phase 2 exit criteria:**
- `scripts/run-ssl-check.ts` runs locally against test site, writes results to Firestore
- `scripts/run-domain-check.ts` same
- cronLog document created in Firestore with correct fields after each run
- `SiteCard` shows correct SSL status after run
- `ssl-check.yml` workflow runs successfully in GitHub Actions (test with `workflow_dispatch`)
- Private IP is still blocked even in cron scripts (SSRF protection in `lib/ssl.ts`)

---

### Phase 3 — Email Alerts + Digest

**Goal:** Alert emails sending on threshold crossing. Digest sending on Mondays.

**Build in this order:**
1. Set up Resend account — verify sending domain (human does this, model generates instructions)
2. Install `resend`, `@react-email/components`, `@react-email/render`
3. Create `emails/AlertEmail.tsx` — react-email template
4. Create `emails/DigestEmail.tsx` — react-email template
5. Create `lib/email.ts` — `sendAlertEmail()` and `sendDigestEmail()`
6. Update `scripts/run-ssl-check.ts` — add alert decision logic + email sending
7. Update `scripts/run-domain-check.ts` — same
8. Create `scripts/run-weekly-digest.ts` — query all users, send digest to each
9. Create `.github/workflows/weekly-digest.yml`
10. Build `POST /api/cron/digest` wrapper
11. Build `GET /api/unsubscribe` — handle unsubscribe tokens
12. Build settings page — toggle alertsEnabled, digestEnabled

**Phase 3 exit criteria:**
- Alert email renders correctly (test with `pnpm email:preview` if react-email dev server added)
- Digest email renders correctly
- Alert sent when site SSL < 30 days
- Alert NOT sent twice for same threshold (alertsSent flag works)
- Alert resets correctly when certificate renewed
- Digest sends to all users with `digestEnabled: true`
- Unsubscribe link correctly updates Firestore
- weekly-digest.yml runs in GitHub Actions

---

### Phase 4 — Polish + Landing Page + Launch Prep

**Goal:** Production-ready, beautiful, shippable.

**Build in this order:**
1. Build landing page (`app/page.tsx`) — Hero, Features, simple free-tier pricing section
2. Add loading states to all async operations (skeleton cards, spinner on add/delete)
3. Add error boundaries and error states
4. Add empty state for dashboard (no sites yet)
5. Add `EmptyState` component with "Add your first site" CTA
6. SEO: metadata in `layout.tsx`, OG image, `sitemap.xml`, `robots.txt`
7. Add CSP headers in `next.config.ts`
8. Remove `X-Powered-By` header
9. Add `HSTS`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` headers
10. Final Firestore security rules review
11. Verify all env vars are present and documented

**Phase 4 exit criteria:**
- `pnpm build` zero errors, zero warnings
- Lighthouse score > 90 on landing page
- All security headers present (check with securityheaders.com)
- No secrets in source code (grep for any hardcoded values)

---

## 11. Health Check Log System

This is non-negotiable for a monitoring product. Every cron run must be logged.

### cronLogs Collection

Written by every cron script. Each run creates one document.

```typescript
// Skeleton — model must implement this pattern in every script

import { adminDb } from "../lib/firebase-admin"
import { Timestamp } from "firebase-admin/firestore"

async function runWithLogging(
  jobType: "ssl_check" | "domain_check" | "weekly_digest",
  fn: () => Promise<{ sitesProcessed: number; alertsSent: number; errors: string[] }>
) {
  const startTime = Date.now()
  const trigger = (process.env.JOB_TRIGGER ?? "scheduled") as "scheduled" | "manual"

  const logRef = adminDb.collection("cronLogs").doc()

  await logRef.set({
    jobType,
    trigger,
    status: "started",
    runAt: Timestamp.now(),
    sitesProcessed: 0,
    alertsSent: 0,
    errors: [],
    durationMs: 0,
  })

  try {
    const result = await fn()
    await logRef.update({
      status: "completed",
      sitesProcessed: result.sitesProcessed,
      alertsSent: result.alertsSent,
      errors: result.errors,
      durationMs: Date.now() - startTime,
    })
    console.log(JSON.stringify({
      level: "info",
      jobType,
      status: "completed",
      ...result,
      durationMs: Date.now() - startTime,
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await logRef.update({
      status: "failed",
      errors: [message],
      durationMs: Date.now() - startTime,
    })
    console.error(JSON.stringify({
      level: "error",
      jobType,
      status: "failed",
      error: message,
      durationMs: Date.now() - startTime,
    }))
    process.exit(1)
  }
}
```

### Dashboard: Cron Log Visibility

Add a simple "Last run" indicator to the dashboard footer:
- Query the latest `cronLogs` document for `ssl_check` and `domain_check`
- Show: "SSL checks last ran X minutes ago — ✅ completed" or "❌ failed"
- This tells the user their monitoring is actually working

```typescript
// In dashboard page — server component fetch
// GET latest cronLog for each jobType
// Pass to client as props
// Render as small status line: "Checks running every 6 hours · Last run: 2 hours ago"
```

### GitHub Actions Job Status Badge

Add to README:

```markdown
![SSL Check](https://github.com/{owner}/{repo}/actions/workflows/ssl-check.yml/badge.svg)
![Domain Check](https://github.com/{owner}/{repo}/actions/workflows/domain-check.yml/badge.svg)
![Weekly Digest](https://github.com/{owner}/{repo}/actions/workflows/weekly-digest.yml/badge.svg)
```

---

## 12. Security Rules & Constraints

### Firestore Security Rules

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can only read/write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      // Sites subcollection — same ownership rule
      match /sites/{siteId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      // cronLogs — users can read their own logs, but only server can write
      // Server writes via Admin SDK which bypasses security rules
      match /cronLogs/{logId} {
        allow read: if request.auth != null && request.auth.uid == userId;
        allow write: if false; // Admin SDK only
      }
    }

    // Deny everything else
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Security Constraints the Model Must Enforce

| Constraint | Implementation |
|---|---|
| SSRF protection | Validate URL in AddSiteSchema — block private IPs, localhost, metadata endpoints |
| Auth on every route | Every Route Handler (except `/api/health`) calls `verifyToken()` first |
| Never trust client UID | Always extract UID from verified token, never from request body |
| Cron route protection | Check `x-cron-secret` header before running any cron logic |
| No secrets in code | All sensitive values via env vars only |
| Admin SDK server-only | Never import `firebase-admin` in any file under `components/` or `hooks/` |
| Input sanitization | All user inputs through Zod before any DB write |
| Site ownership | Always use `users/{uid}/sites/{siteId}` path — never query across users |
| 404 not 403 for IDOR | When site not found for user, return 404 (don't confirm document exists) |

---

## 13. Edge Cases the Model Must Handle

### SSL Edge Cases

| Case | Handling |
|---|---|
| Self-signed certificate | Set status `"error"`, issuer `"self-signed"`, daysUntilExpiry `null` |
| Port 443 not open | Set status `"error"`, note in issuer field |
| HTTP-only site (no SSL) | Set status `"unknown"`, note that no SSL was detected |
| CDN-fronted (Cloudflare) | Treat as normal — CDN cert is the effective cert |
| ssl-checker throws | Catch, attempt tls.connect() fallback, if both fail → status `"error"` |

### Domain Edge Cases

| Case | Handling |
|---|---|
| GDPR-masked WHOIS | Fall back to Domainr API. If still no data → status `"unknown"` |
| Unusual TLD (.io, .ai, .co) | whois library handles most; if fails → Domainr fallback |
| Domain in redemption | Parse "redemption" keyword from WHOIS → status `"expired"` |
| Punycode / IDN domains | Normalize to punycode before WHOIS lookup |
| whois library throws | Catch, try Domainr fallback, if both fail → status `"error"` |

### Script / Cron Edge Cases

| Case | Handling |
|---|---|
| One site check fails | Log error, continue to next site — never abort entire run |
| Email send fails | Log error, continue — don't re-set alertsSent flag so it retries next run |
| User deleted mid-run | Catch "document not found" errors gracefully, skip |
| No users in DB | Script completes with `sitesProcessed: 0`, status `"completed"` |
| Firestore write fails | Log error in cronLog errors array, continue |

### Frontend Edge Cases

| Case | Handling |
|---|---|
| User adds site with www prefix | Normalize: `www.example.com` → `https://example.com` |
| User adds URL with path | Strip path: `example.com/blog` → `https://example.com` |
| Dashboard loaded before first check | Show "Pending first check" state on SiteCard |
| Delete while list is refreshing | Optimistic update in UI, rollback on error |
| Token expired mid-session | Firebase client SDK auto-refreshes — handle 401s by retrying once |

---

## 14. What the Model Must Never Do

1. **Never build uptime monitoring** — not in MVP. Not even a stub. Not even a TODO comment suggesting it.
2. **Never add Stripe or any billing code** — no pricing logic, no subscription checks beyond the free plan limit.
3. **Never add Redis, Bull, or any queue system** — GitHub Actions is the scheduler.
4. **Never add team/multi-user features** — everything is single-user.
5. **Never import Firebase Admin SDK in browser-side code** — it will expose private keys.
6. **Never hardcode any secret, API key, or credential** — always use `process.env`.
7. **Never build Phase 2 features during Phase 1** — one phase at a time.
8. **Never use `any` in TypeScript** — strict types only.
9. **Never skip the SSRF check** — any outbound HTTP must validate the target URL first.
10. **Never write to Firestore from client-side without going through an authenticated API route** — all writes via Route Handlers only.
11. **Never skip cron log writes** — every script run must produce a cronLog document.
12. **Never assume GitHub Actions cron runs exactly on time** — never write time-sensitive logic that breaks on 30-minute drift.

---

*End of Kattalan Implementation Specification v1.0*
*This document covers MVP scope only. Features marked ❌ are intentionally excluded.*
