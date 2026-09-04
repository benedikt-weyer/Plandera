# Streamline Scheduler Documentation

This directory contains comprehensive documentation for the Streamline Scheduler project.

## 📚 Documentation Structure

### 🚀 Deployment
Documentation related to deploying and running Streamline Scheduler in various environments.

- [**CI/CD Overview**](deployment/CICD_OVERVIEW.md) - Continuous Integration and Deployment pipeline overview
- [**Deployment Setup Summary**](deployment/DEPLOYMENT_SETUP_SUMMARY.md) - Quick reference for deployment setup
- [**Complete Setup Summary**](deployment/COMPLETE_SETUP_SUMMARY.md) - Comprehensive setup guide covering all aspects
- [**Kubernetes Deployment**](deployment/KUBERNETES_DEPLOYMENT.md) - Detailed guide for Kubernetes deployments
- [**K8s Quick Start**](deployment/K8S_QUICKSTART.md) - Fast-track guide to get started with Kubernetes
- [**GitHub Actions Setup**](deployment/GITHUB_ACTIONS_SETUP.md) - Configure GitHub Actions for automated deployment

### 🏗️ Architecture
Documentation about the system architecture and design decisions.

- [**Workflows Architecture**](architecture/WORKFLOWS_ARCHITECTURE.md) - Overview of workflow patterns and architecture

### 🔌 Integration
Guides for integrating Streamline Scheduler with external services.

- [**SSO Integration**](integration/SSO_INTEGRATION.md) - Single Sign-On integration guide (detailed)
- [**SSO Quick Start**](integration/SSO_QUICK_START.md) - Quick guide to set up SSO

### 🧪 Testing
Testing guides and procedures for quality assurance.

- [**Recurring Events Integration Test**](testing/RECURRING_EVENTS_INTEGRATION_TEST.md) - Comprehensive manual testing guide for recurring event functionality
  - Covers 120 test scenarios
  - Includes regular and group recurring events
  - Details all permutations for moving, editing, and deleting events

---

## 📖 Component-Specific Documentation

### Backend
See [backend/README.md](../backend/README.md) and [backend/API.md](../backend/API.md) for backend-specific documentation.

### Frontend
See [apps/frontend/README.md](../apps/frontend/README.md) for frontend-specific documentation.

### Internationalization
See [apps/frontend/utils/i18n/README.md](../apps/frontend/utils/i18n/README.md) for translation and localization guides.

---

## 🔍 Quick Links

### For Developers
- Start with [Complete Setup Summary](deployment/COMPLETE_SETUP_SUMMARY.md)
- Review [Workflows Architecture](architecture/WORKFLOWS_ARCHITECTURE.md)
- Check [API Documentation](../backend/API.md)

### For DevOps Engineers
- Read [Kubernetes Deployment](deployment/KUBERNETES_DEPLOYMENT.md)
- See [CI/CD Overview](deployment/CICD_OVERVIEW.md)
- Follow [K8s Quick Start](deployment/K8S_QUICKSTART.md)

### For QA Engineers
- Follow [Recurring Events Integration Test](testing/RECURRING_EVENTS_INTEGRATION_TEST.md)
- Check component-specific test documentation in respective directories

### For System Integrators
- Review [SSO Integration](integration/SSO_INTEGRATION.md)
- Use [SSO Quick Start](integration/SSO_QUICK_START.md) for rapid setup

---

## 📝 Contributing to Documentation

When adding new documentation:

1. **Place files in appropriate subdirectories:**
   - `deployment/` - Deployment and infrastructure docs
   - `architecture/` - System design and architecture docs
   - `integration/` - Third-party integration guides
   - `testing/` - Testing procedures and test plans

2. **Update this INDEX.md** to include links to new documents

3. **Follow naming conventions:**
   - Use UPPERCASE for multi-word docs (e.g., `SSO_INTEGRATION.md`)
   - Use descriptive names that clearly indicate content
   - Prefer underscores over hyphens for consistency

4. **Include in each document:**
   - Clear title and purpose
   - Table of contents for longer docs
   - Version information and last updated date
   - Prerequisites or dependencies
   - Examples where applicable

---

## 📄 Document Version Information

| Document | Version | Last Updated |
|----------|---------|--------------|
| CI/CD Overview | - | - |
| Deployment Setup Summary | - | - |
| Complete Setup Summary | - | - |
| Kubernetes Deployment | - | - |
| K8s Quick Start | - | - |
| GitHub Actions Setup | - | - |
| Workflows Architecture | - | - |
| SSO Integration | - | - |
| SSO Quick Start | - | - |
| Recurring Events Integration Test | 1.0 | Jan 23, 2026 |

---

**Last Updated:** January 23, 2026  
**Maintained By:** Streamline Scheduler Team
