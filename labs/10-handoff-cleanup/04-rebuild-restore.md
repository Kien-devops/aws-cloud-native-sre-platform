# 10.04 — Infrastructure Rebuild & Disaster Recovery Restore

> **Phạm vi:** Reproducibility & DR Recovery | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **100% Reproducible Platform:** Toàn bộ nền tảng có thể hủy về `$0.00` và dựng lại nguyên trạng từ zero chỉ với Terraform (`iac/`) + Argo CD Root App (`gitops/`).
- **Verified RPO/RTO:** Quy trình khôi phục RDS từ Snapshot đã kiểm chứng đạt **RTO = 30m15s** (`< 35m`) và **RPO = 2m45s** (`< 5m`).

---

## 2. Quy trình Tái dựng Chuẩn (4 Bước)

| Bước | Công cụ / Nguồn | Hành động |
| :--- | :--- | :--- |
| **1. Provision Cloud Foundation** | `iac/terraform/envs/dev/` | `terraform init && terraform apply` (tạo VPC, KMS, EKS, RDS, Redis, SQS) |
| **2. Bootstrap GitOps** | `kubectl` + `gitops/bootstrap/` | Cài Argo CD v2.11.3 và áp dụng `root-application.yaml` |
| **3. Verify Secret & Ingress** | ESO + AWS LBC | Xác nhận `ExternalSecret` sync và Shared ALB cấp DNS mới |
| **4. DR Data Restore (nếu cần)** | RDS Snapshot / PITR | Restore RDS từ snapshot mới nhất -> cập nhật endpoint vào `app-config` |

---

## 3. Chiến lược Tagging & Labels
- Instance khôi phục gắn tag `Purpose = dr-restore` để phân biệt trong quá trình chuyển đổi endpoint.

---

## 4. Tham chiếu IaC / GitOps
- [iac/terraform/envs/dev/backend.tf.example](../../iac/terraform/envs/dev/backend.tf.example)
- [root-application.yaml](../../gitops/bootstrap/root-application.yaml)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
- **PASS:** Toàn bộ hệ thống dựng lại từ đầu đạt trạng thái `Synced / Healthy` và trả về `HTTP 200` trên Shared ALB không cần cấu hình tay rời rạc.
