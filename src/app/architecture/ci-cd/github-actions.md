# GitHub Actions Setup Guide

Connect HenKaiPan security scans to your GitHub Actions CI/CD pipeline.

---

## Prerequisites

- A running HenKaiPan instance (cloud or self-hosted)
- A project created in HenKaiPan
- GitHub repository

---

## 1. Create an API Token

1. Open your HenKaiPan instance → **Settings → API Tokens**
2. Click **New Token**
3. Give it a name (e.g. `GitHub Actions Production`)
4. Optionally scope it to a specific project
5. Copy the token — it's shown **only once**

---

## 2. Add Secrets to GitHub

1. Go to your GitHub repository → **Settings → Secrets and variables → Actions**
2. Click **New repository secret** and add:

| Secret Name | Value |
|-------------|-------|
| `HENKAIPAN_API_URL` | Your HenKaiPan URL (e.g. `https://app.henkaipan.com`) |
| `HENKAIPAN_API_KEY` | The token from step 1 |
| `HENKAIPAN_PROJECT_ID` | Your project UUID (found in project Settings) |

---

## 3. Add the Workflow

Create `.github/workflows/security.yml` in your repository:

```yaml
name: HenKaiPan Security Scan

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write       # required for PR comments
    steps:
      - uses: actions/checkout@v4

      - name: Run HenKaiPan Security Scan
        uses: dyallab/henkaipan-action@v1
        with:
          api-url: ${{ secrets.HENKAIPAN_API_URL }}
          api-key: ${{ secrets.HENKAIPAN_API_KEY }}
          project-id: ${{ secrets.HENKAIPAN_PROJECT_ID }}
          scanners: all
          fail-on-severity: critical
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Configuration Options

### Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `api-url` | Yes | — | Base URL of your HenKaiPan instance |
| `api-key` | Yes | — | API token from HenKaiPan Settings |
| `project-id` | Yes | — | UUID of the project to scan |
| `scanners` | No | `all` | Scanner names or packs |
| `fail-on-severity` | No | — | Block pipeline on findings ≥ severity |
| `scan-branch` | No | current branch | Git branch to scan |
| `post-pr-comment` | No | `true` | Post results summary to PR |

### Scanner Packs

| Pack | Scanners Included |
|------|-------------------|
| `all` | semgrep, trivy, gitleaks, grype, nuclei |
| `sast` | semgrep |
| `sca` | trivy, grype |
| `secrets` | gitleaks |
| `vuln` | grype, nuclei |
| `containers` | trivy, grype |

### Examples

**SAST only (fast scan):**
```yaml
scanners: semgrep
fail-on-severity: medium
```

**Full scan with blocking:**
```yaml
scanners: all
fail-on-severity: high
```

**Disable PR comments:**
```yaml
post-pr-comment: "false"
```

---

## Outputs

The action exposes these outputs for use in subsequent steps:

| Output | Description |
|--------|-------------|
| `scan-id` | Comma-separated scan IDs |
| `finding-count` | Total findings |
| `finding-critical` | Critical findings count |
| `finding-high` | High findings count |
| `finding-medium` | Medium findings count |
| `finding-low` | Low findings count |

---

## Self-Hosted Runners (Private Networks)

If your HenKaiPan instance is on an internal network, use a **self-hosted runner** on the same network:

```yaml
jobs:
  security-scan:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4

      - name: Run HenKaiPan Security Scan
        uses: dyallab/henkaipan-action@v1
        with:
          api-url: http://10.0.0.5:8080
          api-key: ${{ secrets.HENKAIPAN_API_KEY }}
          project-id: ${{ secrets.HENKAIPAN_PROJECT_ID }}
          scanners: all
```

---

## Stack-Specific Examples

- [Node.js](./node.md)
- [Go](./go.md)
- [Python](./python.md)
- [Docker](./docker.md)

---

## See Also

- [GitHub Action README](https://github.com/Dyallab/henkaipan-action)
- [HenKaiPan Dashboard](/dashboard)