# Operations Guide — HenKaiPan ASPM

This guide covers operational aspects of running a self-hosted HenKaiPan ASPM instance: worker scaling, scanner requirements, troubleshooting common issues, and routine maintenance.

## Worker Scaling

### Architecture

The worker is responsible for executing background jobs:

| Job Type | Description | Retries | Max Duration |
|----------|-------------|---------|-------------|
| `scan:run` | Execute a security scanner binary | 3 | 30 min |
| `agent:validate` | AI-based finding validation | 5 | 10 min |
| `agent:summarize` | AI finding summary generation | 5 | 60 sec |
| `webhook:send` | Deliver webhook payload | 3 | 30 s |
| `email:send` | Send email notification | 3 | 30 s |

Jobs are distributed via Redis/Asynq. The default deployment runs a single worker instance.

**Note:** Redis also serves as the pub/sub relay for SSE (Server-Sent Events). The worker publishes real-time events (e.g., AI summary completed, scan finished) to a Redis channel; the API subscribes and delivers them to connected browser clients. This means SSE real-time updates work even when the API and worker run as separate processes.

### Running Multiple Workers

To increase throughput (especially for concurrent scans):

```bash
# Scale to 3 workers
docker compose up -d --scale worker=3
```

**Important considerations:**

- Scanner binaries run directly within the worker process — no container isolation per scan
- Workers primarily contend for system resources (RAM, CPU) when running scanners
- Adding workers increases scan concurrency but also increases peak resource usage
- Multiple workers share the same Redis queue — no additional configuration needed
- Workers automatically recover stuck scans on startup via `RecoverStuck()`

### Resource Planning

| Workers | Concurrent Scans | Recommended RAM |
|---------|-----------------|----------------|
| 1 | 2-4 | 8 GB |
| 2 | 4-8 | 16 GB |
| 3 | 6-12 | 24 GB |
| 4 | 8-16 | 32 GB |

Each scanner consumes variable resources (see scanner requirements below). Heavy scanners like Trivy and Semgrep can use 1-2 GB RAM each.

### Queue Monitoring

```bash
# Check queue depth via Redis CLI
docker compose exec redis redis-cli -n 1 LLEN asynq:queues

# List all queues
docker compose exec redis redis-cli -n 1 KEYS "asynq:*"

# Check dead letter queue (failed jobs)
docker compose exec redis redis-cli -n 1 ZCARD asynq:dead
```

## Scanner Runtime Requirements

HenKaiPan supports 13 security scanners grouped into packs:

### Scanner Packs

| Pack | Scanners | Focus |
|------|----------|-------|
| `sast` | semgrep, gosec | Static analysis, code vulnerabilities |
| `sca` | trivy, grype, osv-scanner | Software composition, dependency vulns |
| `secrets` | trufflehog, gitleaks | Exposed credentials, API keys |
| `iac` | checkov, tfsec, kics | Infrastructure as Code misconfigurations |
| `containers` | trivy-image, grype-image | Container image vulnerabilities |
| `dast` | nuclei | Dynamic web application scanning |

### Resource Requirements per Scanner

| Scanner | RAM (min) | RAM (peak) | Disk | Network | Notes |
|---------|-----------|------------|------|---------|-------|
| semgrep | 256 MB | 1 GB | 500 MB | No | Fastest SAST |
| gosec | 128 MB | 512 MB | 200 MB | No | Go-specific |
| trivy | 256 MB | 1.5 GB | 2 GB | Yes* | Heavy on large repos |
| grype | 256 MB | 1 GB | 1 GB | Yes* | DB update on first run |
| osv-scanner | 64 MB | 256 MB | 100 MB | Yes | Lightweight |
| trufflehog | 128 MB | 512 MB | 200 MB | No | Deep git history scan |
| gitleaks | 64 MB | 256 MB | 100 MB | No | Fast git secrets |
| checkov | 256 MB | 1 GB | 500 MB | No | Terraform/K8s IaC |
| tfsec | 64 MB | 256 MB | 100 MB | No | Terraform-specific |
| kics | 256 MB | 1 GB | 500 MB | No | Multi-language IaC |
| trivy-image | 512 MB | 2 GB | 3 GB | Yes | Downloads image layers |
| grype-image | 256 MB | 1 GB | 2 GB | Yes | Downloads image |
| nuclei | 128 MB | 512 MB | 300 MB | Yes | Network scanning |

*Network access required for vulnerability database updates.

### Scan Timeouts

| Default | Configurable via |
|---------|-----------------|
| 30 minutes | Env var or job payload |

Scans exceeding the timeout are marked as failed. The worker recovers and continues processing the next job.

## Troubleshooting

### 1. API Won't Start

**Symptom:** Container exits immediately. `docker compose logs api` shows error.

**Check:**
```bash
docker compose logs api
```

**Common causes:**

| Cause | Error Message | Fix |
|-------|--------------|-----|
| Missing `DATABASE_URL` | `required environment variable DATABASE_URL not set` | Ensure `.env` has `DATABASE_URL=postgres://...` |
| Missing `JWT_SECRET` | `JWT_SECRET is required` | Generate: `openssl rand -base64 32` |
| Missing `SECRET_ENCRYPTION_KEY` | `SECRET_ENCRYPTION_KEY is required` | Generate: `openssl rand -hex 32` |

### 2. Database Connection Refused

**Symptom:** API starts, logs show `connection refused` or `dial tcp ...:5432: connect: connection refused`.

**Check:**
```bash
docker compose ps postgres
docker compose logs postgres
```

**Fixes:**
- Postgres container may still be starting — wait for healthcheck
- If Postgres repeatedly fails, check `pgdata` volume permissions
- Ensure `DATABASE_URL` matches postgres credentials in `.env`

### 3. Worker Not Picking Up Jobs

**Symptom:** Scans created in UI stay in "pending" status.

**Check:**
```bash
docker compose logs worker | tail -50
docker compose exec redis redis-cli PING
```

**Fixes:**
- Worker may be unhealthy — check `docker compose ps worker`
- Redis connectivity issue — verify `REDIS_ADDR` in `.env`
- Worker crashed — check for OOM kills: `docker compose logs worker | grep -i "killed\|oom\|exit code 137"`

### 4. Scans Fail to Start

**Symptom:** Scan status goes to "failed" immediately after creation.

**Check:**
```bash
docker compose logs worker | grep -i "scan\|error\|fail"
```

**Common causes:**

| Error | Cause | Fix |
|-------|-------|-----|
| `exec: "semgrep": not found` | Scanner binary missing from PATH | Use worker Docker image or install binaries |
| `permission denied` | Binary not executable | Ensure scanner binaries have +x permission |
| `context deadline exceeded` | Scan timed out | Increase timeout or reduce repo size |

### 5. Scans Timeout on Large Repos

**Symptom:** Scans on large repositories (50k+ files) consistently timeout.

**Solutions:**
- Target specific paths in scan configuration (exclude `node_modules`, `vendor`, etc.)
- Increase scan timeout via environment variable
- Run scans during off-peak hours
- Consider splitting the repository into smaller projects

### 6. Frontend Shows Blank Page or API Errors

**Symptom:** Frontend loads but shows no data, or console shows network errors.

**Root cause:** The frontend has `API_BASE` hardcoded to `http://localhost:8080` in `frontend/src/lib/api.ts`. This means the browser must be able to reach the API at that address.

**Fixes:**
- For production behind a reverse proxy, the API and frontend are served on the same origin (port 443) — no CORS issues
- For development, ensure the API is accessible at `http://localhost:8080`
- Check CORS configuration if using a custom domain: `CORS_ALLOWED_ORIGINS` env var

### 7. Authentication Issues After Config Change

**Symptom:** Users cannot log in, or existing sessions are invalidated.

**Cause:** Changing `JWT_SECRET` invalidates all existing auth tokens.

**Fix:** Users must log in again to obtain new tokens. This is expected behavior after secret rotation — plan accordingly.

### 8. Migration Errors

**Symptom:** API logs show migration failure. API may not start.

**Check:**
```bash
docker compose logs api | grep -i "migration\|error"
```

**Fixes:**
- Migrations run in order from `migrations/` directory
- If a migration fails, check syntax by running it manually:
  ```bash
  docker compose exec -T postgres psql -U aspm -d aspm < migrations/XXX_your_migration.sql
  ```
- Migrations are additive — they create tables/columns but do not drop them

### 9. Out of Disk Space

**Symptom:** Docker operations fail with `no space left on device`.

**Check:**
```bash
df -h
docker system df
```

**Cleanup:**
```bash
# Remove unused Docker images (safe, will be re-pulled)
docker image prune -a

# Remove stopped containers and unused networks
docker system prune -f

# Check Docker root directory size
du -sh /var/lib/docker/
```

### 10. High Memory Usage

**Symptom:** System becomes slow, OOM killer terminates containers.

**Checks:**
```bash
docker stats
free -h
```

**Tuning:**

| Component | Setting | File |
|-----------|---------|------|
| PostgreSQL | `shared_buffers=256MB`, `max_connections=1000` | `docker-compose.yml` |
| Redis | `maxmemory=512mb`, `maxmemory-policy=allkeys-lru` | `docker-compose.yml` |
| Docker | Limit container memory in compose | `docker-compose.yml` |

If running multiple workers, reduce scanner concurrency or add more RAM.

### 11. AI Features Not Working

**Symptom:** AI remediation, summary, or validation buttons are disabled or return errors.

**Check:**
```bash
docker compose logs api | grep -i "ai\|openrouter\|cloudflare\|ollama"
docker compose logs worker | grep -i "ai\|openrouter\|cloudflare\|ollama"
```

**Fixes:**

| Scenario | Check |
|----------|-------|
| Ollama configured | Is Ollama running? `curl http://localhost:11434/api/tags` |
| OpenRouter configured | Is `OPENROUTER_API_KEY` set? Is it valid? |
| Cloudflare configured | Are `CF_ACCOUNT_ID` and `CF_API_TOKEN` correct? |
| Provider selection | Are `AI_REMEDIATION_PROVIDER`, `AI_SUMMARY_PROVIDER`, `AI_VALIDATION_PROVIDER` set? |
| Ollama | Free self-hosted AI summaries, remediation, and validation |

### 12. Email Not Sending

**Symptom:** Notifications configured but no emails sent.

**Check:**
```bash
docker compose logs worker | grep -i "email\|smtp\|mail"
```

**Fixes:**
- Verify SMTP settings in `.env`
- For testing, Mailpit is included in the dev docker-compose (port 1025 SMTP, 8025 web UI)
- For production, configure Brevo or any SMTP provider

### 13. Rate Limiting Issues

**Symptom:** API returns `429 Too Many Requests`.

The default rate limits are:

| Endpoint Tier | Limit |
|--------------|-------|
| Auth | 10 requests/min |
| Heavy operations | 20 requests/min |
| General | 100 requests/min |

Rate limit headers (`X-RateLimit-*`) are included in responses. Limits are Redis-based and fail open (no rate limiting) if Redis is unreachable.

## Maintenance

### Log Rotation

Configure Docker log rotation globally in `/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

Then restart Docker: `sudo systemctl restart docker`

### Database Maintenance

PostgreSQL requires periodic maintenance:

```bash
# Connect and run VACUUM (safe, non-blocking)
docker compose exec postgres psql -U aspm -d aspm -c "VACUUM ANALYZE;"

# Check for bloat
docker compose exec postgres psql -U aspm -d aspm -c "SELECT schemaname, tablename, n_live_tup, n_dead_tup, last_autovacuum FROM pg_stat_user_tables;"
```

Autovacuum is enabled by default in PostgreSQL 17 — no manual intervention required for most workloads.

### SSL Certificate Renewal

For nginx + certbot:

```bash
# Test renewal
sudo certbot renew --dry-run

# Actual renewal (certbot auto-renew via cron/systemd)
sudo certbot renew
```

For Caddy: certificate renewal is automatic.

### Docker Image Cleanup

```bash
# Weekly cleanup (add to crontab)
docker image prune -a -f --filter "until=168h"  # Remove images older than 7 days
```

Note: `pull_policy: always` will re-pull images on `docker compose up -d`, so pruning old images is safe.

## Health Endpoints

| Endpoint | What it checks |
|----------|---------------|
| `GET /api/health` | DB connectivity, Redis connectivity, worker status, disk space |
| `GET /api/version` | Build version, commit hash, build date |
| `GET /metrics` | Prometheus metrics (queue depth, request latency, DB pool) |

## Getting Help

- **Documentation**: https://henkaipan.dyallab.com.ar/docs/
- **GitHub Issues**: https://github.com/Dyallab/HenKaiPan-self-hosted/issues

