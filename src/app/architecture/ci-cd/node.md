# Node.js Security Scan Workflow Example

This guide shows how to configure HenKaiPan security scans for a Node.js project.

---

## 1. Create an API Token

Follow the [GitHub Actions Setup Guide](./github-actions.md) to create an API token and add it as a GitHub Secret.

---

## 2. Add the Workflow

Create `.github/workflows/security.yml` in your repository:

```yaml
name: Node.js Security Scan

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

---

## What Gets Scanned

| Scanner | What it finds |
|---------|---------------|
| **semgrep** | Insecure code patterns, SQL injection, XSS, hardcoded secrets in JS/TS |
| **trivy** | Vulnerable npm packages (known CVEs in dependencies) |
| **gitleaks** | Secrets, API keys, tokens committed to the repository |

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

### Custom semgrep rules
```yaml
scanners: semgrep
```

---

## Environment Variables

If your Node.js app uses environment variables at build time:

```yaml
- name: Build
  run: npm run build
  env:
    NODE_ENV: production
```

The HenKaiPan scan itself doesn't need build artifacts — semgrep and gitleaks analyze source code directly.

---

## Excluding Files

Add a `.semgrepignore` or `.snyk` file to exclude paths from scanning:

```
node_modules/
dist/
coverage/
.env
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