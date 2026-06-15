# HenKaiPan ASPM — Self-Hosted

Application Security Posture Management platform. Self-hosted edition.

📚 **Documentation**: [Quickstart](https://henkaipan.dyallab.com.ar/docs/quickstart/) | [Backup & Restore](https://henkaipan.dyallab.com.ar/docs/backup/)

## Prerequisites

- **Docker** & **Docker Compose** (v2.24+)
- **8 GB RAM** minimum (16 GB recommended for concurrent scans)
- **30 GB free disk** — scanner images are ~6 GB, plus app images and data

## Quickstart

### Docker Compose (Recommended for local/dev)

```bash
# 1. Run the installer (checks prerequisites, generates secrets)
./install.sh

#    If you already have Ollama or don't need AI summaries:
#    ./install.sh --skip-ollama

# 2. Start
docker compose up -d

# 3. Open http://localhost:8080
#    Login with the auto-generated admin password (shown at end of install.sh)
```

### Kubernetes (Production)

See [Kubernetes Deployment Guide](kubernetes.md) for production K8s deployment.

```bash
# Quick test deployment
kubectl apply -f kubernetes/all-in-one.yaml
kubectl port-forward svc/henkaipan-api 8080:8080 -n henkaipan
```

### Manual setup (without install.sh)

```bash
cp .env.example .env
# Edit .env: set JWT_SECRET, SECRET_ENCRYPTION_KEY
# ADMIN_PASS is optional - defaults to "admin" if not set
# If using Ollama, uncomment and set OLLAMA_URL and OLLAMA_MODEL
docker compose up -d
```

### Installer Options

| Flag | Description |
|------|-------------|
| `--skip-ollama` | Skip Ollama installation, model pull, and Ollama environment configuration |

## Configuration

See `.env.example` for all options. Required variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Auth token signing key |
| `SECRET_ENCRYPTION_KEY` | Encryption key for stored secrets |

Optional variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `ADMIN_PASS` | Admin password (set on first run only) | `admin` |
| `PROMETHEUS_PORT` | Prometheus metrics endpoint | `9090` |

### Kubernetes Configuration

For Kubernetes deployments, environment variables are configured via `ConfigMap` and `Secret` resources. See [Kubernetes Deployment Guide](kubernetes.md) for details.

### AI Providers

The self-hosted edition supports multiple AI providers with different capabilities:

**Free tier (no license key):**
- **Ollama** (FREE, self-hosted) — Summary ONLY. Set `OLLAMA_URL` and `OLLAMA_MODEL`
- Summary generation for findings is available without a license key
- Use `./install.sh --skip-ollama` if you already have Ollama running elsewhere or don't need AI summaries

### Monitoring

Prometheus metrics are exposed on port `9090` (configurable via `PROMETHEUS_PORT`). Includes queue and database metrics collectors.

**Access metrics:**

```bash
# Docker Compose
curl http://localhost:9090/metrics

# Kubernetes
kubectl port-forward svc/henkaipan-api 9090:9090 -n henkaipan
curl http://localhost:9090/metrics
```

**Sample Prometheus configuration:**

```yaml
scrape_configs:
  - job_name: 'henkaipan-api'
    static_configs:
      - targets: ['api:9090']
    metrics_path: /metrics
    scrape_interval: 10s
```

See `monitoring/prometheus.yml` for a complete example configuration.

### Rate Limiting

Redis-based rate limiting is enabled by default with per-endpoint tiers:
- Auth endpoints: 10 requests/min
- Heavy operations: 20 requests/min
- General endpoints: 100 requests/min

Rate limit headers (`X-RateLimit-*`) are included in responses. The system fails open on Redis errors.

## Updating

```bash
docker compose pull
docker compose up -d
```

Migrations run automatically on startup. See the [deployment guide](https://henkaipan.dyallab.com.ar/docs/quickstart/#updating) for rollback procedures.

## Production Checklist

- [ ] Set `COOKIE_SECURE=true` behind HTTPS
- [ ] Configure reverse proxy (nginx/caddy) with TLS
- [ ] Set up database backups
- [ ] Configure email notifications (SMTP)

For detailed production deployment instructions, see the [production deployment guide](https://henkaipan.dyallab.com.ar/docs/quickstart/#production-deployment).

## Support

- **Documentation**: https://henkaipan.dyallab.com.ar/docs/
- **GitHub Issues**: Report bugs or feature requests
