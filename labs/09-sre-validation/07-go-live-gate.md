# 09.07 — Go-Live Acceptance Gate

> **Phạm vi:** Production Readiness Checklist | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Objective Gate Criteria:** Chỉ xác nhận nền tảng sẵn sàng vận hành khi toàn bộ các lớp Security, Network, GitOps, Observability, Resilience và FinOps đều có bằng chứng kiểm chứng đạt chuẩn.

---

## 2. Ma trận Kiểm tra Production Readiness

| Trụ cột | Tiêu chí Cốt lõi | Trạng thái Kiểm chứng |
| :--- | :--- | :--- |
| **Security & IAM** | KMS CMK bật rotation, Zero static secrets, GitHub OIDC, Trivy Scan pass, Private Subnets | Đạt (`PASS`) |
| **Compute & Network** | VPC 3-Tier Multi-AZ, EKS `sre-platform-dev` `ACTIVE`, S3 Gateway Endpoint, Shared ALB 100% healthy | Đạt (`PASS`) |
| **GitOps & Delivery** | Argo CD App-of-Apps `Synced/Healthy`, Canary `AnalysisTemplate` hoạt động, Auto-rollback | Đạt (`PASS`) |
| **Observability** | OTel Collector + Prometheus + Loki + Tempo + Grafana + CloudWatch DLQ Alarms | Đạt (`PASS`) |
| **Resilience & Perf** | k6 `0.00%` 5xx (`P95 134.8ms`), EC2 termination `< 60s`, RPO `2m45s`, RTO `30m15s` | Đạt (`PASS`) |

---

## 3. Chiến lược Tagging & Labels
- Đảm bảo mọi tài nguyên chạy trong phạm vi kiểm soát FinOps Budget (`$50/tháng`).

---

## 4. Tham chiếu IaC / GitOps
- [README.md](../../README.md#3-các-chỉ-số-kỹ-thuật-đo-đạc-thực-tế-hard-metrics)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
- **PASS:** 100% các hạng mục trên có bằng chứng thực tế (ảnh chụp, CLI output đã redact, drill report) lưu trữ đầy đủ trong repo.
