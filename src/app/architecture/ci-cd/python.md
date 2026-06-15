# Python Security Scan Workflow Example

This guide shows how to configure HenKaiPan security scans for a Python project.

---

## 1. Create an API Token

Follow the [GitHub Actions Setup Guide](./github-actions.md) to create an API token and add it as a GitHub Secret.

---

## 2. Add the Workflow

Create `.github/workflows/security.yml` in your repository:

```yaml
name: Python Security Scan

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

---

## What Gets Scanned

| Scanner | What it finds |
|---------|---------------|
| **semgrep** | Insecure code patterns, SQL injection, XSS, hardcoded secrets in Python |
| **trivy** | Vulnerable pip packages (known CVEs in dependencies) |
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

### Using a requirements.txt freeze
```yaml
- name: Install dependencies
  run: pip install -r requirements.txt
```

### Poetry or PDM
```yaml
- name: Install dependencies
  uses: PDM action/setup-pdm@v3
  with:
    python-version: "3.12"
- name: Install project
  run: pdm install
```

---

## Excluding Files

Add a `.semgrepignore` file to exclude paths from scanning:

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