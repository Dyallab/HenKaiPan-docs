# GitHub Actions Workflow Examples

This guide shows how to configure HenKaiPan security scans for different project types using GitHub Actions.

---

## 1. Create an API Token

Follow the [GitHub Actions Setup Guide](./github-actions.md) to create an API token and add it as a GitHub Secret.

---

## 2. Add a Workflow

Create `.github/workflows/security.yml` in your repository. Pick the setup step that matches your project:

### Node.js

```yaml
name: Security Scan

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run HenKaiPan Security Scan
        uses: dyallab/henkaipan-action@v1
        with:
          api-url: ${{ secrets.HENKAIPAN_API_URL }}
          api-key: ${{ secrets.HENKAIPAN_API_KEY }}
          project-id: ${{ secrets.HENKAIPAN_PROJECT_ID }}
          scanners: "semgrep,trivy,gitleaks"
          fail-on-severity: high
```

### Python

```yaml
name: Security Scan

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: "pip"

      - name: Install dependencies
        run: |
          pip install -r requirements.txt --upgrade pip

      - name: Run HenKaiPan Security Scan
        uses: dyallab/henkaipan-action@v1
        with:
          api-url: ${{ secrets.HENKAIPAN_API_URL }}
          api-key: ${{ secrets.HENKAIPAN_API_KEY }}
          project-id: ${{ secrets.HENKAIPAN_PROJECT_ID }}
          scanners: "semgrep,trivy,gitleaks"
          fail-on-severity: high
```

### Go

```yaml
name: Security Scan

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Go
        uses: actions/setup-go@v5
        with:
          go-version: "1.22"
          cache: true

      - name: Download dependencies
        run: go mod download

      - name: Run HenKaiPan Security Scan
        uses: dyallab/henkaipan-action@v1
        with:
          api-url: ${{ secrets.HENKAIPAN_API_URL }}
          api-key: ${{ secrets.HENKAIPAN_API_KEY }}
          project-id: ${{ secrets.HENKAIPAN_PROJECT_ID }}
          scanners: "semgrep,trivy,gitleaks"
          fail-on-severity: high
```

---

## What Gets Scanned

| Scanner | Node.js | Python | Go |
|---------|---------|--------|-----|
| **semgrep** | Insecure code patterns, SQL injection, XSS, hardcoded secrets in JS/TS | Insecure code patterns, SQL injection, XSS, hardcoded secrets in Python | Insecure code patterns, SQL injection, command injection, hardcoded secrets in Go |
| **trivy** | Vulnerable npm packages (known CVEs in dependencies) | Vulnerable pip packages (known CVEs in dependencies) | Vulnerable Go modules (known CVEs in dependencies) |
| **gitleaks** | Secrets, API keys, tokens committed to the repository | Secrets, API keys, tokens committed to the repository | Secrets, API keys, tokens committed to the repository |

---

## Configuration Tips

### Fast SAST Scan (no dependency check)
```yaml
scanners: semgrep
fail-on-severity: medium
```

### Full Scan (SAST + SCA + secrets)
```yaml
scanners: all
fail-on-severity: high
```

### Only Scan on PRs (skip on push to main)
```yaml
on:
  pull_request:
    branches: [main]
```

### Node.js — Environment Variables at Build Time

If your Node.js app uses environment variables at build time:

```yaml
- name: Build
  run: npm run build
  env:
    NODE_ENV: production
```

The HenKaiPan scan itself doesn't need build artifacts — semgrep and gitleaks analyze source code directly.

### Python — Using a requirements.txt freeze
```yaml
- name: Install dependencies
  run: pip install -r requirements.txt
```

### Python — Poetry or PDM
```yaml
- name: Install dependencies
  uses: PDM action/setup-pdm@v3
  with:
    python-version: "3.12"
- name: Install project
  run: pdm install
```

### Go — Using Go workspaces
```yaml
- name: Set up Go
  uses: actions/setup-go@v5
  with:
    go-version: "1.22"
    cache: true
- name: Set up workspace
  run: go work use ./...
```

### Go — Using Private Modules

If your project uses private Go modules, configure authentication before scanning:

```yaml
- name: Configure git
  run: |
    git config --global url."https://${{ secrets.GH_TOKEN }}@github.com/".insteadOf "https://github.com/"
```

Then run the scan after `go mod download`.

---

## Excluding Files

Add a `.semgrepignore` file to exclude paths from scanning:

### Node.js
```
node_modules/
dist/
coverage/
.env
```

### Python
```
venv/
.venv/
__pycache__/
*.pyc
.env
.env.local
.git/
.eggs/
```

### Go
```
vendor/
bin/
dist/
*.test.go
*_test.go
.go/
```

---

## CI/CD Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `api-url` | Yes | — | HenKaiPan instance URL |
| `api-key` | Yes | — | API token |
| `project-id` | No | — | Project UUID. If omitted, auto-created from repo name |
| `scanners` | No | `all` | Scanner list |
| `fail-on-severity` | No | — | Minimum severity to block |

---

## See Also

- [GitHub Actions Setup](./github-actions.md)
- [GitLab CI Setup](./gitlab-ci.md)
- [Jenkins Setup](./jenkins.md)
- [Docker Scan](./docker.md)
