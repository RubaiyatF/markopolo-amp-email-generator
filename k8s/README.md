# Kubernetes Deployment Guide

This directory contains Kubernetes manifests for deploying the AMP Email Generation API Platform to a Kubernetes cluster.

## Files Overview

- **deployment.yaml** - Main API deployment with auto-scaling configuration
- **service.yaml** - ClusterIP services for API, PostgreSQL, and Redis
- **ingress.yaml** - Ingress configuration with TLS/SSL support
- **hpa.yaml** - Horizontal Pod Autoscaler for automatic scaling
- **postgres-deployment.yaml** - PostgreSQL StatefulSet with persistent storage
- **redis-deployment.yaml** - Redis deployment for caching

## Prerequisites

1. **Kubernetes Cluster** (v1.24+)
   - GKE, EKS, AKS, or local (minikube/kind)
   - kubectl configured with cluster access

2. **Required Add-ons**
   - NGINX Ingress Controller
   - cert-manager (for TLS certificates)
   - Metrics Server (for HPA)

3. **DNS Configuration**
   - Domain pointing to cluster ingress IP
   - Example: api.amp-platform.com

## Quick Start

### 1. Create Namespace

```bash
kubectl create namespace production
```

### 2. Create Secrets

Update secrets in the manifests before applying:

```bash
# Generate secure passwords
POSTGRES_PASSWORD=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)

# Update secrets in deployment.yaml and postgres-deployment.yaml
# Or use kubectl to create secrets:

kubectl create secret generic amp-email-secrets \
  --from-literal=database-url="postgresql://postgres:${POSTGRES_PASSWORD}@postgres-service:5432/amp_email_db" \
  --from-literal=redis-password="${REDIS_PASSWORD}" \
  --from-literal=replicate-api-key="YOUR_REPLICATE_API_KEY" \
  --from-literal=aws-access-key-id="YOUR_AWS_ACCESS_KEY" \
  --from-literal=aws-secret-access-key="YOUR_AWS_SECRET_KEY" \
  -n production

kubectl create secret generic postgres-secrets \
  --from-literal=username="postgres" \
  --from-literal=password="${POSTGRES_PASSWORD}" \
  -n production
```

### 3. Deploy Database & Cache

```bash
# Deploy PostgreSQL
kubectl apply -f postgres-deployment.yaml

# Deploy Redis
kubectl apply -f redis-deployment.yaml

# Wait for databases to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n production --timeout=120s
kubectl wait --for=condition=ready pod -l app=redis -n production --timeout=120s
```

### 4. Run Database Migrations

```bash
# Get a shell in the API pod (or use a migration job)
kubectl run -it --rm prisma-migrate \
  --image=amp-platform/api:latest \
  --restart=Never \
  --env="DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@postgres-service:5432/amp_email_db" \
  -n production \
  -- npx prisma migrate deploy
```

### 5. Deploy API Application

```bash
# Deploy services
kubectl apply -f service.yaml

# Deploy API
kubectl apply -f deployment.yaml

# Deploy HPA
kubectl apply -f hpa.yaml

# Wait for API to be ready
kubectl wait --for=condition=available deployment/amp-email-api -n production --timeout=300s
```

### 6. Configure Ingress

```bash
# Update ingress.yaml with your domain
# Then apply:
kubectl apply -f ingress.yaml

# Get ingress IP
kubectl get ingress amp-email-api-ingress -n production
```

### 7. Verify Deployment

```bash
# Check all resources
kubectl get all -n production

# Check pod logs
kubectl logs -f deployment/amp-email-api -n production

# Test health endpoint
INGRESS_IP=$(kubectl get ingress amp-email-api-ingress -n production -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
curl http://${INGRESS_IP}/health
```

## Configuration

### Environment Variables

Edit `deployment.yaml` ConfigMap section to customize:

- **REDIS_HOST** - Redis service hostname
- **SCRAPER_BASE_URL** - Product scraper microservice URL
- **AWS_REGION** - AWS region for S3/CloudFront
- **S3_BUCKET_NAME** - S3 bucket for template storage
- **CDN_BASE_URL** - CloudFront distribution URL

### Secrets

Update `deployment.yaml` Secret section with:

- **database-url** - PostgreSQL connection string
- **redis-password** - Redis authentication password
- **replicate-api-key** - Replicate AI API key
- **aws-access-key-id** - AWS IAM access key
- **aws-secret-access-key** - AWS IAM secret key

### Resource Limits

Adjust resource requests/limits in `deployment.yaml`:

```yaml
resources:
  requests:
    cpu: 500m        # Minimum CPU
    memory: 512Mi    # Minimum memory
  limits:
    cpu: 2000m       # Maximum CPU
    memory: 2Gi      # Maximum memory
```

### Auto-scaling

Configure HPA in `hpa.yaml`:

```yaml
minReplicas: 3       # Minimum pods
maxReplicas: 20      # Maximum pods
targetCPUUtilizationPercentage: 70
targetMemoryUtilizationPercentage: 80
```

## Monitoring

### Check Pod Status

```bash
kubectl get pods -n production -l app=amp-email-api
```

### View Logs

```bash
# All pods
kubectl logs -f deployment/amp-email-api -n production

# Specific pod
kubectl logs -f <pod-name> -n production

# Previous pod instance
kubectl logs <pod-name> -n production --previous
```

### Check HPA Status

```bash
kubectl get hpa amp-email-api-hpa -n production
kubectl describe hpa amp-email-api-hpa -n production
```

### Monitor Resource Usage

```bash
kubectl top pods -n production
kubectl top nodes
```

## Scaling

### Manual Scaling

```bash
# Scale to specific replica count
kubectl scale deployment amp-email-api --replicas=5 -n production
```

### HPA Scaling

HPA automatically scales based on CPU/memory:
- Scales up when CPU > 70% or Memory > 80%
- Scales down gradually with 5-minute stabilization window
- Respects min (3) and max (20) replica limits

## Troubleshooting

### Pods Not Starting

```bash
# Check pod events
kubectl describe pod <pod-name> -n production

# Check deployment events
kubectl describe deployment amp-email-api -n production

# Check pod logs
kubectl logs <pod-name> -n production
```

### Database Connection Issues

```bash
# Test database connectivity
kubectl run -it --rm db-test \
  --image=postgres:14-alpine \
  --restart=Never \
  -n production \
  -- psql -h postgres-service -U postgres -d amp_email_db

# Check PostgreSQL logs
kubectl logs -f statefulset/postgres -n production
```

### Redis Connection Issues

```bash
# Test Redis connectivity
kubectl run -it --rm redis-test \
  --image=redis:7-alpine \
  --restart=Never \
  -n production \
  -- redis-cli -h redis-service ping
```

### Ingress Not Working

```bash
# Check ingress status
kubectl describe ingress amp-email-api-ingress -n production

# Check NGINX ingress controller logs
kubectl logs -f -n ingress-nginx -l app.kubernetes.io/component=controller

# Verify DNS
nslookup api.amp-platform.com
```

## Updating

### Rolling Update

```bash
# Update image
kubectl set image deployment/amp-email-api \
  api=amp-platform/api:v1.1.0 \
  -n production

# Check rollout status
kubectl rollout status deployment/amp-email-api -n production

# View rollout history
kubectl rollout history deployment/amp-email-api -n production
```

### Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/amp-email-api -n production

# Rollback to specific revision
kubectl rollout undo deployment/amp-email-api --to-revision=2 -n production
```

## Backup & Restore

### Database Backup

```bash
# Create backup
kubectl exec -it statefulset/postgres -n production -- \
  pg_dump -U postgres amp_email_db > backup.sql

# Restore from backup
kubectl exec -i statefulset/postgres -n production -- \
  psql -U postgres amp_email_db < backup.sql
```

### Persistent Volume Backup

```bash
# List PVCs
kubectl get pvc -n production

# Create snapshot (provider-specific)
# GKE example:
gcloud compute disks snapshot <disk-name> \
  --snapshot-names=amp-email-backup-$(date +%Y%m%d)
```

## Security

### TLS/SSL Configuration

The ingress is configured for automatic TLS via cert-manager:

```yaml
annotations:
  cert-manager.io/cluster-issuer: letsencrypt-prod
```

Ensure cert-manager is installed and ClusterIssuer is configured.

### Network Policies

Apply network policies to restrict pod communication:

```bash
kubectl apply -f network-policies.yaml
```

### Secret Management

For production, use external secret management:
- AWS Secrets Manager
- HashiCorp Vault
- Google Secret Manager
- Azure Key Vault

## Production Checklist

- [ ] Secrets updated with production values
- [ ] Resource limits configured appropriately
- [ ] HPA configured for expected load
- [ ] Persistent storage provisioned
- [ ] Backup strategy implemented
- [ ] Monitoring and alerting configured
- [ ] DNS records updated
- [ ] TLS certificates configured
- [ ] Network policies applied
- [ ] Database migrations run
- [ ] Health checks passing
- [ ] Smoke tests passed

## Multi-Region Deployment

For multi-region setup:

1. Deploy to primary region (US-East)
2. Deploy to secondary region (EU-West)
3. Configure global load balancer
4. Set up database replication
5. Configure CDN for geo-routing

See [Multi-Region Guide](../docs/MULTI-REGION.md) for details.

## Support

- **Documentation**: https://docs.amp-platform.com/deployment
- **Issues**: https://github.com/amp-platform/api/issues
- **Slack**: #amp-platform-ops
