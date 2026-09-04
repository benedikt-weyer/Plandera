# GitHub Actions Setup Guide

This guide explains how to configure GitHub Actions secrets for automated deployment to your Kubernetes cluster.

## Prerequisites

- Access to your Kubernetes cluster
- kubectl configured on your local machine
- GitHub repository admin access
- GitHub Personal Access Token with `write:packages` scope

## Step 1: Create GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a descriptive name: "Plandera K8s Deployment"
4. Select scopes:
   - `write:packages` - for pushing Docker images to GHCR
   - `read:packages` - for pulling Docker images from GHCR
5. Click "Generate token"
6. **Copy the token immediately** - you won't be able to see it again

## Step 2: Prepare Kubeconfig

The GitHub Actions workflow needs access to your Kubernetes cluster. You'll encode your kubeconfig as a base64 string.

### Option A: Use your existing kubeconfig

```bash
# Encode your current kubeconfig
cat ~/.kube/config | base64 -w 0
```

**⚠️ Security Note**: This will grant full access to your cluster. Consider creating a service account with limited permissions (see Option B).

### Option B: Create a dedicated service account (Recommended)

Create a service account specifically for GitHub Actions with limited permissions:

```bash
# Create service account
kubectl create serviceaccount github-actions -n kube-system

# Create cluster role binding
kubectl create clusterrolebinding github-actions-admin \
  --clusterrole=cluster-admin \
  --serviceaccount=kube-system:github-actions

# Get the service account token (Kubernetes 1.24+)
kubectl create token github-actions -n kube-system --duration=87600h

# For older Kubernetes versions, get the secret token:
SECRET_NAME=$(kubectl get serviceaccount github-actions -n kube-system -o jsonpath='{.secrets[0].name}')
TOKEN=$(kubectl get secret $SECRET_NAME -n kube-system -o jsonpath='{.data.token}' | base64 -d)
```

Then create a kubeconfig file:

```yaml
apiVersion: v1
kind: Config
clusters:
- cluster:
    certificate-authority-data: <CA_DATA>
    server: <YOUR_CLUSTER_URL>
  name: k3s-cluster
contexts:
- context:
    cluster: k3s-cluster
    user: github-actions
  name: github-actions-context
current-context: github-actions-context
users:
- name: github-actions
  user:
    token: <SERVICE_ACCOUNT_TOKEN>
```

Replace:
- `<CA_DATA>`: Get with `kubectl config view --raw -o jsonpath='{.clusters[0].cluster.certificate-authority-data}'`
- `<YOUR_CLUSTER_URL>`: Get with `kubectl config view --raw -o jsonpath='{.clusters[0].cluster.server}'`
- `<SERVICE_ACCOUNT_TOKEN>`: The token from the previous step

Then encode it:

```bash
cat kubeconfig-github-actions.yaml | base64 -w 0
```

## Step 3: Configure GitHub Repository Secrets

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"

Add the following secret:

### KUBECONFIG
- **Name**: `KUBECONFIG`
- **Value**: The base64-encoded kubeconfig from Step 2
- **Description**: Base64-encoded kubeconfig for cluster access

## Step 4: Verify Image Registry Permissions

The workflows automatically use `secrets.GITHUB_TOKEN` for pushing and pulling images to/from GitHub Container Registry (GHCR). This should work out of the box, but ensure:

1. Go to repository Settings → Actions → General
2. Scroll to "Workflow permissions"
3. Ensure "Read and write permissions" is selected
4. Check "Allow GitHub Actions to create and approve pull requests" if needed

## Step 5: Update Image Names (if needed)

If your GitHub username differs from the repository owner, update the image names in:

### GitHub Actions Workflows

Update in `.github/workflows/deploy-staging.yml` and `.github/workflows/deploy-production.yml`:

```yaml
env:
  REGISTRY: ghcr.io
  BACKEND_IMAGE_NAME: YOUR_USERNAME/plandera-backend
  FRONTEND_IMAGE_NAME: YOUR_USERNAME/plandera-frontend
```

### Kubernetes Manifests

Update in all deployment files:

- `k8s/staging/backend.yaml`
- `k8s/staging/frontend.yaml`
- `k8s/production/backend.yaml`
- `k8s/production/frontend.yaml`

Replace:
```yaml
image: ghcr.io/benedikt-weyer/plandera-backend:staging-latest
```

With:
```yaml
image: ghcr.io/YOUR_USERNAME/plandera-backend:staging-latest
```

## Step 6: Test the Setup

### Test Staging Deployment

1. Make a small change to your code
2. Commit and push to `main` branch
3. Go to Actions tab in GitHub
4. Watch the "Deploy to Staging" workflow run
5. Check for any errors

### Test Production Deployment

1. Go to Actions tab
2. Select "Deploy to Production" workflow
3. Click "Run workflow"
4. Type `deploy-to-production` in the confirmation field
5. Click "Run workflow"
6. Monitor the deployment

## Troubleshooting

### Error: "failed to connect to cluster"

- **Cause**: Invalid or expired kubeconfig
- **Solution**: Regenerate the kubeconfig and update the `KUBECONFIG` secret

### Error: "unauthorized: authentication required"

- **Cause**: GITHUB_TOKEN doesn't have package permissions
- **Solution**: Check workflow permissions in repository settings

### Error: "Error from server (Forbidden)"

- **Cause**: Service account lacks necessary permissions
- **Solution**: Ensure the service account has cluster-admin role or appropriate RBAC permissions

### Error: "failed to pull image"

- **Cause**: Image pull secret not configured or expired
- **Solution**: 
  ```bash
  # Recreate the image pull secret
  kubectl create secret docker-registry ghcr-secret \
    --docker-server=ghcr.io \
    --docker-username=YOUR_USERNAME \
    --docker-password=$GITHUB_TOKEN \
    --namespace=plandera-staging \
    --dry-run=client -o yaml | kubectl apply -f -
  ```

## Security Best Practices

1. **Limit service account permissions**: Use RBAC to grant only necessary permissions
2. **Rotate tokens regularly**: Update the KUBECONFIG secret periodically
3. **Use environment protection rules**: Enable GitHub environment protection for production
4. **Review workflow runs**: Regularly check Actions logs for suspicious activity
5. **Use branch protection**: Require PR reviews before merging to main

## Advanced: Environment Protection Rules

For extra protection on production deployments:

1. Go to Settings → Environments
2. Click "New environment" and name it "production"
3. Configure protection rules:
   - **Required reviewers**: Add team members who must approve
   - **Wait timer**: Add a delay before deployment
   - **Deployment branches**: Restrict to main branch only

4. The production workflow already uses this environment:
   ```yaml
   environment:
     name: production
     url: https://app.plandera.app
   ```

## Monitoring Deployments

### View workflow logs
1. Go to Actions tab
2. Click on a workflow run
3. Click on a job to see detailed logs

### Check deployment status
```bash
# Check pods
kubectl get pods -n plandera-staging
kubectl get pods -n plandera-production

# Check deployment rollout status
kubectl rollout status deployment/backend -n plandera-staging
kubectl rollout status deployment/frontend -n plandera-production
```

### View application logs
```bash
# Staging
kubectl logs -f deployment/backend -n plandera-staging
kubectl logs -f deployment/frontend -n plandera-staging

# Production
kubectl logs -f deployment/backend -n plandera-production
kubectl logs -f deployment/frontend -n plandera-production
```

## Next Steps

After setting up GitHub Actions:

1. **Test the staging pipeline**: Push a change to main and verify deployment
2. **Configure DNS**: Point your domains to the cluster ingress
3. **Test production pipeline**: Run a manual production deployment
4. **Set up monitoring**: Consider adding monitoring and alerting
5. **Configure backups**: Set up automated database backups

For more information, see:
- [K8S_QUICKSTART.md](./K8S_QUICKSTART.md) - Quick deployment guide
- [KUBERNETES_DEPLOYMENT.md](./KUBERNETES_DEPLOYMENT.md) - Comprehensive documentation

