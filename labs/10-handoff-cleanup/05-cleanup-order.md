# 10.05 — Reverse Cleanup Order (Zero Dependency Errors)

> **Phạm vi:** Safe Teardown & FinOps | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Strict Reverse Order:** Bắt buộc xóa tài nguyên do Kubernetes controllers tạo động (Ingress/ALB, Karpenter Spot Nodes, PVC/EBS) **TRƯỚC** khi xóa EKS Cluster và VPC; nếu không sẽ gặp lỗi `DependencyViolation` (mắc kẹt ENI, SG, Target Group).

---

## 2. Thứ tự Xóa Ngược Chuẩn (8 Giai đoạn)

| Thứ tự | Tầng Tài nguyên | Hành động Bắt buộc |
| :--- | :--- | :--- |
| **1** | **K8s Ingresses & Workloads** | `kubectl delete ingress --all -A` -> đợi AWS LBC xóa sạch ALB & 5 Target Groups; xóa app namespaces |
| **2** | **Karpenter Spot Nodes** | Xóa `NodePool` `workload-spot` -> đợi EC2 Spot instances terminate hết |
| **3** | **EKS Node Group & Cluster** | Xóa `sre-platform-dev-system-nodes` -> Xóa EKS Cluster `sre-platform-dev` |
| **4** | **Databases & Cache** | Xóa RDS `sre-platform-dev-pg` (`--skip-final-snapshot`) -> Xóa ElastiCache `sre-platform-dev-redis` & Subnet Groups |
| **5** | **Messaging & Secrets** | Xóa 6 SQS Queues/DLQs -> Force delete Secrets (`--force-delete-without-recovery`) |
| **6** | **Network Egress & Endpoints** | Xóa S3 Gateway Endpoint -> Xóa NAT Gateway `nat-1a` -> Release Elastic IP `nat-eip-1a` |
| **7** | **VPC & Security Groups** | Xóa liên kết & Route Tables -> Detach/Xóa IGW -> Xóa 6 Subnets -> Revoke cross-SG rules & Xóa SGs -> Xóa VPC |
| **8** | **KMS & Logs** | Schedule delete KMS CMK (`7 days`) -> Xóa CloudWatch Log Groups |

---

## 3. Chiến lược Tagging & Labels
- Dùng bộ lọc tag `Project = sre-platform` ở bước audit cuối để đảm bảo không sót tài nguyên nào.

---

## 4. Tham chiếu IaC / GitOps
- [10.06 FinOps Cost Audit](06-cost-audit.md)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
- **PASS:** VPC `sre-platform-dev-vpc` xóa sạch hoàn toàn không còn bất kỳ `DependencyViolation` nào.
