# CLI Commands Reference

Complete reference for every command, flag, and environment variable in
`henkaipan-cli`. Companion to the [CLI overview](./cli.md).

---

## Global flags

These flags are available on every subcommand.

| Flag                        | Env var                              | Default                                | Description |
| --------------------------- | ------------------------------------ | -------------------------------------- | --- |
| `--api-url`                 | `HENKAIPAN_API_URL`                  | `https://henkaipan.dyallab.com.ar`     | Base URL of the HenKaiPan API |
| `--api-key`                 | `HENKAIPAN_API_KEY`                  | *(none — required)*                    | API token (sent as `X-API-Key`) |
| `--cf-access-client-id`     | `HENKAIPAN_CF_ACCESS_CLIENT_ID`      | *(none)*                               | Cloudflare Access Service Token client ID |
| `--cf-access-client-secret` | `HENKAIPAN_CF_ACCESS_CLIENT_SECRET`  | *(none)*                               | Cloudflare Access Service Token client secret |
| `--output`                  | `HENKAIPAN_OUTPUT`                   | `table`                                | Output format: `table`, `json`, `yaml` |
| `--timeout`                 | `HENKAIPAN_TIMEOUT`                  | `60`                                   | HTTP request timeout in seconds |

---

## `henkaipan scan run`

Trigger a scan via `POST /api/v1/scans/external`.

```text
Usage:
  henkaipan scan run [flags]

Flags:
      --repo-url string        Repository URL (auto-creates the project on first run)
      --project-id string      UUID of an existing project (mutually exclusive with --repo-url)
      --scanners string        Comma-separated scanners or pack (all, sast, sca, secrets, vuln, containers) (default "all")
      --branch string          Git branch to scan (defaults to the project's default branch)
      --auto-create-project    Auto-create the project from --repo-url when --project-id is empty (default true)
      --wait                   Block until all scans reach a terminal state
      --poll-interval int      Seconds between status polls when --wait is set (default 15)
      --fail-on string         Exit 1 if any finding meets or exceeds this severity
```

### Behavior

- Exactly one of `--repo-url` or `--project-id` is required. They are
  mutually exclusive.
- When `--project-id` is empty and `--auto-create-project` is `true`
  (default), the project is created from the repo URL on first scan —
  mirrors `henkaipan-action`'s `auto-create-project` input.
- `--wait` blocks until every triggered scan reaches `completed` or
  `failed`, then exits non-zero if `--fail-on` severity is met or any
  scan failed. Polling respects `--poll-interval` (default 15s) and
  times out at 20 minutes.

### Examples

```bash
# Auto-create project from repo URL, default scanners
henkaipan scan run --repo-url https://github.com/owner/repo

# Specific project + scanners + branch, wait and fail on high
henkaipan scan run --project-id <uuid> --scanners semgrep,trivy --branch main \
    --wait --fail-on high
```

---

## `henkaipan scan status <scan-id>`

Read `GET /api/v1/scans/{id}/status` (one-shot by default, or poll with `--wait`).

```text
Usage:
  henkaipan scan status <scan-id> [flags]

Args:
  <scan-id>                   UUID of the scan to query

Flags:
      --wait               Block until the scan reaches a terminal state
      --poll-interval int  Seconds between status polls (default 15)
      --fail-on string     Exit 1 if any finding meets or exceeds this severity
```

### Examples

```bash
henkaipan scan status <scan-id>
henkaipan scan status <scan-id> --wait --fail-on high
```

---

## `henkaipan findings list`

Query `GET /api/findings` with filters and pagination.

```text
Usage:
  henkaipan findings list [flags]

Flags:
      --severity string    Filter by severity (critical|high|medium|low)
      --status string      Filter by finding status (e.g. open, fixed)
      --scanner string     Filter by scanner name (semgrep, trivy, gitleaks, grype, nuclei)
      --project-id string  Scope to a project UUID
      --page int           Page number (default 1)
      --page-size int      Results per page (default 50)
      --fail-on string     Exit 1 if any finding meets or exceeds this severity
```

### Examples

```bash
henkaipan findings list --severity high --project-id <uuid>
henkaipan findings list --scanner semgrep --page 2 --page-size 50
henkaipan findings list --fail-on critical
```

---

## `henkaipan findings export`

Stream `GET /api/findings/export` to stdout or to a file.

```text
Usage:
  henkaipan findings export [flags]

Flags:
      --format string      Export format: json or csv (default json)
      --severity string    Filter by severity
      --status string      Filter by finding status
      --scanner string     Filter by scanner name
      --project-id string  Scope to a project UUID
      --output string      Write to this file instead of stdout
```

### Examples

```bash
henkaipan findings export --format json --severity critical
henkaipan findings export --format csv --project-id <uuid> --output findings.csv
```

---

## Severity weights

`--fail-on` uses the same severity weights as `henkaipan-action`:

| Severity | Weight |
| --- | ---: |
| critical | 4 |
| high | 3 |
| medium | 2 |
| low | 1 |

`--fail-on high` means **"fail if any finding is high or critical"** — it
is not "fail if all findings are high". This matches `gh`, `golangci-lint`,
and the action's contract.

---

## Exit codes

| Code | Meaning |
| ---: | --- |
| `0` | Success |
| `1` | Generic failure (network, server error, invalid input) |
| `1` | `--fail-on` threshold met |
| `1` | One or more scans failed (when `--wait` is set) |

The CLI does not yet emit distinct codes per failure mode — this is a
known limitation tracked for the next minor release.
