# Self-Hosted Licensing — HenKaiPan ASPM

This guide covers how licensing works for self-hosted instances: what's free, what's paid, how to generate and apply license keys, and how feature gating works under the hood.

## Overview

HenKaiPan uses an **offline license key** model. No phone-home, no internet required after setup. The license is a signed JWT-like token validated locally by the API server.

| Mode | License Key | What you get |
|------|-------------|--------------|
| **Free** | Not set | Core scanning, findings triage, projects, webhooks |
| **Paid** | `LICENSE_KEY` set | All features unlocked |

### How it works

```
┌──────────────┐     LICENSE_KEY env var      ┌────────────────────┐
│  License Key  │─────────────────────────────▶│  API Server        │
│  (HMAC-SHA256 │                               │  ┌──────────────┐  │
│   signed JWT) │                               │  │ license.Service│  │
└──────────────┘                               │  │              │  │
                                               │  │ - validates  │  │
┌──────────────┐     GET /api/license          │  │ - checks     │  │
│  Frontend     │◀────────────────────────────▶│  │   features   │  │
│  Settings UI  │     402 Payment Required     │  └──────────────┘  │
└──────────────┘                               └────────────────────┘
```

## Feature Comparison

### Free Tier (no license key)

| Feature | Status |
|---------|--------|
| Projects | Unlimited |
| Users | Unlimited |
| Scanners (SAST, SCA, Secrets, IaC, Containers) | All included |
| Manual scans | ✅ |
| Findings list, filter, triage | ✅ |
| Finding SLA tracking | ✅ |
| Dashboard (summary, SLA compliance) | ✅ |
| Knowledge base (read) | ✅ |
| Vulnerabilities view | ✅ |
| Webhooks | ✅ |
| Scan coverage reports | ✅ |
| Apps (business grouping) | ✅ |
| **AI Summary** (via Ollama) | ✅ (self-hosted only) |

> **AI Features Note**: In self-hosted deployments without a license key, only **AI Summary** is available (using Ollama). **AI Remediation** and **AI Validation** require a license key with the `ai-remediation` feature flag.

### Paid Features (require license key)

| Feature | Flag | API Routes |
|---------|------|------------|
| Scan scheduling (cron) | `scheduling` | `/api/schedules*` |
| Policies & auto-triage | `policies` | `/api/policies*`, `/api/suppressions*` |
| Compliance frameworks | `compliance` | Frontend page |
| Integrations (Jira, GitHub, Slack) | `integrations` | `/api/integrations/jira*`, `/api/findings/*/jira*` |
| AI remediation | `ai-remediation` | `/api/knowledge/ai-remediate`, `/api/findings/*/analyze` |
| AI validation | `ai-remediation` | `/api/findings/*/analyze` (validation endpoint) |
| Reports & advanced metrics | `reports` | `/api/metrics/trends`, `/api/metrics/risk`, `/api/findings/export` |
| Audit log | `audit-log` | `/api/audit-logs` |
| Risk acceptance workflow | `risk-acceptance` | `/api/risk-acceptances*`, `/api/findings/*/risk-acceptance` |
| Teams | `teams` | `/api/teams*` |
| Finding comments | `comments` | `/api/findings/*/comments*` |
| Email notifications | `email-notifications` | `/api/settings/notifications*` |

> **AI Providers**: With a valid license key, you can use **Ollama** (self-hosted, free), **OpenRouter** (paid), or **Cloudflare Workers AI** (paid) for remediation and validation. Without a license key, only Ollama summary is available.

## Setup: Applying a License Key

### 1. Get a license key

Contact your account representative or generate one yourself (see [Generating License Keys](#generating-license-keys)).

### 2. Set the environment variable

Add to your `.env` file:

```env
LICENSE_KEY=HENKAI...base64-encoded-key...
```

### 3. Restart the API

```bash
docker compose restart api
```

### 4. Verify

Check the license status:

```bash
curl -H "Authorization: Bearer $(your-token)" http://localhost:8080/api/license
```

Or view it in the UI: **Settings → License**.

## Generating License Keys

Use the `scripts/generate-license.sh` script in the **app** repository (not self-hosted).

### Basic usage

```bash
# Generate a 365-day key with all paid features
./scripts/generate-license.sh customer@example.com 365 \
  -f "scheduling,policies,compliance,integrations,ai-remediation,reports,audit-log,risk-acceptance,teams,comments,email-notifications"
```

### Arguments

| Arg | Description | Default |
|-----|-------------|---------|
| `email` | License holder email (required) | — |
| `days` | Validity period in days | `365` |
| `-f` | Comma-separated feature flags | empty (no paid features) |

### Available feature flags

```
scheduling, policies, compliance, integrations, ai-remediation,
reports, audit-log, risk-acceptance, teams, comments, email-notifications
```

### Examples

```bash
# Single feature
./scripts/generate-license.sh user@example.com 90 -f "scheduling"

# Subset of features
./scripts/generate-license.sh partner@example.com 180 \
  -f "scheduling,policies,compliance"

# All features
./scripts/generate-license.sh admin@example.com 365 \
  -f "scheduling,policies,compliance,integrations"
```

### Output

The script prints the key to stdout with instructions:

```
HenKaiPan ASPM License Key
==========================

Email:    customer@example.com
Valid:    365 days (expires 2027-05-02)
Features: scheduling, policies, compliance, integrations, ...

License Key:
------------
eyJlbWFpbCI6...c2lnbmF0dXJlCg==

Set this key as LICENSE_KEY environment variable:
  export LICENSE_KEY=eyJlbWFpbCI6...c2lnbmF0dXJlCg==
```

## Architecture

### Validation (offline, no phone-home)

```
License Key (base64)
    │
    ▼
Base64 decode ───► payload.signature
                        │
          ┌─────────────┴─────────────┐
          ▼                           ▼
    JSON payload             HMAC-SHA256(payload, secret)
    {email, expiry,         Compare with signature
     features:[...]}
          │
          ▼
    Valid? Expired? Features match?
```

The license is validated entirely offline. The API never makes an external call. Each request to a paid endpoint is checked via chi middleware.

### Feature gating

Routes for paid features are wrapped with `licSvc.RequireFeature("feature-name")`:

```go
// Example from cmd/api/main.go
r.With(licSvc.RequireFeature(license.FeatureScheduling)).Group(func(r chi.Router) {
    r.Get("/api/schedules", h.ListSchedules)
    r.Post("/api/schedules", h.CreateSchedule)
    // ...
})
```

When a feature is not licensed:

- **GET requests** from admin/analyst users **pass through** (so the UI can render navigation and forms)
- **All other requests** return `402 Payment Required` with:

```json
{
  "error": "license_required",
  "message": "This feature requires a paid license key. Contact sales@dyallab.com.ar to upgrade.",
  "feature": "scheduling"
}
```

### Key format

The license key is a base64-encoded payload and HMAC-SHA256 signature joined by a `.`:

```
base64(json_payload . hmac_sha256(json_payload, secret))
```

Payload schema:

```json
{
  "email": "customer@example.com",
  "expiry": 1817424000,
  "features": ["scheduling", "policies"]
}
```

## Security Notes

1. **License keys are not tied to a specific instance.** A key can be shared — the trust model is that paying customers won't.

## FAQ

**Q: What happens if my license expires?**
A: The API logs a warning on startup, returns `expired` status from `/api/license`, and paid endpoints return 402. The free tier continues working normally. Generate a new key with a later expiry and restart.

**Q: Can I change features on an existing key?**
A: Yes — generate a new key with the desired features and update `LICENSE_KEY` in the environment.

**Q: Does the app phone home?**
A: No. License validation is 100% offline. There is no telemetry.

**Q: Can I run without any license key?**
A: Yes. The app starts in free mode with all free features available. No license key is required.

## File Reference

| File | Purpose |
|------|---------|
| `internal/license/features.go` | Feature flag constants |
| `internal/license/license.go` | `Service`: parse, validate, `HasFeature()`, `Status()` |
| `internal/license/middleware.go` | `RequireFeature()` chi middleware |
| `internal/handlers/license.go` | `GET /api/license` handler |
| `cmd/api/main.go` | Route registration with license gating |
| `scripts/generate-license.sh` | CLI tool for key generation |
| `.env.example` | Config reference |
