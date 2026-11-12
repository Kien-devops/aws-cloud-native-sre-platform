# 08.01 — CI Build, DevSecOps Scan & Immutable ECR Push

> **Phạm vi:** Application CI Pipeline (`app3`) | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **DevSecOps Gate:** Mọi Pull Request/Push đều chạy Unit Test (`ci.yml`) và Trivy Container Scan (`security-scan.yml`, fail build nếu phát hiện `HIGH`/`CRITICAL` CVE).
- **Zero Static Secrets:** Pipeline `build-push.yml` xác thực với AWS qua **GitHub OIDC** (`github-actions-sre-platform-deployer`) và đẩy image bất biến kèm SHA256 digest lên ECR.

---

## 2. Đặc tả Workflow & Artifacts (`app3/.github/workflows/`)

| Workflow File | Trigger | Thành phần / Output Chính |
| :--- | :--- | :--- |
| `ci.yml` | PR / Push | Node 22 syntax check, `npm test`, `node --test` cho 5 services |
| `security-scan.yml` | PR / Push | Aqua Security Trivy scan (OS + Node deps), Fail on `HIGH`/`CRITICAL` |
| `build-push.yml` | Push (`dev`, `staging`, `main`) | Matrix build 5 images -> Push ECR (`git-<short-sha>` + `sha256` digest) |

---

## 3. Chiến lược Tagging & Labels (ECR Images)

| Image Tag Format | Ví dụ | Mục đích |
| :--- | :--- | :--- |
| `git-<short-sha>` | `git-c1f2672` | Truy vết chính xác commit mã nguồn trong `app3` |
| `sha256:<digest>` | `sha256:94a48aaa...` | Digest bất biến dùng để pin trong GitOps `kustomization.yaml` |

---

## 4. Tham chiếu IaC / GitOps
- [README.md](../../README.md#2-pipeline-cicd-end-to-end-từ-mã-nguồn-app3-đến-gitops) — Sơ đồ tuần tự CI/CD đầy đủ.
- [01-ecr.md](../03-foundation-services/01-ecr.md) — Đặc tả 5 ECR repositories.

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
- **PASS:** 100% workflows trên `app3` xanh (`ci`, `security-scan`, `build-push`), không dùng `AWS_ACCESS_KEY_ID` tĩnh trong GitHub Secrets.
