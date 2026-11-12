# 03.06 — Backup, Snapshot & Disaster Recovery (RPO / RTO)

> **Phạm vi:** Data Durability & DR Validation | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Defined RPO & RTO Targets:** Đảm bảo mục tiêu **RPO < 5 phút** (Point-in-Time Recovery qua WAL logs) và **RTO < 35 phút** khi phục hồi DB instance từ snapshot.
- **Encrypted Snapshots:** Mọi automated backup và manual snapshot thừa hưởng mã hóa KMS từ `alias/sre-platform-dev-main`.

---

## 2. Đặc tả Chính sách Backup & DR

| Dịch vụ | Tên / Định danh | Tham số Cấu hình Cốt lõi |
| :--- | :--- | :--- |
| **RDS Automated Backup** | `sre-platform-dev-pg` | Retention: `7 days` (Prod) / `1-7 days` (Dev), Backup Window: `03:00–04:00 UTC` |
| **Point-in-Time Recovery** | Transaction Logs (WAL) | Phục hồi tới bất kỳ giây nào trong khung retention (`RPO = 2m45s` đã kiểm chứng) |
| **Manual DR Snapshot** | `sre-platform-dev-pg-dr-test` | Dùng khi diễn tập restore sang instance mới (`sre-platform-dev-pg-restored`) |
| **S3 Terraform State** | `sre-platform-terraform-state-*-apse1` | Versioning: `Enabled`, SSE-KMS: `Enabled` |

---

## 3. Chiến lược Tagging & Labels

| Tag Key | Tag Value | Mục đích |
| :--- | :--- | :--- |
| `Project` | `sre-platform` | Định danh bản sao lưu |
| `Environment` | `dev` | Quản lý vòng đời snapshot |
| `Purpose` | `dr-drill` \| `automated-backup` | Phân biệt snapshot diễn tập để dọn dẹp sau test |

---

## 4. Tham chiếu IaC / GitOps
- [04-database.tf](../../iac/terraform/envs/dev/04-database.tf)
- Kiểm chứng khôi phục chi tiết: [10.04 Rebuild & Restore](../10-handoff-cleanup/04-rebuild-restore.md)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
aws rds describe-db-snapshots --db-instance-identifier sre-platform-dev-pg --region ap-southeast-1 --query "DBSnapshots[].{Id:DBSnapshotIdentifier,Status:Status,Encrypted:Encrypted}"
```
- **PASS:** Automated backup bật, snapshot ở trạng thái `available` và `Encrypted = true`.
