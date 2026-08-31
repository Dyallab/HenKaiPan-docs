# HenKaiPan CLI (`henkaipan-cli`)

The `henkaipan` CLI is the standalone, client-agnostic companion to the
`dyallab/henkaipan-action` GitHub Action. It is a single static Go binary
that talks to the same HenKaiPan REST API under the same `X-API-Key`
authentication — but you can run it from any shell, script, CI step, or
agent prompt that can execute a binary.

Use this guide if you want to drive HenKaiPan from a context where the
GitHub Action is not a good fit: arbitrary CI runners, cron jobs, local
terminal sessions, ad-hoc security audits, or scripted bulk operations.

---

## When to use the CLI vs the action

| Use the GitHub Action | Use the CLI |
| --- | --- |
| `on: pull_request` with auto PR comments | GitLab CI, Jenkins, CircleCI, Drone, Buildkite, or any runner that can install a binary |
| `$GITHUB_STEP_SUMMARY` rendering | Cron / scheduled scans from a server with no GitHub context |
| Pin to a published Docker image | Local terminal exploration and debugging |
| One-click reuse of `GITHUB_TOKEN` | Long-running scripts that need API access from arbitrary hosts |
|  | Piping findings into `jq`, custom dashboards, or downstream tools |

The CLI is intentionally a thin orchestration layer over the same REST
endpoints the action calls. There is no parallel implementation to drift.

---

## Install

```bash
# Recommended: install via Go
go install github.com/dyallab/henkaipan-cli/cmd/henkaipan@latest

# Or pin to a tag
go install github.com/dyallab/henkaipan-cli/cmd/henkaipan@v0.1.0
```

Or grab a prebuilt binary from the
[Releases](https://github.com/Dyallab/henkaipan-cli/releases) page.
Binaries are published for `linux` / `darwin` / `windows` × `amd64` / `arm64`.

Verify the install:

```bash
henkaipan version
# henkaipan-cli/0.1.0
```

---

## Configuration

Configuration resolves in this order (highest priority first):

1. CLI flags (`--api-url`, `--api-key`, ...)
2. Environment variables (`HENKAIPAN_*`)
3. Built-in defaults

| Flag                        | Env var                              | Default                                |
| --------------------------- | ------------------------------------ | -------------------------------------- |
| `--api-url`                 | `HENKAIPAN_API_URL`                  | `https://henkaipan.dyallab.com.ar`     |
| `--api-key`                 | `HENKAIPAN_API_KEY`                  | *(none — required)*                    |
| `--cf-access-client-id`     | `HENKAIPAN_CF_ACCESS_CLIENT_ID`      | *(none)*                               |
| `--cf-access-client-secret` | `HENKAIPAN_CF_ACCESS_CLIENT_SECRET`  | *(none)*                               |
| `--output`                  | `HENKAIPAN_OUTPUT`                   | `table`                                |
| `--timeout`                 | `HENKAIPAN_TIMEOUT`                  | `60`                                   |

> **Security:** the API key is wrapped in a typed value that masks itself
> on every format verb (`%s`, `%v`, `String()`). If you ever see `***` in
> debug output, that is by design.

---

## Quickstart

```bash
export HENKAIPAN_API_URL=https://henkaipan.dyallab.com.ar
export HENKAIPAN_API_KEY=hkp_xxxxxxxxxxxxxxxxxxxx

# Trigger a scan and wait, failing on high+ findings
henkaipan scan run \
  --repo-url https://github.com/owner/repo \
  --scanners all \
  --branch main \
  --wait \
  --fail-on high

# Query a scan in flight
henkaipan scan status <scan-id> --wait

# List findings
henkaipan findings list --severity high --project-id <uuid>

# Export for an external tool
henkaipan findings export --format json --severity critical --output findings.json
```

For the full command reference, see the
[CLI Commands reference](./cli-commands.md).

---

## CI integration examples

### Generic Linux runner

```yaml
- name: Run HenKaiPan security scan
  env:
    HENKAIPAN_API_URL: ${{ secrets.HENKAIPAN_API_URL }}
    HENKAIPAN_API_KEY: ${{ secrets.HENKAIPAN_API_KEY }}
  run: |
    henkaipan scan run \
      --repo-url "$CI_REPOSITORY_URL" \
      --branch  "$CI_COMMIT_REF_NAME" \
      --wait \
      --fail-on high
```

### Behind Cloudflare Access

```yaml
- name: Run HenKaiPan security scan
  env:
    HENKAIPAN_API_URL: ${{ secrets.HENKAIPAN_API_URL }}
    HENKAIPAN_API_KEY: ${{ secrets.HENKAIPAN_API_KEY }}
    HENKAIPAN_CF_ACCESS_CLIENT_ID: ${{ secrets.CF_CLIENT_ID }}
    HENKAIPAN_CF_ACCESS_CLIENT_SECRET: ${{ secrets.CF_CLIENT_SECRET }}
  run: henkaipan scan run --repo-url "$CI_REPOSITORY_URL" --wait --fail-on high
```

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `received HTML (HTTP 403) ... likely a proxy/firewall challenge` | Reverse proxy (often Cloudflare) is returning a challenge page | Add a WAF skip rule for `/api/v1/*`, or pass `--cf-access-client-id` / `--cf-access-client-secret` for Cloudflare Access |
| `api: HTTP 401 from <url>` | Missing or invalid API key | Confirm `HENKAIPAN_API_KEY` is set and the token has not been revoked |
| `api: HTTP 403 ... token is not scoped to this project` | Project-scoped token used against a different project | Generate a new unscoped token, or scope it to the correct project |
| Scan times out at 20 minutes | Default max wait reached | Use `--scanners semgrep,trivy` (smaller set), or scale up the HenKaiPan worker pool |

---

## Related

- [CLI Commands reference](./cli-commands.md) — full flag/env reference
- [GitHub Actions](./github-actions.md) — when the Action is a better fit
- [CI/CD Quickstart](./quickstart.md) — language-agnostic external-scan overview
- [`Dyallab/henkaipan-cli`](https://github.com/Dyallab/henkaipan-cli) — source, releases, changelog
