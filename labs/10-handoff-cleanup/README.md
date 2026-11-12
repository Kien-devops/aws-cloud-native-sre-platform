# Module 10 — Handoff, Drift Reconciliation & FinOps Cleanup

> **Phạm vi:** Resource Inventory, GitOps Governance, DR Rebuild & Reverse Teardown ($0.00) | **Region:** `ap-southeast-1`

Module 10 đặc tả danh mục tài nguyên hoàn chỉnh của toàn nền tảng, cơ chế chống trôi cấu hình (Anti-Drift), quy trình tái tạo hạ tầng và thứ tự xóa ngược đảm bảo chi phí `$0.00/ngày` khi kết thúc môi trường lab.

---

## Danh sách Đặc tả

| Mã | Tài liệu | Nội dung Chính |
| :--- | :--- | :--- |
| `10.01` | [Resource Inventory](01-resource-inventory.md) | Danh mục đầy đủ toàn bộ tài nguyên AWS & Kubernetes đã triển khai |
| `10.02` | [GitOps Drift Reconciliation](02-gitops-drift-reconciliation.md) | Cơ chế Argo CD `selfHeal: true` (10s) & `ignoreDifferences` |
| `10.03` | [GitOps Ownership Matrix](03-gitops-ownership.md) | Ranh giới quản lý giữa Terraform (`iac/`) và Argo CD (`gitops/`) |
| `10.04` | [Rebuild & DR Restore](04-rebuild-restore.md) | Tái dựng hạ tầng từ `iac/` + `gitops/` và khôi phục RDS Snapshot |
| `10.05` | [Reverse Cleanup Order](05-cleanup-order.md) | Thứ tự xóa ngược không dính `DependencyViolation` |
| `10.06` | [FinOps Cost Audit ($0.00)](06-cost-audit.md) | Quét tài nguyên mồ côi (Orphan EIP, EBS, ALB, NAT, RDS, EKS) |
