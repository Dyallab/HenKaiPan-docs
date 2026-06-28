# OIDC Single Sign-On — Implementation Plan

**Status:** Planning complete · Ready for implementation (separate session)
**Last updated:** 2026-06-28
**Target release:** v1.31.0

---

## 1. Architecture Decisions (CONFIRMED)

### 1.1 Auth coexistence
- **Keep both password login AND OIDC.** Password login stays as fallback.
  - Bootstrap: admin created via migration with password (no IdP to authenticate against at setup).
  - Self-hosted without IdP: small teams can skip OIDC entirely.
  - Failure mode: if IdP is down and circuit breaker opens, admins still enter via password.
  - Contractors/service accounts may not have IdP accounts.
- Both methods produce the **same JWT** via `auth.IssueToken()` — middleware is unchanged.
- OIDC users have `password_hash = ''` in DB. Password login for those users returns `"sso_required"` error with IdP name.

### 1.2 Enterprise gating
- **Env var gating** (same as existing tier limits): `SSO_ENABLED=true`
- No build tags, no private repos. Code remains public (MIT).
- Optional: `SSO_REQUIRED=true` — hides password form entirely on login page. Only set in Cloud/Enterprise deployments.
- `SSO_DEFAULT_PROVIDER=<name>` — auto-redirects to IdP on login page (skip the button click).

### 1.3 Protocol
- **OIDC only, no SAML.** Every modern IdP (Keycloak, Okta, Azure AD, Google, Auth0) speaks OIDC natively.
- Authorization Code Flow + PKCE is optional for future. F1 uses Authorization Code + nonce + state.

### 1.4 Cryptography
- `client_secret` encrypted at rest with `secrets.Encrypt()` (AES-256-GCM), same as `github_token_encrypted`.
- Token validation: use `coreos/go-oidc/v3` library (well-tested, handles JWKS fetching and key rotation).
- State parameter: HMAC-signed cookie instead of server-side session storage.
  - Cookie value: `base64(providerID + ":" + nonce + ":" + HMAC(providerID + nonce, webhookSecret))`
  - Path-scoped to `/api/auth/oidc/callback`, SameSite=Lax, Secure, HttpOnly.
  - Single-use (deleted on callback).
- Nonce: **mandatory, not optional.** Prevents ID token replay. Embedded in the same HMAC cookie.

### 1.5 Data model
- All auth data in **same Postgres DB** (no separate auth database).
- New tables: `oidc_providers` and `oidc_identities`.
- Users in same `users` table. OIDC users identified by `password_hash = ''`.
- `oidc_identities` links `(provider_id, issuer_sub)` → `user_id`. Enforces unique constraint on `(provider_id, subject)`.

### 1.6 Circuit breaker (in-memory)
- **No Redis needed.** Circuit breaker state per provider lives in process memory.
- State machine: CLOSED → OPEN (5 consecutive failures) → HALF-OPEN (after 5min timeout) → CLOSED (first success).
- Atomic operations via `sync/atomic`. ~25 lines of code.
- Lost on restart — acceptable. Next request loop re-establishes state in seconds.
- Threshold and reset duration hardcoded for F1, configurable later.

### 1.7 Username resolution
- Configurable claim precedence via `attr_username` on provider config.
- Default: `preferred_username` → `name`.
- If no matching claim found: redirect to **profile completion form** (one-time, post-login).
- No email-as-username fallback.
- Admin can also set `attr_groups` claim path for automatic role mapping (F2 feature).

### 1.8 Frontend
- Login page: password form + "Sign in with <ProviderName>" button.
  - Hidden when `SSO_REQUIRED=true` and provider configured.
  - Button reads provider name from `GET /api/auth/oidc/providers` (public, no auth).
- Settings page: SSO section in sidebar — list providers, add/edit/delete, test connection.
- Profile completion form: shown once when OIDC login succeeds but no username claim is found.

---

## 2. Database Schema

### Migration `042_oidc.sql`

```sql
-- One row per IdP. Configurable via Settings UI.
CREATE TABLE oidc_providers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL UNIQUE,          -- e.g. "Okta", "Azure AD"
    issuer_url      TEXT NOT NULL,                 -- OIDC discovery URL
    client_id       TEXT NOT NULL,
    client_secret   TEXT NOT NULL,                 -- encrypted with secrets.Encrypt()
    attr_username   TEXT NOT NULL DEFAULT 'preferred_username',  -- claim path for username
    attr_groups     TEXT,                          -- claim path for group/role mapping (nullable, F2)
    enabled         BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Links IdP identities to local users.
-- One user can have multiple OIDC identities (e.g. Okta + Google).
CREATE TABLE oidc_identities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id     UUID NOT NULL REFERENCES oidc_providers(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject         TEXT NOT NULL,                 -- "sub" claim from the ID token
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider_id, subject)
);

CREATE INDEX idx_oidc_identities_user ON oidc_identities(user_id);
CREATE INDEX idx_oidc_identities_provider_subject ON oidc_identities(provider_id, subject);
```

### `users` table — no schema changes
- OIDC users: `password_hash = ''`
- Add helper: `IsOIDCUser() bool` on User model.

---

## 3. Package Structure

```
internal/
├── oidc/
│   ├── config.go          # OIDCConfig struct (issuer, client_id, client_secret, etc.)
│   ├── provider.go        # Provider struct + circuit breaker (state, failureCount, lastFailure)
│   ├── store.go           # ProviderStore (CRUD for oidc_providers table)
│   ├── identity.go        # IdentityStore (CRUD for oidc_identities table)
│   ├── callback.go        # Token validation, user lookup/creation, JWT issuance
│   └── circuitbreaker.go  # CircuitBreaker type (CLOSED/HALF-OPEN/OPEN, thread-safe)
├── handlers/
│   ├── oidc.go            # HTTP handlers for OIDC flow + provider management
│   └── auth.go            # Existing: add SSO error check for OIDC users
├── middleware/
│   └── ...               # No changes needed
└── config/
    └── config.go          # Add SSOEnabled, SSORequired fields
```

---

## 4. Flow: Authentication

```
Browser                     API                          IdP
   │                         │                           │
   │  GET /api/auth/oidc/authz?provider=<id>             │
   │────────────────────────►│                           │
   │                         │  Validate provider exists  │
   │                         │  Generate nonce + state    │
   │                         │  Set HMAC-signed cookie    │
   │                         │  302 → IdP authorize URL  │
   │◄────────────────────────│                           │
   │                         │                           │
   │  ──── 302 redirect ────►│                           │
   │                         │  User authenticates...     │
   │                         │◄──────────────────────────│
   │                         │                           │
   │  POST /api/auth/oidc/callback?code=&state=          │
   │  (with HMAC cookie)      │                           │
   │────────────────────────►│                           │
   │                         │  Verify HMAC cookie        │
   │                         │  Verify state match        │
   │                         │  Token exchange:           │
   │                         │    POST IdP /token         │
   │                         │    Validate ID token       │
   │                         │    Extract claims          │
   │                         │                           │
   │                         │  Lookup oidc_identities    │
   │                         │  ├─ Found → update last_login
   │                         │  └─ Not found → create user
   │                         │     (or 302 profile completion)
   │                         │                           │
   │                         │  Issue JWT (same as password login)
   │                         │  Delete HMAC cookie        │
   │                         │  Set auth cookie           │
   │                         │  302 → /dashboard          │
   │◄────────────────────────│                           │
```

### POST /api/auth/oidc/callback details

1. **Read HMAC cookie** — extract providerID, nonce, HMAC
2. **Verify HMAC** — recompute with `webhookSecret` and compare (constant-time)
3. **Verify state** — `state` query param must match `HMAC(providerID + nonce, webhookSecret)`
4. **Delete the cookie** (single-use)
5. **Token exchange** — POST to IdP `/token` with `code`, `client_id`, `client_secret`, `redirect_uri`
6. **Validate ID token** — via `go-oidc`:
   - `Verify(ctx, idToken)` checks: signature, issuer, client_id, expiry, nonce
7. **Extract claims** — `preferred_username`, `name`, `email`, `sub`
8. **Lookup identity** — `oidc_identities WHERE provider_id = $1 AND subject = $2`
   - **Found**: update `last_login`, load user
   - **Not found, email matches existing user**: link identity to existing user (auto-link)
   - **Not found, no match**: create new user with `password_hash = ''`, role = `user`, create identity
   - **Username missing**: 302 redirect to `/dashboard/profile/complete?oidc_pending=1`
9. **Issue JWT** — `auth.IssueToken(username, role, userID, tokenVersion)`
10. **Set auth cookie** — same as password login path
11. **302 redirect** — `/dashboard` with session cookie

### Profile completion flow (F2 detail, placeholder in F1)
- After OIDC callback, if no username claim → set temporary cookie `oidc_pending_identity`
- Frontend sees `oidc_pending=1` → shows profile completion form (username + timezone)
- POST to `/api/auth/oidc/complete-profile` with chosen username
- Validates uniqueness, updates user, creates identity, issues JWT, logs in
- This is an edge case — most IdPs send `preferred_username`

---

## 5. API Endpoints

### Public (no auth required)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/auth/oidc/providers` | List enabled providers (name + icon only) |
| `GET` | `/api/auth/oidc/authz?provider=<id>` | Initiate OIDC login — 302 to IdP |
| `POST` | `/api/auth/oidc/callback` | OIDC callback — exchange code → JWT |
| `POST` | `/api/auth/oidc/complete-profile` | Profile completion (F2) |

### Admin-only (JWT + role=admin)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/settings/oidc/providers` | List all providers (with `has_secret` flag) |
| `POST` | `/api/settings/oidc/providers` | Create provider |
| `GET` | `/api/settings/oidc/providers/{id}` | Get provider detail (no secret) |
| `PATCH` | `/api/settings/oidc/providers/{id}` | Update provider |
| `DELETE` | `/api/settings/oidc/providers/{id}` | Delete provider + cascade identities |
| `POST` | `/api/settings/oidc/providers/{id}/test` | Test connection (verify issuer, exchange token) |

---

## 6. Route Registration

In `cmd/api/main.go`, gated by `SSOEnabled`:

```go
if cfg.SSOEnabled {
    r.Group(func(r chi.Router) {
        // Public OIDC routes
        r.Get("/api/auth/oidc/providers", oidcHandler.ListPublicProviders)
        r.Get("/api/auth/oidc/authz", oidcHandler.InitiateAuth)
        r.Post("/api/auth/oidc/callback", oidcHandler.Callback)
        r.Post("/api/auth/oidc/complete-profile", oidcHandler.CompleteProfile)

        // Admin provider management
        r.Group(func(r chi.Router) {
            r.Use(auth.JWTMiddleware)
            r.Use(middleware.RequireRole("admin"))
            r.Get("/api/settings/oidc/providers", oidcHandler.ListProviders)
            r.Post("/api/settings/oidc/providers", oidcHandler.CreateProvider)
            r.Get("/api/settings/oidc/providers/{id}", oidcHandler.GetProvider)
            r.Patch("/api/settings/oidc/providers/{id}", oidcHandler.UpdateProvider)
            r.Delete("/api/settings/oidc/providers/{id}", oidcHandler.DeleteProvider)
            r.Post("/api/settings/oidc/providers/{id}/test", oidcHandler.TestProvider)
        })
    })
}
```

---

## 7. Configuration (`internal/config/config.go`)

```go
type Config struct {
    // ... existing fields ...

    // SSO / OIDC
    SSOEnabled        bool   `env:"SSO_ENABLED" default:"false"`
    SSORequired       bool   `env:"SSO_REQUIRED" default:"false"`
    SSODefaultProvider string `env:"SSO_DEFAULT_PROVIDER" default:""`
}
```

### `.env.example` additions

```env
# ============================================================================
# OPTIONAL: Single Sign-On (OIDC)
# ============================================================================
# SSO_ENABLED=false                          # Enable OIDC SSO support
# SSO_REQUIRED=false                         # Hide password form, force SSO
# SSO_DEFAULT_PROVIDER=                      # Auto-redirect to this provider
# OIDC_REDIRECT_URL=https://your-domain.com/api/auth/oidc/callback
```

---

## 8. Existing File Changes

### `internal/handlers/auth.go`
- **Login handler**: after `bcrypt.CompareHashAndPassword` fails, check if `password_hash == ''`.
  If yes → return error `{"code": "sso_required", "message": "This account uses SSO via <provider_name>. Sign in with Okta."}`
  Query `oidc_identities` JOIN `oidc_providers` to get the provider name.

### `cmd/api/main.go`
- Add import for `oidc` package.
- Register routes gated by `cfg.SSOEnabled`.

### `internal/config/config.go`
- Add `SSOEnabled`, `SSORequired`, `SSODefaultProvider` fields.

### Landing page (`HenKaiPan-Landing/src/pages/index.astro`)
- Line 1891: change `"SSO / SAML"` → `"Single Sign-On (OIDC)"`.

### `TODO.md`
- Change line 213: `- [ ] SAML / OIDC SSO` → `- [ ] Single Sign-On (OIDC)`.
- Add detailed OIDC implementation items under Enterprise Features section.

### `frontend/src/pages/login.astro`
- Add OIDC provider button above password form when `SSO_ENABLED=true`.
- Add `SSO_REQUIRED` mode — hide password form entirely.
- Fetch providers from `GET /api/auth/oidc/providers` (public endpoint).
- Button text: "Sign in with <ProviderName>".
- Handle `sso_required` error response from password login.

### `frontend/src/pages/dashboard/settings.astro`
- Add "SSO" nav item when `SSO_ENABLED=true`.
- SSO settings page: list providers with name, issuer, enabled status.
- Add provider form: name, issuer_url, client_id, client_secret, attr_username.
- Edit provider: inline form, secret field shows `has_secret` indicator.
- Test connection button.
- Delete provider confirmation.

---

## 9. Circuit Breaker Details

```go
const (
    circuitClosed  int32 = 0
    circuitHalfOpen int32 = 1
    circuitOpen    int32 = 2
)

type CircuitBreaker struct {
    state         atomic.Int32
    failureCount  atomic.Int32
    lastFailure   atomic.Value // time.Time
    threshold     int32        // default 5
    resetTimeout  time.Duration // default 5 minutes
}

func (cb *CircuitBreaker) IsAvailable() bool { ... }
func (cb *CircuitBreaker) RecordSuccess() { ... }
func (cb *CircuitBreaker) RecordFailure() { ... }
```

- Per-provider circuit breaker, initialized on provider load.
- Thread-safe via `sync/atomic`.
- No external dependencies (no Redis, no DB).
- Lost on restart → auto-recovered in seconds (next failure loop reopens).

---

## 10. Provider Store: Client Secret Handling

```go
type OIDCProvider struct {
    ID           uuid.UUID `json:"id"`
    Name         string    `json:"name"`
    IssuerURL    string    `json:"issuer_url"`
    ClientID     string    `json:"client_id"`
    ClientSecret string    `json:"-"`          // NEVER serialized
    HasSecret    bool      `json:"has_secret"` // Frontend indicator
    AttrUsername string    `json:"attr_username"`
    AttrGroups   *string   `json:"attr_groups"`
    Enabled      bool      `json:"enabled"`
    CreatedAt    time.Time `json:"created_at"`
    UpdatedAt    time.Time `json:"updated_at"`
}
```

- `ClientSecret` uses `json:"-"` — compile-time guarantee it's never in API responses.
- GET endpoints populate `HasSecret = true` when `ClientSecret != ""` (after decrypting to check).
- POST/PATCH handlers receive `client_secret` over HTTPS, encrypt with `secrets.Encrypt()` before storing.
- PATCH with empty `client_secret` = keep existing secret.

---

## 11. Security Notes

| Concern | Mitigation |
|---------|-----------|
| CSRF (state) | HMAC-signed cookie, single-use, path-scoped to callback |
| Token replay | Nonce in ID token (mandatory), verified on callback |
| Secret leak | `json:"-"` on ClientSecret, encrypted at rest (AES-256-GCM) |
| IdP outage | Circuit breaker per provider, password fallback |
| Redirect hijack | `redirect_uri` validated server-side against configured value |
| Token theft | Auth cookie Secure+HttpOnly+SameSite=Lax |
| Rogue provider creation | Admin-only endpoints, JWT + role check |
| SSO REQUIRED lockout | Admin can still access via direct `localhost` login (bypass env var) |

---

## 12. Implementation Order

### Phase 1 — Backend core (F1)
1. `internal/oidc/circuitbreaker.go` — CircuitBreaker type
2. `internal/oidc/config.go` — Config struct
3. `internal/oidc/provider.go` — Provider struct + circuit breaker integration
4. `internal/oidc/store.go` — CRUD for oidc_providers table
5. `internal/oidc/identity.go` — CRUD for oidc_identities table
6. `internal/oidc/callback.go` — Token validation, user lookup/creation, JWT issuance
7. Migration `042_oidc.sql`
8. Wire up in `cmd/api/main.go` — route registration + OIDCConfig

### Phase 2 — Handlers (F2)
1. `internal/handlers/oidc.go` — all public + admin endpoints
2. Modify `internal/handlers/auth.go` — SSO error for OIDC users
3. Add config fields to `internal/config/config.go`
4. Update `.env.example`

### Phase 3 — Frontend (F3)
1. Login page — OIDC button, SSO_REQUIRED mode
2. Settings page — SSO provider management
3. Profile completion page (F3.1)

### Phase 4 — Polish (F4)
1. Landing page — update SSO/SAML text
2. TODO.md — update backlog
3. Update `.env.example`
4. New settings API route

---

## 13. Testing Plan

### Unit tests
- `internal/oidc/circuitbreaker_test.go`: state transitions, thread safety, timeout recovery
- `internal/oidc/callback_test.go`: token validation, user creation/lookup
- `internal/oidc/store_test.go`: CRUD operations (using test DB)

### Integration tests
- OIDC callback handler with mock IdP (httptest server returning JWKS + tokens)
- Login handler with OIDC user — verify `sso_required` error
- Provider management admin-only enforcement

### Manual testing checklist
- [ ] Full flow: click "Sign in with Okta" → IdP login → redirect back → dashboard
- [ ] First-time user: auto-create account, redirect to dashboard
- [ ] Returning user: update last_login, same user linked
- [ ] SSO required: password form hidden, only OIDC button visible
- [ ] Circuit breaker: stop IdP → 5 failures → open → 5 min → half-open → recover
- [ ] Provider CRUD: create, edit (keep secret), edit (change secret), delete cascade
- [ ] `sso_required` error: existing OIDC user tries password login
- [ ] Profile completion: OIDC login without username claim

---

## 14. Dependencies

- **New Go dependency:** `github.com/coreos/go-oidc/v3` — OIDC token verification and JWKS fetching
  - Already widely used, mature, maintained. Replaces writing raw JWKS/JWT verification.
  - Also consider `github.com/zitadel/oidc/v3` as alternative (more features, heavier).

---

## 15. Open Questions (resolved)

| Question | Decision |
|----------|----------|
| SAML support? | No. OIDC only. |
| Separate auth DB? | No. Same Postgres. |
| PKCE? | Not in F1. Authorization Code flow with nonce is sufficient for confidential clients. PKCE can be added if we want public client (SPA-only) flow later. |
| Build tags for enterprise? | No. Env var gating only (`SSO_ENABLED`). |
| Redis for circuit breaker? | No. In-memory atomic state is correct for this use case. |
| Auto-link existing user by email? | Yes, if `sub` not found and email matches existing user, link identity. |
| What if IdP never sends username claim? | Profile completion form (post-login, one-time). |
| SAML text on landing page? | Change to "Single Sign-On (OIDC)". |
| Max providers? | No hard limit. In practice 1-3 per instance. |
