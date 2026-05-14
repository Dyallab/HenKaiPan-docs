# Jenkins Setup Guide

Connect HenKaiPan security scans to your Jenkins CI/CD pipeline.

---

## Prerequisites

- A running HenKaiPan instance (cloud or self-hosted)
- A project created in HenKaiPan
- Jenkins with Docker support (for the action container)
- Pipeline Permissions or credentials plugin

---

## 1. Create an API Token

1. Open your HenKaiPan instance → **Settings → API Tokens**
2. Click **New Token**
3. Give it a name (e.g. `Jenkins Production`)
4. Optionally scope it to a specific project
5. Copy the token — it's shown **only once**

---

## 2. Add Credentials to Jenkins

1. Go to **Dashboard → Manage Jenkins → Credentials → System → Global credentials**
2. Click **Add Credentials**
3. Add three **Secret text** credentials:

| Credential ID | Value |
|--------------|-------|
| `HENKAIPAN_API_URL` | Your HenKaiPan URL (e.g. `https://app.henkaipan.com`) |
| `HENKAIPAN_API_KEY` | The token from step 1 |
| `HENKAIPAN_PROJECT_ID` | Your project UUID (found in project Settings) |

---

## 3. Add the Pipeline

#### Declarative Pipeline (recommended)

```groovy
pipeline {
    agent any

    environment {
        HENKAIPAN_API_URL = credentials('henkaipan-api-url')
        HENKAIPAN_API_KEY = credentials('henkaipan-api-key')
        HENKAIPAN_PROJECT_ID = credentials('henkaipan-project-id')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Security Scan') {
            steps {
                script {
                    def image = 'dyallab/henkaipan-action:v1'
                    def actionArgs = [
                        'docker', 'run', '--rm',
                        '-e', "HENKAIPAN_API_URL=${env.HENKAIPAN_API_URL}",
                        '-e', "HENKAIPAN_API_KEY=${env.HENKAIPAN_API_KEY}",
                        '-e', "HENKAIPAN_PROJECT_ID=${env.HENKAIPAN_PROJECT_ID}",
                        '-e', "HENKAIPAN_SCANNERS=all",
                        '-e', "HENKAIPAN_FAIL_ON_SEVERITY=critical",
                        '-v', '/var/run/docker.sock:/var/run/docker.sock',
                        image
                    ]
                    sh actionArgs.join(' ')
                }
            }
        }
    }

    post {
        failure {
            echo "HenKaiPan scan found critical issues or failed."
        }
    }
}
```

#### Scripted Pipeline

```groovy
node {
    stage('Checkout') {
        checkout scm
    }

    stage('Security Scan') {
        withCredentials([
            string(credentialsId: 'henkaipan-api-url', variable: 'API_URL'),
            string(credentialsId: 'henkaipan-api-key', variable: 'API_KEY'),
            string(credentialsId: 'henkaipan-project-id', variable: 'PROJECT_ID')
        ]) {
            sh """
                docker run --rm \
                    -e HENKAIPAN_API_URL="${API_URL}" \
                    -e HENKAIPAN_API_KEY="${API_KEY}" \
                    -e HENKAIPAN_PROJECT_ID="${PROJECT_ID}" \
                    -e HENKAIPAN_SCANNERS="all" \
                    -e HENKAIPAN_FAIL_ON_SEVERITY="high" \
                    -v /var/run/docker.sock:/var/run/docker.sock \
                    dyallab/henkaipan-action:v1
            """
        }
    }
}
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
| `HENKAIPAN_POST_PR_COMMENT` | No | `true` | Post results summary (GitHub/GitLab PR) |

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
```groovy
-e HENKAIPAN_SCANNERS="semgrep" \
-e HENKAIPAN_FAIL_ON_SEVERITY="medium" \
```

**Full scan with blocking:**
```groovy
-e HENKAIPAN_SCANNERS="all" \
-e HENKAIPAN_FAIL_ON_SEVERITY="high" \
```

**Disable PR comments:**
```groovy
-e HENKAIPAN_POST_PR_COMMENT="false" \
```

---

## Self-Hosted Jenkins (Private Networks)

If Jenkins and HenKaiPan are on the same internal network:

```groovy
environment {
    HENKAIPAN_API_URL = 'http://10.0.0.5:8080'
}
```

Or use a withCredentials block to inject the internal URL as a secret.

---

## Using Output Values

The action prints scan results to the build log. To parse them programmatically:

```groovy
stage('Parse Results') {
    steps {
        script {
            // Results are in the build log
            // Use grep or regex to extract scan-id, finding counts
            def log = currentBuild.rawBuild.log
            // Extract scan-id from log line: "scan-id=xxx"
        }
    }
}
```

For more advanced parsing, redirect output to a file:

```groovy
sh """
    docker run --rm \
        -e HENKAIPAN_API_URL="${API_URL}" \
        -e HENKAIPAN_API_KEY="${API_KEY}" \
        -e HENKAIPAN_PROJECT_ID="${PROJECT_ID}" \
        -v ${WORKSPACE}:/workspace \
        dyallab/henkaipan-action:v1 > scan-results.txt
"""
// Then parse scan-results.txt
```

---

## Stack-Specific Examples

- [Node.js](./node.md)
- [Go](./go.md)
- [Python](./python.md)
- [Docker](./docker.md)

---

## See Also

- [CI/CD Integration Overview](./index.md)
- [GitHub Actions Setup](./github-actions.md)
- [GitLab CI Setup](./gitlab-ci.md)
- [HenKaiPan Dashboard](/dashboard)