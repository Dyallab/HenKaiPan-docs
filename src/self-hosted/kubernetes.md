# Kubernetes Deployment Guide — HenKaiPan ASPM

This guide covers deploying HenKaiPan ASPM to a Kubernetes cluster.

## Prerequisites

- Kubernetes cluster (kind, minikube, EKS, GKE, AKS, etc.)
- kubectl configured to access your cluster
- Docker socket available on worker nodes (for scanner execution)
- StorageClass configured for PersistentVolumes
- (Optional) NGINX Ingress Controller
- (Optional) cert-manager for TLS

## Quick Deployment (Testing Only)

For a quick test deployment:

```bash
# Apply all-in-one manifest
kubectl apply -f kubernetes/all-in-one.yaml

# Check status
kubectl get pods -n henkaipan
kubectl get services -n henkaipan

# Access the API
kubectl port-forward svc/henkaipan-api 8080:8080 -n henkaipan
# Open http://localhost:8080
```

**Default credentials:** `admin` / `admin`

## Production Deployment

### 1. Configure Secrets

Edit `kubernetes/secrets.yaml` and set:

```yaml
stringData:
  JWT_SECRET: "<random-32-char-string>"
  SECRET_ENCRYPTION_KEY: "<random-64-char-hex-string>"
  ADMIN_PASS: "<your-admin-password>"
  # Optional: License key
  # LICENSE_KEY: "HENKAI..."
  # LICENSE_SIGNING_SECRET: "..."
```

Generate secure values:

```bash
# JWT_SECRET
openssl rand -base64 32

# SECRET_ENCRYPTION_KEY
openssl rand -hex 32
```

Apply secrets:

```bash
kubectl apply -f kubernetes/secrets.yaml
```

### 2. Configure ConfigMap

Edit `kubernetes/configmap.yaml` to customize:

- `CORS_ALLOWED_ORIGINS` — Your frontend domains
- `COOKIE_SECURE` — Set to `"true"` behind HTTPS
- AI provider settings (Ollama, OpenRouter, Cloudflare)

Apply:

```bash
kubectl apply -f kubernetes/configmap.yaml
```

### 3. Deploy Infrastructure

```bash
# Namespace
kubectl apply -f kubernetes/namespace.yaml

# PostgreSQL
kubectl apply -f kubernetes/postgres.yaml

# Redis
kubectl apply -f kubernetes/redis.yaml
```

### 4. Deploy Application

```bash
# API
kubectl apply -f kubernetes/api.yaml

# Worker
kubectl apply -f kubernetes/worker.yaml
```

### 5. Configure Ingress (Optional)

Edit `kubernetes/ingress.yaml`:

```yaml
spec:
  tls:
    - hosts:
        - aspm.yourcompany.com  # Change this
      secretName: henkaipan-tls
  rules:
    - host: aspm.yourcompany.com  # Change this
```

Apply:

```bash
kubectl apply -f kubernetes/ingress.yaml
```

## Accessing the Application

### Via Port Forward (Testing)

```bash
kubectl port-forward svc/henkaipan-api 8080:8080 -n henkaipan
# Open http://localhost:8080
```

### Via Ingress (Production)

```bash
kubectl get ingress -n henkaipan
# Access https://aspm.yourcompany.com
```

### Via NodePort

If using the all-in-one manifest:

```bash
kubectl get nodes -o wide
# Access http://<node-ip>:30080
```

## Monitoring

### Prometheus Metrics

Metrics are exposed on port `9090`:

```bash
kubectl port-forward svc/henkaipan-api 9090:9090 -n henkaipan
# Open http://localhost:9090/metrics
```

### Health Check

```bash
kubectl port-forward svc/henkaipan-api 8080:8080 -n henkaipan
curl http://localhost:8080/api/health
```

### Logs

```bash
# API logs
kubectl logs -n henkaipan -l app=henkaipan-api -f

# Worker logs
kubectl logs -n henkaipan -l app=henkaipan-worker -f

# PostgreSQL logs
kubectl logs -n henkaipan -l app=postgres -f
```

## Scaling

### Horizontal Scaling (API)

```bash
kubectl scale deployment api -n henkaipan --replicas=3
```

**Note:** Worker should typically remain at 1 replica to avoid duplicate job processing.

### Resource Limits

Adjust resource requests/limits in the deployment manifests based on your workload:

- **API**: 512Mi-2Gi memory, 250m-1000m CPU
- **Worker**: 1-4Gi memory, 500m-2000m CPU (scanner execution is memory-intensive)
- **PostgreSQL**: 512Mi-2Gi memory, 250m-1000m CPU
- **Redis**: 256-512Mi memory, 100-500m CPU

## Backup & Restore

### Database Backup

```bash
# Create backup
kubectl exec -n henkaipan $(kubectl get pod -n henkaipan -l app=postgres -o jsonpath='{.items[0].metadata.name}') \
  -- pg_dump -U aspm aspm > backup.sql

# Restore
kubectl exec -n henkaipan $(kubectl get pod -n henkaipan -l app=postgres -o jsonpath='{.items[0].metadata.name}') \
  -- psql -U aspm aspm < backup.sql
```

For automated backups, consider using tools like **Velero** or **Stash**.

## Updating

```bash
# Pull latest images
kubectl rollout restart deployment/api -n henkaipan
kubectl rollout restart deployment/worker -n henkaipan

# Check status
kubectl rollout status deployment/api -n henkaipan
kubectl rollout status deployment/worker -n henkaipan
```

## Troubleshooting

### Worker cannot run scans

Verify Docker socket is mounted:

```bash
kubectl exec -n henkaipan $(kubectl get pod -n henkaipan -l app=henkaipan-worker -o jsonpath='{.items[0].metadata.name}') \
  -- docker ps
```

If this fails, ensure:
- Docker is running on the node
- Socket path is correct (`/var/run/docker.sock`)
- Worker has permissions to access the socket

### Database connection errors

Check PostgreSQL is running:

```bash
kubectl get pods -n henkaipan -l app=postgres
kubectl logs -n henkaipan -l app=postgres
```

Verify connection string in ConfigMap:

```bash
kubectl get configmap henkaipan-config -n henkaipan -o yaml
```

### API crashes on startup

Check logs:

```bash
kubectl logs -n henkaipan -l app=henkaipan-api
```

Common causes:
- Missing required env vars (`DATABASE_URL`, `JWT_SECRET`, `SECRET_ENCRYPTION_KEY`)
- Database not ready (check PostgreSQL health)
- Invalid configuration values

## Security Considerations

1. **Run as non-root**: All deployments are configured with `runAsNonRoot: true`
2. **Drop capabilities**: `capabilities.drop: ALL` is set
3. **Read-only root filesystem**: Consider adding for additional hardening
4. **Network policies**: Implement network policies to restrict pod-to-pod communication
5. **Secrets management**: Consider using external secret managers (HashiCorp Vault, AWS Secrets Manager)
6. **Pod Security Standards**: Ensure your cluster enforces appropriate PSS levels

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Kubernetes Cluster               │
│                                                     │
│  ┌─────────────┐    ┌─────────────┐                │
│  │   Ingress   │    │   PostgreSQL│                │
│  │  (optional) │    │   (Stateful)│                │
│  └──────┬──────┘    └──────┬──────┘                │
│         │                  │                        │
│  ┌──────▼──────┐    ┌──────▼──────┐                │
│  │     API     │◀───┤    Redis    │                │
│  │  (Port 8080)│    │  (Cache/QL) │                │
│  └──────┬──────┘    └─────────────┘                │
│         │                                          │
│  ┌──────▼──────┐                                   │
│  │   Worker    │◄──── Docker Socket (host)         │
│  │  (No ports) │     (for scanner execution)       │
│  └─────────────┘                                   │
└─────────────────────────────────────────────────────┘
```

## File Reference

| File | Purpose |
|------|---------|
| `kubernetes/namespace.yaml` | Namespace definition |
| `kubernetes/configmap.yaml` | Non-sensitive configuration |
| `kubernetes/secrets.yaml` | Sensitive credentials |
| `kubernetes/postgres.yaml` | PostgreSQL deployment + PVC + service |
| `kubernetes/redis.yaml` | Redis deployment + service |
| `kubernetes/api.yaml` | API deployment + service |
| `kubernetes/worker.yaml` | Worker deployment (no service) |
| `kubernetes/ingress.yaml` | Ingress with TLS (optional) |
| `kubernetes/all-in-one.yaml` | Single manifest for testing |

## Support

- **Documentation**: https://henkaipan.dyallab.com.ar/docs/
- **GitHub Issues**: Report bugs or feature requests
- **Sales**: sales@dyallab.com.ar
