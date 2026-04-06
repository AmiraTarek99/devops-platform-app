# 🚀 DevOps Production Platform — Task Manager

A production-grade 3-tier Task Manager application deployed on **AWS EKS** using a fully automated **Jenkins CI/CD pipeline**, **Terraform** infrastructure as code, **Helm** chart deployments, and **Prometheus/Grafana** monitoring.

> This project demonstrates a real-world DevOps workflow — from a developer pushing code on their laptop to a live, auto-scaling application running on Kubernetes in AWS.

---

## 📋 Table of Contents

- [Application Overview](#application-overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [CI/CD Pipeline](#cicd-pipeline)
- [How Pipelines Connect](#how-pipelines-connect)
- [Kubernetes and Helm](#kubernetes-and-helm)
- [Local Development](#local-development)

---

## Application Overview

A full-stack Task Manager application built across 3 tiers:

```
TIER 1 — Frontend
  React application served by Nginx
  Users can create, update, delete, and filter tasks
  Shows real-time stats (total, pending, in progress, done)
  Calls backend API for all data operations

TIER 2 — Backend
  Flask REST API served by Gunicorn (4 workers)
  Endpoints: GET/POST/PUT/DELETE /api/tasks
  Stats endpoint: GET /api/stats
  Health endpoints: /api/health and /api/ready
  Connects to PostgreSQL database

TIER 3 — Database
  PostgreSQL on AWS RDS in production
  PostgreSQL Docker container in local development
  Schema and seed data in database/init.sql
```

---

## Architecture

```
Developer pushes code to GitHub
            │
            │  GitHub webhook
            ▼
┌──────────────────────────────────────────────────┐
│            Jenkins CI Pipeline                    │
│                                                   │
│  Test Backend  →  Test Frontend                   │
│       │                │                          │
│       └───────┬────────┘                          │
│               │                                   │
│          Build Docker Images                      │
│          (backend + frontend)                     │
│               │                                   │
│          Push to AWS ECR                          │
│               │                                   │
│          Trigger Deploy Pipeline                  │
└───────────────┼──────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────┐
│           Jenkins Deploy Pipeline                 │
│                                                   │
│  Read config from SSM Parameter Store             │
│       │                                           │
│  Configure kubectl → EKS                          │
│       │                                           │
│  Helm Deploy → DEV namespace                      │
│       │                                           │
│  Smoke Test DEV                                   │
│       │                                           │
│  ⛔ Manual Approval Gate                          │
│       │                                           │
│  Helm Deploy → PRODUCTION namespace               │
│       │                                           │
│  Verify Production                                │
└───────────────┼──────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────┐
│               AWS Infrastructure                  │
│          (provisioned by separate                 │
│           infra pipeline + Terraform)             │
│                                                   │
│  VPC  │  EKS  │  ECR  │  RDS  │  S3  │  SSM     │
└──────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Tool | Purpose |
|---|---|---|
| Frontend | React 18 + Nginx | User interface served as static files |
| Backend | Flask 3 + Gunicorn | REST API with 4 worker processes |
| Database (local) | PostgreSQL Docker | Development database |
| Database (prod) | AWS RDS PostgreSQL | Managed production database |
| Containers | Docker | Package app into portable images |
| Registry | AWS ECR | Private Docker image storage |
| Orchestration | AWS EKS (Kubernetes) | Run and manage containers in production |
| Packaging | Helm | Deploy to Kubernetes with environment-specific config |
| CI/CD | Jenkins | Automate test → build → deploy |
| Infrastructure | Terraform | Create all AWS resources as code |
| Config Store | AWS SSM Parameter Store | Share infrastructure outputs between pipelines |
| Monitoring | Prometheus + Grafana | Metrics collection and dashboards |

---

## Repository Structure

```
devops-platform-app/                    ← THIS REPO (application code)
│
├── backend/                            ← Flask REST API
│   ├── app.py                          main application with all endpoints
│   ├── test_app.py                     pytest unit tests (mocked DB)
│   ├── requirements.txt                Python dependencies
│   ├── Dockerfile                      multi-stage production build
│   └── .dockerignore
│
├── frontend/                           ← React application
│   ├── src/
│   │   ├── App.jsx                     main React component
│   │   └── index.js                    React entry point
│   ├── public/
│   │   └── index.html
│   ├── package.json
│   ├── Dockerfile                      multi-stage: Node build → Nginx serve
│   ├── nginx.conf                      Nginx config with /api proxy
│   └── .dockerignore
│
├── database/
│   └── init.sql                        creates tables and seeds data
│                                       runs automatically on first PostgreSQL start
│
├── helm/                               ← Kubernetes deployment charts
│   ├── backend/
│   │   ├── Chart.yaml
│   │   ├── values.yaml                 production defaults (2 replicas, HPA on)
│   │   ├── values-dev.yaml             dev overrides (1 replica, HPA off)
│   │   └── templates/
│   │       ├── deployment.yaml         Kubernetes Deployment + probes
│   │       └── service-hpa.yaml        Kubernetes Service + HPA
│   └── frontend/
│       ├── Chart.yaml
│       ├── values.yaml
│       ├── values-dev.yaml
│       └── templates/
│           └── deployment.yaml         Deployment + Service + HPA
│
├── jenkins/
│   ├── ci/
│   │   └── Jenkinsfile                 CI pipeline (test + build + push)
│   └── deploy/
│       └── Jenkinsfile                 Deploy pipeline (helm to EKS)
│
├── monitoring/
│   └── prometheus-values.yaml          Prometheus + Grafana Helm values
│
├── docker-compose.yml                  local development (all 3 tiers)
├── .gitignore
└── README.md                           this file
```

> **Infrastructure code** (Terraform, bootstrap, infra pipeline) lives in a **separate repository**: `devops-platform-infra`. Separating them means a code push never accidentally triggers infrastructure changes.

---


### Pipeline 1 — CI (Continuous Integration)

**File:** `jenkins/ci/Jenkinsfile`

**Triggered by:** GitHub webhook on every push to `main` branch

**Runs on:** Jenkins container (Terraform, AWS CLI, kubectl installed)
**Tests run on:** Docker agents — `python:3.11-slim` for backend, `node:20-alpine` for frontend

```
STAGE 1 — Checkout
  Clones latest code from GitHub

STAGE 2 — Load Config
  Reads ECR URLs and EKS cluster name from AWS SSM Parameter Store
  These were saved there by Terraform when infrastructure was created
  No hardcoding — single source of truth

STAGE 3 — Test Backend
  Runs inside python:3.11-slim Docker container
  flake8 → checks code style and formatting
  pytest → runs unit tests with mocked database
  If any test fails → pipeline stops → nothing gets built or pushed

STAGE 4 — Test Frontend
  Runs inside node:20-alpine Docker container
  npm test → runs React component tests

STAGE 5 — Build Docker Images
  docker build backend → tagged with git commit SHA (e.g. abc1234)
  docker build frontend → tagged with git commit SHA
  Two tags per image: :abc1234 (specific) and :latest (newest)

STAGE 6 — Push to ECR
  Authenticates with ECR using Jenkins IAM role (no passwords stored)
  Pushes both images with both tags

STAGE 7 — Trigger Deploy Pipeline
  Saves image tag to file
  Calls devops-platform-deploy pipeline with IMAGE_TAG parameter
  wait: false — CI completes immediately without waiting for deploy
```

**Image Tagging Strategy:**

Every image is tagged with the first 7 characters of the git commit SHA. This means you can always trace any running container back to the exact commit that produced it.

```
git commit: abc1234def567890
image tag:  abc1234

Running in production? Check pod → see tag abc1234 → find commit in GitHub
```

### Pipeline 2 — Deploy

**File:** `jenkins/deploy/Jenkinsfile`

**Triggered by:** CI pipeline automatically after all tests and image push succeed. Can also be triggered manually for hotfixes or rollbacks.

**Parameters:**
- `IMAGE_TAG` — which image version to deploy (passed from CI)
- `DEPLOY_ENV` — `both` / `dev-only` / `production-only`
- `ROLLBACK` — check to rollback production to previous version

```
STAGE 1 — Checkout
  Clones latest code (Helm charts are here)

STAGE 2 — Load Config
  Reads ECR URLs, EKS cluster name, RDS endpoint from SSM
  Same SSM parameters that CI pipeline reads

STAGE 3 — Validate Image
  Confirms the image tag exists in ECR before deploying
  Prevents deploying a tag that was never built

STAGE 4 — Configure kubectl
  aws eks update-kubeconfig → connects Jenkins to EKS cluster
  kubectl get nodes → confirms cluster is reachable

STAGE 5 — Setup Namespaces
  Creates dev, production, monitoring namespaces if not exist
  --dry-run=client -o yaml | kubectl apply  → idempotent (safe to run many times)

STAGE 6 — Create Secrets
  Creates Kubernetes Secret with DB password and RDS endpoint
  Pods read these as environment variables — password never in code

STAGE 7 — Deploy to DEV
  helm upgrade --install backend-dev ./helm/backend
    --values values.yaml         (production defaults)
    --values values-dev.yaml     (dev overrides: 1 replica, no HPA)
    --set image.tag=abc1234      (exact image from this CI build)
    --atomic                     (auto-rollback if pods fail to start)
    --wait                       (wait until pods are Running)

STAGE 8 — Smoke Test DEV
  kubectl rollout status → confirms pods deployed successfully
  curl /api/health via port-forward → confirms app is responding
  If smoke tests fail → production deployment is blocked

STAGE 9 — Manual Approval Gate ⛔
  Pipeline pauses — shows button in Jenkins UI
  DevOps engineer reviews DEV environment
  Clicks Approve → production deployment proceeds
  Clicks Abort → production deployment cancelled
  Timeout: 30 minutes — auto-aborts if nobody responds

STAGE 10 — Deploy to PRODUCTION
  Same helm command but without values-dev.yaml
  Gets production config: 2 replicas minimum, HPA enabled (scales 2-10)
  --atomic ensures rollback if any pod fails

STAGE 11 — Verify Production
  kubectl get pods, svc, hpa -n production
  kubectl rollout status → confirms healthy deployment
  helm list → shows all releases and versions
```

---

### How Pipelines Connect

```
1. Developer pushes to GitHub
        │
        │ webhook
        ▼
2. CI Pipeline starts automatically
        │
        ├── tests pass ✅
        ├── images built ✅
        ├── images pushed to ECR ✅
        │
        └── triggers Deploy Pipeline
              passing IMAGE_TAG=abc1234
        │
        ▼
3. Deploy Pipeline starts
        │
        ├── reads config from SSM
        ├── deploys to DEV ✅
        ├── smoke tests pass ✅
        ├── ⛔ waits for human approval
        │
        └── human clicks approve
        │
        ▼
4. Production deployment
        │
        └── helm deploy → production namespace ✅
              2 pods running, HPA watching CPU
              RDS connected, Secrets injected
```

## Kubernetes and Helm

### What Kubernetes Does in This Project

```
Kubernetes manages:
  ✅ Auto-restart crashed containers (liveness probe)
  ✅ Remove unhealthy pods from load balancer (readiness probe)
  ✅ Scale pods 2 → 10 when CPU is high (HPA)
  ✅ Zero-downtime deployments (rolling update strategy)
  ✅ Spread pods across nodes (pod anti-affinity)
  ✅ Secure secret injection (Kubernetes Secrets)
```

### Namespaces

```
dev          → 1 replica each, no HPA, lower resources
production   → 2 replicas minimum, HPA enabled, full resources
monitoring   → Prometheus + Grafana
```

### Helm Values — Dev vs Production

```
helm/backend/values.yaml      (production)
  replicaCount: 2
  autoscaling.enabled: true
  autoscaling.maxReplicas: 10
  resources.requests.cpu: 200m

helm/backend/values-dev.yaml  (dev overrides)
  replicaCount: 1              saves cost
  autoscaling.enabled: false   not needed in dev
  resources.requests.cpu: 100m less resources
```

Jenkins passes both files for dev, only `values.yaml` for production.

### Rollback

Helm keeps history of every deployment. Rolling back takes seconds:

```bash
# See deployment history
helm history backend -n production

# Rollback to previous version
helm rollback backend 0 -n production

# Or check ROLLBACK in deploy pipeline parameters
```

---

## Local Development

### Prerequisites

- Docker
- Docker Compose

### Start All 3 Tiers

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/devops-platform-app.git
cd devops-platform-app

# Start everything
docker-compose up --build
```

```
Frontend:  http://localhost:3000
Backend:   http://localhost:5000
Database:  localhost:5432
```

### Test the API Directly

```bash
# Health check
curl http://localhost:5000/api/health

# Get all tasks
curl http://localhost:5000/api/tasks

# Create a task
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "My task", "priority": "high"}'

# Update task status
curl -X PUT http://localhost:5000/api/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{"status": "done"}'

# Get stats
curl http://localhost:5000/api/stats
```

### Stop

```bash
docker-compose down        # stop containers, keep data
docker-compose down -v     # stop containers, delete database data
```

---

## Monitoring

Install Prometheus and Grafana on the cluster:

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm upgrade --install monitoring \
  prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --values monitoring/prometheus-values.yaml
```

Access Grafana:

```bash
kubectl port-forward svc/monitoring-grafana 3000:80 -n monitoring
```

Open `http://localhost:3000` → Username: `admin` → Password: `DevOpsAdmin123`

Import dashboard ID `315` for Kubernetes cluster overview.

---

## Related Repository

Infrastructure code (Terraform + Jenkins infra pipeline):
```
https://github.com/YOUR_USERNAME/devops-platform-infra
```