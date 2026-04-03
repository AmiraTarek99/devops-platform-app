# Task Manager — DevOps Production Platform

A production-grade 3-tier Task Manager application deployed on AWS EKS
using a full Jenkins CI/CD pipeline, Terraform infrastructure as code,
Helm chart deployments, and Prometheus/Grafana monitoring.

## Architecture

```
GitHub push → Jenkins CI Pipeline
                 ├── pytest + flake8
                 ├── npm test
                 ├── docker build (backend + frontend)
                 ├── docker push → AWS ECR
                 └── trigger Deploy Pipeline
                          ├── helm deploy → DEV namespace
                          ├── smoke test DEV
                          ├── manual approval
                          └── helm deploy → PRODUCTION namespace
```

## Tech Stack

| Layer       | Tool                    |
|-------------|-------------------------|
| Frontend    | React + Nginx           |
| Backend     | Flask + Gunicorn        |
| Database    | PostgreSQL (AWS RDS)    |
| Containers  | Docker + AWS ECR        |
| Orchestration | AWS EKS (Kubernetes)  |
| Packaging   | Helm                    |
| CI/CD       | Jenkins                 |
| Monitoring  | Prometheus + Grafana    |

## Local Development

```bash
# Start all 3 tiers
docker-compose up --build

# Frontend: http://localhost:3000
# Backend:  http://localhost:5000
# DB:       localhost:5432
```

## Pipelines

- `jenkins/ci/Jenkinsfile`     → test + build + push to ECR
- `jenkins/deploy/Jenkinsfile` → helm deploy to EKS
