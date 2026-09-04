# Streamline Scheduler Workflows - Architecture

The Plandera app repository uses an **orchestrated workflow architecture** where building and deploying are separated into modular, reusable workflows.

## Workflow Structure

```
┌─────────────────────────────────────────────────────────────┐
│              Staging Orchestrator                            │
│        (staging-orchestrator.yml)                            │
│        Trigger: push to main                                 │
└────────────┬────────────────────────────────────────────────┘
             │
             ├─► build-images.yml (environment: staging)
             │   ├─ Build backend:staging-latest
             │   └─ Build frontend:staging-latest
             │
             └─► deploy-staging.yml
                 └─ Deploy to plandera-staging namespace

┌─────────────────────────────────────────────────────────────┐
│           Production Orchestrator                            │
│       (production-orchestrator.yml)                          │
│       Trigger: manual with confirmation                      │
└────────────┬────────────────────────────────────────────────┘
             │
             ├─► Validate confirmation
             │
             ├─► build-images.yml (environment: production)
             │   ├─ Build backend:latest
             │   └─ Build frontend:latest
             │
             └─► deploy-production.yml
                 └─ Deploy to plandera-production namespace
```

## Available Workflows

### Orchestrators (Main Workflows)

#### 1. Staging Orchestrator
**File**: `staging-orchestrator.yml`
**Triggers**: 
- ✅ Automatic on push to `main`
- 🔧 Manual via workflow_dispatch

**What it does**:
1. Builds Docker images for staging
2. Deploys to staging environment

#### 2. Production Orchestrator
**File**: `production-orchestrator.yml`
**Triggers**:
- 🔧 Manual only with confirmation

**What it does**:
1. Validates confirmation input
2. Builds Docker images for production
3. Deploys to production environment

### Reusable Workflows

#### 3. Build Images
**File**: `build-images.yml`
**Triggers**:
- 🔗 Called by orchestrators
- 🔧 Can be run manually

**What it does**:
- Builds backend Docker image
- Builds frontend Docker image
- Tags appropriately for environment
- Pushes to GHCR

**Inputs**:
- `environment`: staging or production

#### 4. Deploy to Staging
**File**: `deploy-staging.yml`
**Triggers**:
- 🔗 Called by staging orchestrator
- 🔧 Can be run manually

**What it does**:
- Applies Kubernetes manifests to staging
- Waits for rollout completion
- Verifies deployment

#### 5. Deploy to Production
**File**: `deploy-production.yml`
**Triggers**:
- 🔗 Called by production orchestrator
- 🔧 Can be run manually

**What it does**:
- Applies Kubernetes manifests to production
- Waits for rollout completion
- Runs smoke tests
- Verifies deployment

## Usage Scenarios

### Scenario 1: Deploy to Staging (Automatic)
**When**: Push to main branch
**Workflow**: `staging-orchestrator.yml`
**Result**: Images built, deployed to staging

```bash
git push origin main
# Automatically:
# 1. Builds backend:staging-latest
# 2. Builds frontend:staging-latest
# 3. Deploys to plandera-staging
```

### Scenario 2: Deploy to Production (Manual)
**When**: Ready to deploy to production
**Workflow**: `production-orchestrator.yml`

```bash
# Via GitHub Actions UI:
Actions → "Deploy to Production (Orchestrator)" 
→ Type "deploy-to-production" → Run workflow

# Automatically:
# 1. Validates confirmation
# 2. Builds backend:latest
# 3. Builds frontend:latest
# 4. Deploys to plandera-production
```

### Scenario 3: Build Images Only
**When**: Need to build images without deploying
**Workflow**: `build-images.yml`

```bash
Actions → "Build Docker Images" 
→ Select environment → Run workflow
```

### Scenario 4: Deploy Existing Images
**When**: Images already built, just need to deploy
**Workflows**: `deploy-staging.yml` or `deploy-production.yml`

```bash
Actions → "Deploy to Staging" or "Deploy to Production"
→ Run workflow
```

## Benefits

✅ **Modular**: Each workflow has a single responsibility
✅ **Reusable**: Workflows can be called by orchestrators or run standalone
✅ **Flexible**: Build and deploy separately or together
✅ **Efficient**: Don't rebuild if images already exist
✅ **Safe**: Production requires explicit confirmation
✅ **DRY**: No code duplication

## Image Naming Convention

### Staging
- `ghcr.io/{owner}/plandera-backend:staging-latest`
- `ghcr.io/{owner}/plandera-backend:staging-{sha}`
- `ghcr.io/{owner}/plandera-frontend:staging-latest`
- `ghcr.io/{owner}/plandera-frontend:staging-{sha}`

### Production
- `ghcr.io/{owner}/plandera-backend:latest`
- `ghcr.io/{owner}/plandera-backend:{sha}`
- `ghcr.io/{owner}/plandera-frontend:latest`
- `ghcr.io/{owner}/plandera-frontend:{sha}`

## Workflow Files

| File | Type | Triggers | Purpose |
|------|------|----------|---------|
| `staging-orchestrator.yml` | Orchestrator | push to main, manual | Build + deploy staging |
| `production-orchestrator.yml` | Orchestrator | manual only | Build + deploy production |
| `build-images.yml` | Reusable | called, manual | Build Docker images |
| `deploy-staging.yml` | Reusable | called, manual | Deploy to staging |
| `deploy-production.yml` | Reusable | called, manual | Deploy to production |

## When Each Workflow Runs

### Automatic (on push to main):
- ✅ `staging-orchestrator.yml` → builds images → deploys to staging

### Manual Only:
- 🔧 `production-orchestrator.yml` → requires confirmation
- 🔧 `build-images.yml` → standalone image building
- 🔧 `deploy-staging.yml` → standalone deployment
- 🔧 `deploy-production.yml` → standalone deployment

### Called by Orchestrators:
- 🔗 `build-images.yml` (called by both orchestrators)
- 🔗 `deploy-staging.yml` (called by staging orchestrator)
- 🔗 `deploy-production.yml` (called by production orchestrator)

## Summary

The streamline-scheduler repository uses a **modular, orchestrated workflow architecture** with clear separation between:

1. **Building** - Create Docker images
2. **Deploying** - Apply Kubernetes manifests
3. **Orchestration** - Coordinate build + deploy

This provides maximum flexibility while maintaining simplicity for the common case (push to main = automatic staging deployment). 🚀

