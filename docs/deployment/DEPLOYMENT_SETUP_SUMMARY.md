# Kubernetes Deployment - Setup Summary

This document provides a complete overview of the Kubernetes deployment setup for Plandera (formerly Streamline Scheduler).

## What Has Been Created

### Kubernetes Manifests

#### Staging Environment (`k8s/staging/`)
- **namespace.yaml** - Creates `plandera-staging` namespace
- **postgres.yaml** - PostgreSQL database with 10Gi storage
- **backend.yaml** - Backend deployment (1 replica) and service
- **frontend.yaml** - Frontend deployment (1 replica) and service
- **ingress.yaml** - Ingress rules for `staging.plandera.app` and `staging-api.plandera.app`

#### Production Environment (`k8s/production/`)
- **namespace.yaml** - Creates `plandera-production` namespace
- **postgres.yaml** - PostgreSQL database with 20Gi storage
- **backend.yaml** - Backend deployment (2 replicas) and service
- **frontend.yaml** - Frontend deployment (2 replicas) and service
- **ingress.yaml** - Ingress rules for `app.plandera.app` and `api.plandera.app`

### CI/CD Workflows (`.github/workflows/`)

- **deploy-staging.yml** - Automatic deployment to staging on push to main
- **deploy-production.yml** - Manual deployment to production (requires confirmation)

### Helper Scripts

- **deploy.sh** - Deployment helper script
  ```bash
  ./deploy.sh deploy staging
  ./deploy.sh deploy production
  ./deploy.sh status staging
  ./deploy.sh logs staging backend
  ```

- **setup-k8s-secrets.sh** - Secrets management helper
  ```bash
  ./setup-k8s-secrets.sh secrets staging
  ./setup-k8s-secrets.sh secrets production
  ./setup-k8s-secrets.sh all production <username> <token>
  ```

### Documentation

- **KUBERNETES_DEPLOYMENT.md** - Comprehensive deployment guide
- **K8S_QUICKSTART.md** - Quick reference guide
- **GITHUB_ACTIONS_SETUP.md** - GitHub Actions configuration guide
- **CICD_OVERVIEW.md** - CI/CD pipeline documentation
- **README.md** - Updated with Kubernetes deployment section

### Docker Configuration

- **backend/.dockerignore** - Optimizes backend Docker builds
- **.dockerignore** - Optimizes frontend Docker builds

## Quick Start Guide

### 1. Initial Setup

```bash
# Update domain names in ingress files
# Edit k8s/staging/ingress.yaml and k8s/production/ingress.yaml

# Generate and configure secrets
./setup-k8s-secrets.sh secrets production

# Configure GitHub Actions
# Follow GITHUB_ACTIONS_SETUP.md
```

### 2. Deploy to Staging

**Option A: Via GitHub Actions (Recommended)**
```bash
git push origin main  # Automatic deployment
```

**Option B: Manual Deployment**
```bash
./deploy.sh deploy staging
```

### 3. Deploy to Production

**Via GitHub Actions**
1. Go to Actions tab in GitHub
2. Select "Deploy to Production"
3. Click "Run workflow"
4. Type `deploy-to-production`
5. Click "Run workflow"

**Manual Deployment**
```bash
./deploy.sh deploy production
```

## Key Features

### Separation of Concerns
- ✅ Deployment configuration lives in the app repository
- ✅ No dependency on VPS repository
- ✅ Independent deployment pipeline

### Environment Isolation
- ✅ Separate namespaces: `plandera-staging` and `plandera-production`
- ✅ Independent resources and configurations
- ✅ Different scaling and resource limits

### Automated Deployments
- ✅ Staging: Auto-deploy on merge to main
- ✅ Production: Manual trigger with confirmation
- ✅ Zero-downtime rolling updates
- ✅ Automatic rollback on failure

### Security
- ✅ Kubernetes secrets for sensitive data
- ✅ TLS certificates via cert-manager
- ✅ Private container registry support
- ✅ Namespace isolation

## Architecture Overview

```
Repository Structure:
streamline-scheduler/
├── k8s/                          # Kubernetes manifests
│   ├── staging/                  # Staging environment
│   │   ├── namespace.yaml
│   │   ├── postgres.yaml
│   │   ├── backend.yaml
│   │   ├── frontend.yaml
│   │   └── ingress.yaml
│   └── production/               # Production environment
│       ├── namespace.yaml
│       ├── postgres.yaml
│       ├── backend.yaml
│       ├── frontend.yaml
│       └── ingress.yaml
├── .github/
│   └── workflows/
│       ├── deploy-staging.yml    # Staging CI/CD
│       └── deploy-production.yml # Production CI/CD
├── backend/                      # Rust backend
│   ├── Dockerfile
│   └── .dockerignore
├── apps/frontend/                # Next.js frontend
│   ├── Dockerfile
│   └── .dockerignore
├── deploy.sh                     # Deployment helper
├── setup-k8s-secrets.sh         # Secrets helper
└── docs/
    ├── KUBERNETES_DEPLOYMENT.md
    ├── K8S_QUICKSTART.md
    ├── GITHUB_ACTIONS_SETUP.md
    └── CICD_OVERVIEW.md
```

## Deployment Flow

### Staging
```
Push to main → GitHub Actions → Build Images → Push to GHCR → Deploy to K8s
                     ↓
              plandera-staging namespace
                     ↓
         staging.plandera.app (frontend)
         staging-api.plandera.app (backend)
```

### Production
```
Manual Trigger → Confirm → GitHub Actions → Build Images → Push to GHCR → Deploy to K8s
                                ↓
                    plandera-production namespace
                                ↓
                   app.plandera.app (frontend)
                   api.plandera.app (backend)
```

## Configuration Checklist

### Before First Deployment

- [ ] **Update domain names** in `k8s/staging/ingress.yaml` and `k8s/production/ingress.yaml`
- [ ] **Generate secrets** using `./setup-k8s-secrets.sh secrets production`
- [ ] **Update image names** if your GitHub username differs from repository owner
- [ ] **Configure DNS** to point to your cluster ingress IP
- [ ] **Set up GitHub secrets**:
  - [ ] `KUBECONFIG` - Base64-encoded kubeconfig
- [ ] **Verify GitHub Actions permissions** - Enable "Read and write permissions"
- [ ] **Test cluster connection** - `kubectl cluster-info`

### Before Production Deployment

- [ ] **Test in staging** - Verify all features work
- [ ] **Update production secrets** - Use strong passwords
- [ ] **Backup existing data** (if upgrading)
- [ ] **Review changes** - Check what's being deployed
- [ ] **Notify team** - Inform about deployment window
- [ ] **Monitor during deployment** - Watch logs and metrics

## Environment URLs

After deployment, your application will be available at:

### Staging
- **Frontend**: https://staging.plandera.app
- **Backend API**: https://staging-api.plandera.app
- **Health Check**: https://staging-api.plandera.app/health

### Production
- **Frontend**: https://app.plandera.app
- **Backend API**: https://api.plandera.app
- **Health Check**: https://api.plandera.app/health

## Common Commands

### Deployment
```bash
# Deploy to staging
./deploy.sh deploy staging

# Deploy to production
./deploy.sh deploy production

# Check status
./deploy.sh status staging
./deploy.sh status production
```

### Monitoring
```bash
# View logs
./deploy.sh logs staging backend
./deploy.sh logs production frontend

# Check pods
kubectl get pods -n plandera-staging
kubectl get pods -n plandera-production

# Check ingress
kubectl get ingress -n plandera-staging
kubectl get ingress -n plandera-production
```

### Management
```bash
# Restart deployment
./deploy.sh restart staging backend

# Rollback deployment
./deploy.sh rollback production backend

# Scale deployment
kubectl scale deployment/backend --replicas=3 -n plandera-production
```

## Monitoring and Debugging

### Check Deployment Status
```bash
kubectl get pods -n plandera-staging
kubectl get pods -n plandera-production
```

### View Logs
```bash
kubectl logs -f deployment/backend -n plandera-staging
kubectl logs -f deployment/frontend -n plandera-production
```

### Debug Pod Issues
```bash
kubectl describe pod <pod-name> -n <namespace>
kubectl get events -n <namespace> --sort-by='.lastTimestamp'
```

### Check Ingress and Certificates
```bash
kubectl get ingress -n plandera-staging
kubectl get certificates -n plandera-staging
kubectl describe certificate staging-backend-tls -n plandera-staging
```

## Backup and Recovery

### Database Backup
```bash
# Backup
kubectl exec deployment/postgres -n plandera-production -- \
  pg_dump -U plandera plandera_db > backup-$(date +%Y%m%d).sql

# Restore
cat backup.sql | kubectl exec -i deployment/postgres -n plandera-production -- \
  psql -U plandera plandera_db
```

## Troubleshooting

### Pods Not Starting
1. Check pod status: `kubectl describe pod <pod-name> -n <namespace>`
2. Check logs: `kubectl logs <pod-name> -n <namespace>`
3. Check events: `kubectl get events -n <namespace>`

### Image Pull Errors
```bash
# Recreate image pull secret
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=<username> \
  --docker-password=<token> \
  --namespace=<namespace> \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Database Connection Issues
```bash
# Check if postgres is ready
kubectl exec -it deployment/postgres -n <namespace> -- pg_isready -U plandera

# Check database logs
kubectl logs deployment/postgres -n <namespace>
```

### Certificate Issues
```bash
# Check certificate status
kubectl get certificates -n <namespace>
kubectl describe certificate <cert-name> -n <namespace>

# Check cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager
```

## Next Steps

1. **Review Documentation**
   - Read [KUBERNETES_DEPLOYMENT.md](./KUBERNETES_DEPLOYMENT.md) for detailed information
   - Check [K8S_QUICKSTART.md](./K8S_QUICKSTART.md) for quick reference
   - Follow [GITHUB_ACTIONS_SETUP.md](./GITHUB_ACTIONS_SETUP.md) for CI/CD setup

2. **Configure Secrets**
   - Run `./setup-k8s-secrets.sh secrets production`
   - Update production secrets with strong passwords
   - Store secrets securely (e.g., in password manager)

3. **Set Up DNS**
   - Point domains to cluster ingress IP
   - Wait for DNS propagation
   - Verify with `nslookup staging.plandera.app`

4. **Configure GitHub Actions**
   - Add KUBECONFIG secret
   - Test staging deployment
   - Test production deployment

5. **Deploy and Test**
   - Deploy to staging first
   - Verify all features work
   - Deploy to production when ready

6. **Set Up Monitoring** (Optional)
   - Install Prometheus and Grafana
   - Configure alerts
   - Set up log aggregation

## Support and Resources

### Documentation
- [KUBERNETES_DEPLOYMENT.md](./KUBERNETES_DEPLOYMENT.md) - Comprehensive guide
- [K8S_QUICKSTART.md](./K8S_QUICKSTART.md) - Quick reference
- [GITHUB_ACTIONS_SETUP.md](./GITHUB_ACTIONS_SETUP.md) - CI/CD setup
- [CICD_OVERVIEW.md](./CICD_OVERVIEW.md) - Pipeline documentation

### Helper Scripts
- `./deploy.sh` - Deployment operations
- `./setup-k8s-secrets.sh` - Secrets management

### External Resources
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Traefik Documentation](https://doc.traefik.io/traefik/)
- [cert-manager Documentation](https://cert-manager.io/docs/)

## Summary

You now have a complete Kubernetes deployment setup with:

✅ **Separate environments** - Staging and production namespaces
✅ **Automated CI/CD** - GitHub Actions workflows
✅ **Helper scripts** - Easy deployment and management
✅ **Comprehensive docs** - Detailed guides and references
✅ **Security** - Secrets management and TLS certificates
✅ **Scalability** - Multiple replicas in production
✅ **Flexibility** - Independent deployment from VPS repo

Your deployment is ready to go! Follow the configuration checklist and quick start guide to get started.

