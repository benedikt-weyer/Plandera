# Kubernetes Deployment Guide

This guide covers deploying Plandera (formerly Streamline Scheduler) to a Kubernetes cluster with separate staging and production environments.

## Architecture Overview

- **Namespace Structure**: `plandera-staging` and `plandera-production`
- **Components**: PostgreSQL database, Rust backend, Next.js frontend
- **CI/CD**: GitHub Actions for automated deployments
- **Ingress**: Traefik with automatic TLS via cert-manager

## Prerequisites

1. **Kubernetes Cluster**: K3s or any Kubernetes cluster (v1.24+)
2. **kubectl**: Configured to access your cluster
3. **Traefik Ingress Controller**: Installed on the cluster
4. **cert-manager**: For automatic SSL certificate management
5. **GitHub Secrets**: Required secrets configured in repository settings

## Initial Setup

### 1. Install Required Cluster Components

If not already installed:

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Verify cert-manager installation
kubectl get pods -n cert-manager
```

### 2. Configure GitHub Secrets

Go to your GitHub repository settings > Secrets and variables > Actions, and add:

- `KUBECONFIG`: Base64-encoded kubeconfig file for cluster access
  ```bash
  # On your local machine with kubectl configured:
  cat ~/.kube/config | base64 -w 0
  ```

### 3. Update Domain Names

Update the ingress configurations in the following files to match your domains:

**Staging:**
- `k8s/staging/ingress.yaml`:
  - Frontend: `staging.plandera.app`
  - Backend: `staging-api.plandera.app`

**Production:**
- `k8s/production/ingress.yaml`:
  - Frontend: `app.plandera.app`
  - Backend: `api.plandera.app`

### 4. Configure Secrets

**IMPORTANT**: Before deploying to production, update the secrets in:

`k8s/production/postgres.yaml`:
```yaml
stringData:
  POSTGRES_PASSWORD: <strong-random-password>
  DATABASE_URL: postgresql://plandera:<strong-random-password>@postgres:5432/plandera_db
  JWT_SECRET: <strong-random-jwt-secret-at-least-32-chars>
```

For staging, you can keep the default development secrets or update them as well.

### 5. DNS Configuration

Point your DNS records to your Kubernetes cluster's ingress IP:

```bash
# Get your ingress IP
kubectl get svc -n kube-system traefik
```

Create A records:
- `staging.plandera.app` → your-cluster-ip
- `staging-api.plandera.app` → your-cluster-ip
- `app.plandera.app` → your-cluster-ip
- `api.plandera.app` → your-cluster-ip

## Deployment

### Automatic Deployment (Recommended)

#### Staging Deployment

Staging deploys automatically on every push to `main`:

1. Make changes and commit to a feature branch
2. Create a pull request
3. After review, merge to `main`
4. GitHub Actions automatically builds and deploys to staging

You can also manually trigger a staging deployment:
1. Go to Actions tab in GitHub
2. Select "Deploy to Staging" workflow
3. Click "Run workflow"

#### Production Deployment

Production deployment requires manual approval via workflow_dispatch:

1. Go to Actions tab in GitHub
2. Select "Deploy to Production" workflow
3. Click "Run workflow"
4. Type `deploy-to-production` in the confirmation field
5. Click "Run workflow"

### Manual Deployment

If you need to deploy manually without GitHub Actions:

#### Deploy Staging

```bash
# Create namespace
kubectl apply -f k8s/staging/namespace.yaml

# Create image pull secret (if using private registry)
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=<github-username> \
  --docker-password=<github-token> \
  --namespace=plandera-staging

# Deploy all components
kubectl apply -f k8s/staging/postgres.yaml
kubectl apply -f k8s/staging/backend.yaml
kubectl apply -f k8s/staging/frontend.yaml
kubectl apply -f k8s/staging/ingress.yaml

# Monitor deployment
kubectl rollout status deployment/backend -n plandera-staging
kubectl rollout status deployment/frontend -n plandera-staging
```

#### Deploy Production

```bash
# Create namespace
kubectl apply -f k8s/production/namespace.yaml

# Create image pull secret
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=<github-username> \
  --docker-password=<github-token> \
  --namespace=plandera-production

# Deploy all components
kubectl apply -f k8s/production/postgres.yaml
kubectl apply -f k8s/production/backend.yaml
kubectl apply -f k8s/production/frontend.yaml
kubectl apply -f k8s/production/ingress.yaml

# Monitor deployment
kubectl rollout status deployment/backend -n plandera-production
kubectl rollout status deployment/frontend -n plandera-production
```

## Monitoring and Debugging

### Check Pod Status

```bash
# Staging
kubectl get pods -n plandera-staging
kubectl logs -f deployment/backend -n plandera-staging
kubectl logs -f deployment/frontend -n plandera-staging

# Production
kubectl get pods -n plandera-production
kubectl logs -f deployment/backend -n plandera-production
kubectl logs -f deployment/frontend -n plandera-production
```

### Check Services and Ingress

```bash
# Staging
kubectl get svc -n plandera-staging
kubectl get ingress -n plandera-staging
kubectl describe ingress backend-ingress -n plandera-staging

# Production
kubectl get svc -n plandera-production
kubectl get ingress -n plandera-production
kubectl describe ingress backend-ingress -n plandera-production
```

### Access Database

```bash
# Port-forward to access PostgreSQL directly
kubectl port-forward svc/postgres 5432:5432 -n plandera-staging
# or
kubectl port-forward svc/postgres 5432:5432 -n plandera-production

# Connect with psql
psql postgresql://plandera:<password>@localhost:5432/plandera_db
```

### Common Issues

#### Pods not starting

```bash
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace>
```

#### Database connection issues

```bash
# Check if postgres is ready
kubectl exec -it deployment/postgres -n plandera-staging -- pg_isready -U plandera

# Check database exists
kubectl exec -it deployment/postgres -n plandera-staging -- psql -U plandera -c '\l'
```

#### Certificate issues

```bash
# Check certificate status
kubectl get certificates -n plandera-staging
kubectl describe certificate staging-backend-tls -n plandera-staging

# Check cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager
```

## Rolling Back

If you need to rollback a deployment:

```bash
# Rollback to previous version
kubectl rollout undo deployment/backend -n plandera-production
kubectl rollout undo deployment/frontend -n plandera-production

# Check rollout history
kubectl rollout history deployment/backend -n plandera-production

# Rollback to specific revision
kubectl rollout undo deployment/backend -n plandera-production --to-revision=2
```

## Scaling

### Scale Replicas

```bash
# Scale backend in production
kubectl scale deployment/backend --replicas=3 -n plandera-production

# Scale frontend in production
kubectl scale deployment/frontend --replicas=3 -n plandera-production
```

To make scaling permanent, update the replica count in the deployment YAML files.

### Horizontal Pod Autoscaling (HPA)

Create an HPA for automatic scaling:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: plandera-production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## Backup and Restore

### Backup PostgreSQL

```bash
# Create backup
kubectl exec deployment/postgres -n plandera-production -- \
  pg_dump -U plandera plandera_db > backup-$(date +%Y%m%d-%H%M%S).sql

# Or use pg_dumpall for all databases
kubectl exec deployment/postgres -n plandera-production -- \
  pg_dumpall -U plandera > backup-all-$(date +%Y%m%d-%H%M%S).sql
```

### Restore PostgreSQL

```bash
# Restore from backup
cat backup.sql | kubectl exec -i deployment/postgres -n plandera-production -- \
  psql -U plandera plandera_db
```

### Automated Backups

Consider setting up a CronJob for automated backups:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: plandera-production
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:16-alpine
            command:
            - /bin/sh
            - -c
            - |
              pg_dump -h postgres -U plandera plandera_db | gzip > /backup/backup-$(date +%Y%m%d-%H%M%S).sql.gz
            env:
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: plandera-secrets
                  key: POSTGRES_PASSWORD
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
          restartPolicy: OnFailure
          volumes:
          - name: backup-storage
            persistentVolumeClaim:
              claimName: backup-pvc
```

## Security Best Practices

1. **Update Secrets**: Never use default passwords in production
2. **Network Policies**: Implement network policies to restrict pod-to-pod communication
3. **RBAC**: Use Role-Based Access Control for kubectl access
4. **Image Scanning**: Scan container images for vulnerabilities
5. **TLS Everywhere**: Use TLS for all external communications (handled by cert-manager)
6. **Resource Limits**: Set appropriate resource requests and limits
7. **Pod Security Policies**: Implement pod security standards

## CI/CD Pipeline

### Staging Pipeline

1. **Trigger**: Push to `main` branch
2. **Build**: Build backend and frontend Docker images
3. **Push**: Push images to GHCR with `staging-latest` tag
4. **Deploy**: Apply Kubernetes manifests to staging namespace
5. **Verify**: Wait for rollout and verify pod status

### Production Pipeline

1. **Trigger**: Manual workflow dispatch with confirmation
2. **Validate**: Require confirmation text
3. **Build**: Build backend and frontend Docker images
4. **Push**: Push images to GHCR with `latest` tag
5. **Deploy**: Apply Kubernetes manifests to production namespace
6. **Verify**: Wait for rollout and run smoke tests
7. **Environment**: Uses GitHub environment protection rules

## Environment Variables

### Backend

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for JWT token signing
- `RUST_LOG`: Log level (debug/info/warn/error)
- `PORT`: Port to listen on (default: 8080)

### Frontend

- `NEXT_PUBLIC_BACKEND_HTTP_URL`: Backend HTTP URL
- `NEXT_PUBLIC_BACKEND_WS_URL`: Backend WebSocket URL

## Troubleshooting Guide

### Backend won't start

1. Check database connection: Verify `DATABASE_URL` is correct
2. Check migrations: Ensure database migrations have run
3. Check logs: `kubectl logs deployment/backend -n <namespace>`

### Frontend won't start

1. Check build logs: Look for Next.js build errors
2. Verify backend URL: Ensure `NEXT_PUBLIC_BACKEND_HTTP_URL` is accessible
3. Check resource limits: Frontend might need more memory during startup

### Database issues

1. Check PVC: Ensure PersistentVolumeClaim is bound
2. Check init container: Look at init-db logs
3. Check postgres logs: `kubectl logs deployment/postgres -n <namespace>`

### Ingress/TLS issues

1. Verify DNS: Ensure DNS records point to cluster
2. Check cert-manager: Look at certificate status
3. Check issuer: Ensure letsencrypt-prod issuer exists
4. Wait time: Certificate issuance can take a few minutes

## Maintenance

### Update Application

The CI/CD pipeline handles updates automatically:

- **Staging**: Push changes to `main`
- **Production**: Run production deployment workflow after validating staging

### Update Database Schema

1. Update migrations in backend code
2. Deploy to staging first
3. Test migrations
4. Deploy to production

### Update Kubernetes Resources

1. Modify YAML files in `k8s/` directory
2. Apply changes via CI/CD or manually with `kubectl apply`

## Cleanup

### Remove Staging Environment

```bash
kubectl delete namespace plandera-staging
```

### Remove Production Environment

```bash
kubectl delete namespace plandera-production
```

## Support

For issues or questions:
1. Check logs: `kubectl logs` commands
2. Check events: `kubectl get events -n <namespace>`
3. Review this documentation
4. Check GitHub Issues in the repository

