# Docker Security Scan Workflow Example

This guide shows how to configure HenKaiPan security scans for a Docker-based project.

---

## 1. Create an API Token

Follow the [GitHub Actions Setup Guide](./github-actions.md) to create an API token and add it as a GitHub Secret.

---

## 2. Add the Workflow

Create `.github/workflows/docker-security.yml` in your repository:

```yaml
name: Docker Security Scan

on:
  push:
    branches: [main]
    paths:
      - "**/Dockerfile"
      - "**/docker-compose*.yml"
      - ".github/workflows/docker-security.yml"
  pull_request:
    branches: [main]
    paths:
      - "**/Dockerfile"
      - "**/docker-compose*.yml"
      - ".github/workflows/docker-security.yml"

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Scan source code and dependencies
      - name: Run HenKaiPan Security Scan
        uses: dyallab/henkaipan-action@v1
        with:
          api-url: ${{ secrets.HENKAIPAN_API_URL }}
          api-key: ${{ secrets.HENKAIPAN_API_KEY }}
          project-id: ${{ secrets.HENKAIPAN_PROJECT_ID }}
          scanners: "trivy,grype"
          fail-on-severity: critical

      # Optional: build and scan the Docker image itself
      - name: Build Docker image
        run: |
          docker build -t myapp:${{ github.sha }} .

      - name: Scan Docker image
        uses: dyallab/henkaipan-action@v1
        with:
          api-url: ${{ secrets.HENKAIPAN_API_URL }}
          api-key: ${{ secrets.HENKAIPAN_API_KEY }}
          project-id: ${{ secrets.HENKAIPAN_PROJECT_ID }}
          scanners: "containers"
          fail-on-severity: critical
```

---

## What Gets Scanned

| Scanner | What it finds |
|---------|---------------|
| **trivy** | Vulnerable base images, OS packages, application dependencies in the container |
| **grype** | Known CVEs in application dependencies inside the container |
| **gitleaks** | Secrets or tokens accidentally baked into Docker layers |

---

## Configuration Tips

### Scan Only on Dockerfile Changes

```yaml
on:
  push:
    branches: [main]
    paths:
      - "**/Dockerfile"
```

### Scan Container Image Only (no source scan)

```yaml
- name: Build image
  run: docker build -t myapp:${{ github.sha }} .

- name: Scan image
  uses: dyallab/henkaipan-action@v1
  with:
    scanners: "containers"
    fail-on-severity: critical
```

### Block on High Vulnerabilities

```yaml
fail-on-severity: high
```

---

## Multi-Stage Dockerfile Tips

If you use multi-stage builds, HenKaiPan scans the final stage:

```dockerfile
# Stage 1: builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build

# Stage 2: runtime
FROM node:20-alpine AS runtime
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/index.js"]
```

The scan runs against the final image, so only production dependencies are checked.

---

## Excluding Base Image Vulnerabilities

If you want to ignore vulnerabilities in the base image and only flag application-layer issues:

1. Use a minimal base image (e.g. `alpine`, `distroless`)
2. Pin the base image tag (avoid `latest`)
3. Use trivy's `--ignore-unfixed` flag (handled by HenKaiPan worker)

---

## CI/CD Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `api-url` | Yes | — | HenKaiPan instance URL |
| `api-key` | Yes | — | API token |
| `project-id` | Yes | — | Project UUID |
| `scanners` | No | `all` | Use `containers` for image-only scan |
| `fail-on-severity` | No | — | Minimum severity to block |

---

## See Also

- [GitHub Actions Setup](./github-actions.md)
- [GitLab CI Setup](./gitlab-ci.md)
- [Jenkins Setup](./jenkins.md)
- [CI/CD Integration Overview](./index.md)