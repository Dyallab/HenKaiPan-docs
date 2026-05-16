# GitLab CI Setup Guide

Connect HenKaiPan security scans to your GitLab CI/CD pipeline.

---

## Prerequisites

- A running HenKaiPan instance (cloud or self-hosted)
- A project created in HenKaiPan
- A GitLab repository

---

## 1. Create an API Token

1. Open your HenKaiPan instance → **Settings → API Tokens**
2. Click **New Token**
3. Give it a name (e.g. `GitLab CI Production`)
4. Optionally scope it to a specific project
5. Copy the token — it's shown **only once**

---

## 2. Add CI/CD Variables to GitLab

1. Go to your GitLab repository → **Settings → CI/CD → Variables**
2. Click **Add variable** and add:

| Variable Name | Value | Options |
|---------------|-------|---------|
| `HENKAIPAN_API_URL` | Your HenKaiPan URL (e.g. `https://app.henkaipan.com`) | Masked, Protected |
| `HENKAIPAN_API_KEY` | The token from step 1 | Masked, Protected |
| `HENKAIPAN_PROJECT_ID` | Your project UUID (found in project Settings) | Masked, Protected |

Enable **Mask variable** for each to prevent secret exposure in logs.

---

## 3. Add the Pipeline

Create `.gitlab-ci.yml` in your repository root:

```yaml
stages:
  - security

henkaipan-scan:
  stage: security
  image: docker:24-dind
  services:
    - docker:24-dind
  script:
    - |
      docker run --rm \
        -e HENKAIPAN_API_URL="$HENKAIPAN_API_URL" \
        -e HENKAIPAN_API_KEY="$HENKAIPAN_API_KEY" \
        -e HENKAIPAN_PROJECT_ID="$HENKAIPAN_PROJECT_ID" \
        -e HENKAIPAN_SCANNERS="all" \
        -e HENKAIPAN_FAIL_ON_SEVERITY="critical" \
        -e HENKAIPAN_POST_PR_COMMENT="true" \
        -v /var/run/docker.sock:/var/run/docker.sock \
        dyallab/henkaipan-action:v1
  rules:
    - if: '$CI_PIPELINE_SOURCE == "push" && $CI_COMMIT_BRANCH == "main"'
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
  allow_failure: false
```

Or use a shell-based runner (no Docker needed):

```yaml
stages:
  - security

henkaipan-scan:
  stage: security
  image: alpine:3.19
  variables:
    - HENKAIPAN_API_URL
    - HENKAIPAN_API_KEY
    - HENKAIPAN_PROJECT_ID
  script:
    - apk add --no-cache curl jq bash
    - |
      docker run --rm \
        -e HENKAIPAN_API_URL="$HENKAIPAN_API_URL" \
        -e HENKAIPAN_API_KEY="$HENKAIPAN_API_KEY" \
        -e HENKAIPAN_PROJECT_ID="$HENKAIPAN_PROJECT_ID" \
        -e HENKAIPAN_SCANNERS="all" \
        -e HENKAIPAN_FAIL_ON_SEVERITY="high" \
        dyallab/henkaipan-action:v1
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
```

---

## Configuration Options

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HENKAIPAN_API_URL` | Yes | — | Base URL of your HenKaiPan instance |
| `HENKAIPAN_API_KEY` | Yes | — | API token from HenKaiPan Settings |
| `HENKAIPAN_PROJECT_ID` | Yes | — | UUID of the project to scan |
| `HENKAIPAN_SCANNERS` | No | `all` | Scanner names or packs |
| `HENKAIPAN_FAIL_ON_SEVERITY` | No | — | Block pipeline on findings ≥ severity |
| `HENKAIPAN_SCAN_BRANCH` | No | current branch | Git branch to scan |
| `HENKAIPAN_POST_PR_COMMENT` | No | `true` | Post results summary to MR |

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
-e HENKAIPAN_SCANNERS="semgrep"
-e HENKAIPAN_FAIL_ON_SEVERITY="medium"
```

**Full scan with blocking:**
```yaml
-e HENKAIPAN_SCANNERS="all"
-e HENKAIPAN_FAIL_ON_SEVERITY="high"
```

**Disable MR comments:**
```yaml
-e HENKAIPAN_POST_PR_COMMENT="false"
```

---

## Outputs

The action exposes these outputs (use in subsequent jobs via artifacts):

| Output | Description |
|--------|-------------|
| `scan-id` | Comma-separated scan IDs |
| `finding-count` | Total findings |
| `finding-critical` | Critical findings count |
| `finding-high` | High findings count |
| `finding-medium` | Medium findings count |
| `finding-low` | Low findings count |

Access them by parsing the job log or using GitLab CI/CD variables.

---

## Self-Hosted Runners (Private Networks)

If your GitLab runner is on the same network as your HenKaiPan instance:

```yaml
henkaipan-scan:
  stage: security
  tags:
    - self-hosted
  script:
    - |
      docker run --rm \
        -e HENKAIPAN_API_URL="http://10.0.0.5:8080" \
        -e HENKAIPAN_API_KEY="$HENKAIPAN_API_KEY" \
        -e HENKAIPAN_PROJECT_ID="$HENKAIPAN_PROJECT_ID" \
        -e HENKAIPAN_SCANNERS="all" \
        dyallab/henkaipan-action:v1
```

---

## Stack-Specific Examples

- [Node.js](./node.md)
- [Go](./go.md)
- [Python](./python.md)
- [Docker](./docker.md)

---

## See Also

- [GitHub Actions Setup](./github-actions.md)
- [Jenkins Setup](./jenkins.md)
- [HenKaiPan Dashboard](/dashboard)