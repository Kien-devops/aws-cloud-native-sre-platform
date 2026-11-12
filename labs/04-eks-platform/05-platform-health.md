# 04.05 — Platform Health Baseline

> **Phạm vi:** Cluster Readiness Gate | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Pre-GitOps Verification:** Đảm bảo tầng Control Plane, Nodes, DNS, Metrics Server và EBS Storage hoạt động ổn định 100% trước khi bootstrap Argo CD và ứng dụng.

---

## 2. Bảng Kiểm tra Hạ tầng Baseline

| Thành phần | Trạng thái Mong đợi | Ngưỡng Đạt |
| :--- | :--- | :--- |
| **EKS Control Plane** | `ACTIVE` | API Server phản hồi `< 200ms` |
| **System Nodes** | `Ready` | Tối thiểu `2` nodes trên 2 AZ (`1a`, `1b`) |
| **CoreDNS & VPC CNI** | `Running (1/1)` | `0` restart liên tục, phân giải DNS VPC thành công |
| **StorageClass (`gp3`)** | `Default` | Provision được PVC động cho StatefulSets |

---

## 3. Chiến lược Tagging & Labels

| Label / Tag | Giá trị | Mục đích |
| :--- | :--- | :--- |
| `topology.kubernetes.io/zone` | `ap-southeast-1a` \| `ap-southeast-1b` | Xác nhận Multi-AZ node distribution |

---

## 4. Tham chiếu IaC / GitOps
- [03-eks.tf](../../iac/terraform/envs/dev/03-eks.tf)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
kubectl get nodes -o wide
kubectl get pods -n kube-system
kubectl top nodes
```
- **PASS:** Tất cả nodes `Ready`, không có Pod ở trạng thái `Pending` hoặc `CrashLoopBackOff`, `kubectl top nodes` trả về metrics hợp lệ.
