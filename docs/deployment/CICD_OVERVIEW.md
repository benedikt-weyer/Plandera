# CI/CD Pipeline Overview

This document provides an overview of the CI/CD pipeline for Plandera (formerly Streamline Scheduler).

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GitHub Repository                             │
│                    streamline-scheduler                              │
└────────────┬───────────────────────────────────┬────────────────────┘
             │                                   │
             │ Push to main                      │ Manual Workflow Dispatch
             │                                   │ (with confirmation)
             ▼                                   ▼
┌────────────────────────────┐    ┌────────────────────────────────────┐
│   Staging Pipeline         │    │   Production Pipeline              │
│   (deploy-staging.yml)     │    │   (deploy-production.yml)          │
└────────────┬───────────────┘    └────────────┬───────────────────────┘
             │                                  │
             │ 1. Build Images                  │ 1. Validate Input
             │ 2. Push to GHCR                  │ 2. Build Images
             │ 3. Deploy to K8s                 │ 3. Push to GHCR
             │                                  │ 4. Deploy to K8s
             ▼                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                                │
├────────────────────────────┬─────────────────────────────────────────┤
│  plandera-staging           │  plandera-production                     │
│  Namespace                 │  Namespace                              │
├────────────────────────────┼─────────────────────────────────────────┤
│  ┌──────────────────────┐  │  ┌──────────────────────────────────┐  │
│  │ PostgreSQL           │  │  │ PostgreSQL                       │  │
│  │ (1 replica)          │  │  │ (1 replica)                      │  │
│  └──────────────────────┘  │  └──────────────────────────────────┘  │
│  ┌──────────────────────┐  │  ┌──────────────────────────────────┐  │
│  │ Backend              │  │  │ Backend                          │  │
│  │ (1 replica)          │  │  │ (2 replicas)                     │  │
│  └──────────────────────┘  │  └──────────────────────────────────┘  │
│  ┌──────────────────────┐  │  ┌──────────────────────────────────┐  │
│  │ Frontend             │  │  │ Frontend                         │  │
│  │ (1 replica)          │  │  │ (2 replicas)                     │  │
│  └──────────────────────┘  │  └──────────────────────────────────┘  │
└────────────┬───────────────┴────────────┬────────────────────────────┘
             │                            │
             ▼                            ▼
┌────────────────────────────┐  ┌────────────────────────────────────┐
│ Traefik Ingress            │  │ Traefik Ingress                    │
│ staging.plandera.app        │  │ app.plandera.app                    │
│ staging-api.plandera.app    │  │ api.plandera.app                    │
└────────────────────────────┘  └────────────────────────────────────┘
```

## Pipeline Stages

### Staging Pipeline

**Trigger**: Automatic on push to `main` branch

1. **Build Backend**
   - Build Docker image from `backend/Dockerfile`
   - Tag: `ghcr.io/<username>/plandera-backend:staging-latest`
   - Tag: `ghcr.io/<username>/plandera-backend:staging-<sha>`
   - Push to GitHub Container Registry

2. **Build Frontend**
   - Build Docker image from `apps/frontend/Dockerfile`
   - Tag: `ghcr.io/<username>/plandera-frontend:staging-latest`
   - Tag: `ghcr.io/<username>/plandera-frontend:staging-<sha>`
   - Push to GitHub Container Registry

3. **Deploy to Staging**
   - Apply Kubernetes manifests from `k8s/staging/`
   - Create/update namespace: `plandera-staging`
   - Deploy PostgreSQL, Backend, Frontend
   - Create/update Ingress rules
   - Wait for rollout completion

4. **Verify Deployment**
   - Check pod status
   - Display service and ingress information

**Typical Duration**: 5-10 minutes

### Production Pipeline

**Trigger**: Manual workflow dispatch (requires confirmation)

1. **Validate Input**
   - Require user to type "deploy-to-production"
   - Prevents accidental deployments

2. **Build Backend**
   - Build Docker image from `backend/Dockerfile`
   - Tag: `ghcr.io/<username>/plandera-backend:latest`
   - Tag: `ghcr.io/<username>/plandera-backend:<sha>`
   - Tag: `ghcr.io/<username>/plandera-backend:<tag>` (if tagged)
   - Push to GitHub Container Registry

3. **Build Frontend**
   - Build Docker image from `apps/frontend/Dockerfile`
   - Tag: `ghcr.io/<username>/plandera-frontend:latest`
   - Tag: `ghcr.io/<username>/plandera-frontend:<sha>`
   - Tag: `ghcr.io/<username>/plandera-frontend:<tag>` (if tagged)
   - Push to GitHub Container Registry

4. **Deploy to Production**
   - Apply Kubernetes manifests from `k8s/production/`
   - Create/update namespace: `plandera-production`
   - Deploy PostgreSQL, Backend (2 replicas), Frontend (2 replicas)
   - Create/update Ingress rules
   - Wait for rollout completion

5. **Smoke Tests**
   - Test backend health endpoint
   - Verify services are responding

6. **Verify Deployment**
   - Check pod status
   - Display service and ingress information

**Typical Duration**: 8-15 minutes

## Deployment Strategy

### Rolling Update

Both staging and production use Kubernetes rolling updates:

- Zero-downtime deployments
- Gradual rollout of new versions
- Automatic rollback on failure
- Health checks ensure pod readiness

### Rollback Strategy

If issues are detected:

```bash
# Rollback backend
kubectl rollout undo deployment/backend -n plandera-production

# Rollback frontend
kubectl rollout undo deployment/frontend -n plandera-production
```

## Environment Differences

| Aspect | Staging | Production |
|--------|---------|------------|
| Namespace | `plandera-staging` | `plandera-production` |
| Backend Replicas | 1 | 2 |
| Frontend Replicas | 1 | 2 |
| Database Storage | 10Gi | 20Gi |
| Log Level | `debug` | `info` |
| Resource Limits | Lower | Higher |
| Domains | `staging.plandera.app`<br/>`staging-api.plandera.app` | `app.plandera.app`<br/>`api.plandera.app` |
| Deployment | Automatic on main | Manual with confirmation |

## Security Measures

1. **Image Pull Secrets**: Private GitHub Container Registry access
2. **Kubernetes Secrets**: Encrypted credentials for database and JWT
3. **TLS Certificates**: Automatic via cert-manager (Let's Encrypt)
4. **Network Policies**: Namespace isolation
5. **RBAC**: Limited service account permissions
6. **Confirmation Required**: Production deployments require explicit confirmation

## Monitoring Points

### Build Stage
- Docker build success/failure
- Image push success
- Image size and build time

### Deployment Stage
- Kubectl apply success
- Pod creation and startup
- Container health checks
- Rollout completion

### Runtime
- Pod status (Running, CrashLoopBackOff, etc.)
- Service endpoints
- Ingress configuration
- Certificate status

## Best Practices

### Development Workflow

1. **Feature Development**
   ```
   feature-branch → PR → code review → merge to main
   ```

2. **Staging Verification**
   ```
   main branch → auto-deploy to staging → test → validate
   ```

3. **Production Release**
   ```
   staging validated → manual trigger → confirm → deploy to prod
   ```

### Deployment Checklist

Before deploying to production:

- [ ] Changes tested locally
- [ ] PR reviewed and approved
- [ ] Deployed to staging successfully
- [ ] Staging environment tested
- [ ] No critical bugs in staging
- [ ] Database migrations tested (if any)
- [ ] Breaking changes documented
- [ ] Team notified of deployment

### Rollback Checklist

If production issues occur:

- [ ] Identify the issue
- [ ] Check logs: `kubectl logs -f deployment/backend -n plandera-production`
- [ ] Check pod status: `kubectl get pods -n plandera-production`
- [ ] Rollback if necessary: `kubectl rollout undo deployment/backend -n plandera-production`
- [ ] Verify rollback: `kubectl rollout status deployment/backend -n plandera-production`
- [ ] Document the issue
- [ ] Create fix in feature branch

## Metrics and Observability

### Key Metrics to Monitor

1. **Deployment Metrics**
   - Deployment frequency
   - Deployment duration
   - Success/failure rate
   - Rollback frequency

2. **Application Metrics**
   - Pod restarts
   - Container errors
   - Resource usage (CPU, memory)
   - Request latency

3. **Infrastructure Metrics**
   - Cluster health
   - Node resources
   - Storage capacity
   - Network traffic

### Recommended Tools

- **Logs**: kubectl logs, Loki
- **Metrics**: Prometheus, Grafana
- **Tracing**: Jaeger, OpenTelemetry
- **Alerts**: AlertManager

## Troubleshooting Common Issues

### Pipeline Fails at Build Stage

**Symptoms**: Docker build fails
**Causes**: 
- Syntax errors in Dockerfile
- Missing dependencies
- Build context issues

**Solution**:
```bash
# Test build locally
docker build -t test-build ./backend
docker build -f apps/frontend/Dockerfile -t test-build .
```

### Pipeline Fails at Push Stage

**Symptoms**: Cannot push to registry
**Causes**:
- Invalid GitHub token
- Insufficient permissions
- Registry unavailable

**Solution**:
- Check GitHub Actions permissions in repository settings
- Verify GITHUB_TOKEN has write:packages scope

### Pipeline Fails at Deploy Stage

**Symptoms**: kubectl apply fails
**Causes**:
- Invalid kubeconfig
- Cluster unreachable
- Insufficient permissions

**Solution**:
- Verify KUBECONFIG secret is correct
- Test cluster connection locally
- Check service account permissions

### Deployment Stuck in Rollout

**Symptoms**: Pods not becoming ready
**Causes**:
- Image pull errors
- Container crashes
- Health check failures

**Solution**:
```bash
# Check pod status
kubectl describe pod <pod-name> -n <namespace>

# Check logs
kubectl logs <pod-name> -n <namespace>

# Check events
kubectl get events -n <namespace> --sort-by='.lastTimestamp'
```

## Future Improvements

- [ ] Add automated testing stage
- [ ] Implement blue-green deployments
- [ ] Add canary deployments
- [ ] Integrate with monitoring tools
- [ ] Add automated rollback on health check failure
- [ ] Implement GitOps with ArgoCD/Flux
- [ ] Add deployment notifications (Slack, email)
- [ ] Implement database migration automation
- [ ] Add end-to-end tests in pipeline
- [ ] Configure backup automation

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Traefik Documentation](https://doc.traefik.io/traefik/)
- [cert-manager Documentation](https://cert-manager.io/docs/)

