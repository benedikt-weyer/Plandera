# Kubernetes Deployment Quick Start

This is a quick reference for deploying Plandera to Kubernetes. For detailed information, see [KUBERNETES_DEPLOYMENT.md](./KUBERNETES_DEPLOYMENT.md).

## Prerequisites

- Kubernetes cluster (K3s or similar)
- kubectl configured
- Traefik ingress controller
- cert-manager installed
- GitHub repository secrets configured

## Setup GitHub Secrets

Add to repository settings → Secrets and variables → Actions:

```bash
# KUBECONFIG - base64 encoded kubeconfig
cat ~/.kube/config | base64 -w 0
```

## Update Secrets (Production)

**⚠️ IMPORTANT**: Before deploying to production, update secrets in:

`k8s/production/postgres.yaml`:
```yaml
stringData:
  POSTGRES_PASSWORD: <use-strong-random-password>
  DATABASE_URL: postgresql://plandera:<same-password>@postgres:5432/plandera_db
  JWT_SECRET: <use-strong-random-jwt-secret-min-32-chars>
```

## Update Domain Names

Update domains in ingress files:

- Staging: `k8s/staging/ingress.yaml`
  - `staging.plandera.app` (frontend)
  - `staging-api.plandera.app` (backend)

- Production: `k8s/production/ingress.yaml`
  - `app.plandera.app` (frontend)
  - `api.plandera.app` (backend)

## Configure DNS

Point DNS A records to your cluster ingress IP:

```bash
# Get ingress IP
kubectl get svc -n kube-system traefik
```

## Deploy

### Automatic (Recommended)

**Staging**: Automatically deploys on push to `main`

**Production**: 
1. Go to Actions → "Deploy to Production"
2. Click "Run workflow"
3. Type `deploy-to-production`
4. Click "Run workflow"

### Manual

**Staging**:
```bash
kubectl apply -f k8s/staging/namespace.yaml
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=<username> \
  --docker-password=<token> \
  --namespace=plandera-staging
kubectl apply -f k8s/staging/
```

**Production**:
```bash
kubectl apply -f k8s/production/namespace.yaml
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=<username> \
  --docker-password=<token> \
  --namespace=plandera-production
kubectl apply -f k8s/production/
```

## Monitor

```bash
# Check pods
kubectl get pods -n plandera-staging
kubectl get pods -n plandera-production

# Check logs
kubectl logs -f deployment/backend -n plandera-staging
kubectl logs -f deployment/frontend -n plandera-production

# Check ingress
kubectl get ingress -n plandera-staging
kubectl get ingress -n plandera-production
```

## Common Commands

```bash
# Restart deployment
kubectl rollout restart deployment/backend -n plandera-production

# Scale replicas
kubectl scale deployment/backend --replicas=3 -n plandera-production

# Rollback
kubectl rollout undo deployment/backend -n plandera-production

# Access database
kubectl port-forward svc/postgres 5432:5432 -n plandera-production
```

## Troubleshooting

```bash
# Describe pod
kubectl describe pod <pod-name> -n <namespace>

# Get events
kubectl get events -n <namespace> --sort-by='.lastTimestamp'

# Check certificates
kubectl get certificates -n <namespace>
```

## Environment URLs

- **Staging**: 
  - Frontend: https://staging.plandera.app
  - Backend: https://staging-api.plandera.app

- **Production**:
  - Frontend: https://app.plandera.app
  - Backend: https://api.plandera.app

## Workflow

1. **Develop**: Work on feature branch
2. **Test**: Create PR and review
3. **Staging**: Merge to `main` → auto-deploys to staging
4. **Validate**: Test on staging environment
5. **Production**: Manual workflow dispatch to deploy to prod

---

For detailed documentation, troubleshooting, backup strategies, and more, see [KUBERNETES_DEPLOYMENT.md](./KUBERNETES_DEPLOYMENT.md).

