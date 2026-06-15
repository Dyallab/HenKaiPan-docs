# Go Security Scan Workflow Example

This guide shows how to configure HenKaiPan security scans for a Go project.

---

## 1. Create an API Token

Follow the [GitHub Actions Setup Guide](./github-actions.md) to create an API token and add it as a GitHub Secret.

---

## 2. Add the Workflow

Create `.github/workflows/security.yml` in your repository:

```yaml
name: Go Security Scan

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

| Scanner | What it finds |
|---------|---------------|
| **semgrep** | Insecure code patterns, SQL injection, command injection, hardcoded secrets in Go |
| **trivy** | Vulnerable Go modules (known CVEs in dependencies) |
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

### Using Go workspaces
```yaml
- name: Set up Go
  uses: actions/setup-go@v5
  with:
    go-version: "1.22"
    cache: true
- name: Set up workspace
  run: go work use ./...
```

---

## Excluding Files

Add a `.semgrepignore` file to exclude paths from scanning:

```
vendor/
bin/
dist/
*.test.go
*_test.go
.go/
```

---

## Using Private Modules

If your project uses private Go modules, configure authentication before scanning:

```yaml
- name: Configure git
  run: |
    git config --global url."https://${{ secrets.GH_TOKEN }}@github.com/".insteadOf "https://github.com/"
```

Then run the scan after `go mod download`.

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