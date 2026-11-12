# Module 08 — CI/CD Pipeline, Autoscaling & Progressive Delivery

> **Phạm vi:** GitHub Actions OIDC, GitOps Promotion, HPA/KEDA, Karpenter Spot & Argo Rollouts | **Region:** `ap-southeast-1`

Module 08 đặc tả luồng CI/CD end-to-end từ monorepo `app3` sang repo GitOps này, cơ chế co giãn 3 lớp (HPA, KEDA, Karpenter) và triển khai Canary tự động rollback với Argo Rollouts.

---

## Danh sách Đặc tả

| Mã | Tài liệu | Nội dung Chính |
| :--- | :--- | :--- |
| `08.01` | [CI Build, Trivy Scan & ECR](01-ci-build-scan-ecr.md) | `ci.yml`, `security-scan.yml` (Trivy), `build-push.yml` (OIDC -> ECR Digest) |
| `08.02` | [GitOps Automated Promotion](02-gitops-promotion.md) | `update-gitops.yml` -> PR cập nhật image digest vào `kustomization.yaml` |
| `08.03` | [HPA & KEDA Autoscaling](03-hpa-keda.md) | HPA (`order-service`) & KEDA `ScaledObject` (`payment-worker` theo SQS depth) |
| `08.04` | [Karpenter Spot Compute](04-karpenter.md) | `EC2NodeClass` (`default`), `NodePool` (`workload-spot`), Discovery Tags |
| `08.05` | [Argo Rollouts Canary](05-argo-rollouts-canary.md) | Canary traffic split (`20% -> 50% -> 100%`) & Prometheus `AnalysisTemplate` |
| `08.06` | [Automated & Git Rollback](06-rollback.md) | Auto-abort khi 5xx > 1% hoặc P95 > 500ms & Rollback qua `git revert` |
