# CircleCI Setup Guide

Connect HenKaiPan security scans to your CircleCI pipeline.

---

## Prerequisites

- A running HenKaiPan instance (cloud or self-hosted)
- A project created in HenKaiPan
- A CircleCI account with a connected repository

---

## 1. Create an API Token

1. Open your HenKaiPan instance → **Settings → API Tokens**
2. Click **New Token**
3. Give it a name (e.g. `CircleCI Production`)
4. Optionally scope it to a specific project
5. Copy the token — it's shown **only once**

---

## 2. Add Environment Variables to CircleCI

1. Go to your CircleCI project → **Project Settings → Environment Variables**
2. Click **Add Environment Variable** and add:

| Variable Name | Value |
|---------------|-------|
| `HENKAIPAN_API_URL` | Your HenKaiPan URL (e.g. `https://app.henkaipan.com`) |
| `HENKAIPAN_API_KEY` | The token from step 1 |
| `HENKAIPAN_PROJECT_ID` | Your project UUID (found in project Settings) |

---

## 3. Add the Pipeline

Create `.circleci/config.yml` in your repository root:

```yaml
version: 2.1

orbs:
  docker: circleci/docker@1.7.0

jobs:
  security-scan:
    docker:
      - image: docker:24-dind
    steps:
      - checkout

      - setup_remote_docker:
          version: 24.0.7

      - run:
          name: Run HenKaiPan Security Scan
          command: |
            docker run --rm \
              -e HENKAIPAN_API_URL="${HENKAIPAN_API_URL}" \
              -e HENKAIPAN_API_KEY="${HENKAIPAN_API_KEY}" \
              -e HENKAIPAN_PROJECT_ID="${HENKAIPAN_PROJECT_ID}" \
              -e HENKAIPAN_SCANNERS="all" \
              -e HENKAIPAN_FAIL_ON_SEVERITY="critical" \
              -e HENKAIPAN_POST_PR_COMMENT="true" \
              -v /var/run/docker.sock:/var/run/docker.sock \
              dyallab/henkaipan-action:v1

workflows:
  security:
    jobs:
      - security-scan:
          filters:
            branches:
              only:
                - main
```

Or using a shell executor (no DinD required):

```yaml
version: 2.1

jobs:
  security-scan:
    machine:
      image: ubuntu-2204:current
    steps:
      - checkout

      - run:
          name: Install Docker CLI
          command: |
            sudo apt-get update && sudo apt-get install -y docker.io

      - run:
          name: Run HenKaiPan Security Scan
          environment:
            HENKAIPAN_API_URL: << pipeline.parameters.api-url >>
            HENKAIPAN_API_KEY: << pipeline.parameters.api-key >>
            HENKAIPAN_PROJECT_ID: << pipeline.parameters.project-id >>
          command: |
            docker run --rm \
              -e HENKAIPAN_API_URL="${HENKAIPAN_API_URL}" \
              -e HENKAIPAN_API_KEY="${HENKAIPAN_API_KEY}" \
              -e HENKAIPAN_PROJECT_ID="${HENKAIPAN_PROJECT_ID}" \
              -e HENKAIPAN_SCANNERS="all" \
              -e HENKAIPAN_FAIL_ON_SEVERITY="high" \
              dyallab/henkaipan-action:v1

parameters:
  api-url:
    type: string
    default: ""
  api-key:
    type: string
    default: ""
  project-id:
    type: string
    default: ""

workflows:
  security:
    jobs:
      - security-scan:
          filters:
            branches:
              only:
                - main
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
| `HENKAIPAN_POST_PR_COMMENT` | No | `true` | Post results summary to PR |

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

**Disable PR comments:**
```yaml
-e HENKAIPAN_POST_PR_COMMENT="false"
```

---

## Using Contexts (Reusable Environment Variables)

If you manage multiple projects, use a CircleCI Context to share HenKaiPan credentials:

```yaml
workflows:
  security:
    jobs:
      - security-scan:
          context: henkaipan-credentials
          filters:
            branches:
              only:
                - main
```

Create the context in **Organization Settings → Contexts** with the same environment variables (`HENKAIPAN_API_URL`, `HENKAIPAN_API_KEY`, `HENKAIPAN_PROJECT_ID`).

---

## Using Output Values

The action prints scan results to the job log. To parse them programmatically:

```yaml
- run:
    name: Parse scan results
    command: |
      # Scan results are in the job output
      SCAN_ID=$(grep -oP 'scan-id=\K[^ ]+' <<< "$(docker run --rm ...)")
      echo "Scan ID: $SCAN_ID"
```

For artifact-based results:

```yaml
- run:
    name: Run HenKaiPan Security Scan
    command: |
      docker run --rm \
        -e HENKAIPAN_API_URL="${HENKAIPAN_API_URL}" \
        -e HENKAIPAN_API_KEY="${HENKAIPAN_API_KEY}" \
        -e HENKAIPAN_PROJECT_ID="${HENKAIPAN_PROJECT_ID}" \
        -v ${CIRCLE_WORKING_DIRECTORY}:/workspace \
        dyallab/henkaipan-action:v1 > /workspace/scan-results.txt

  - store_artifacts:
      path: scan-results.txt
```

---

## Self-Hosted CircleCI (Private Networks)

If CircleCI runner and HenKaiPan are on the same internal network:

```yaml
- run:
    name: Run HenKaiPan Security Scan (internal)
    command: |
      docker run --rm \
        -e HENKAIPAN_API_URL="http://10.0.0.5:8080" \
        -e HENKAIPAN_API_KEY="${HENKAIPAN_API_KEY}" \
        -e HENKAIPAN_PROJECT_ID="${HENKAIPAN_PROJECT_ID}" \
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
- [GitLab CI Setup](./gitlab-ci.md)
- [Jenkins Setup](./jenkins.md)
- [HenKaiPan Dashboard](/dashboard)