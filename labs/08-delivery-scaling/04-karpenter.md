# 08.04 — Karpenter Elastic Spot Node Provisioning

> **Phạm vi:** Node-Level Autoscaling & FinOps Spot | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Two-Tier Compute FinOps:** System add-ons chạy trên `sre-platform-dev-system-nodes` (On-Demand); Application workloads chạy trên **Karpenter Spot Nodes** (tiết kiệm ~60–70% chi phí EC2).
- **Tag-Driven Discovery:** Karpenter tìm Subnets và Security Groups dựa trên tag `karpenter.sh/discovery: sre-platform-dev`.
- **Fast Consolidation:** Tự động gom/xóa node rỗng hoặc dư thừa sau `30s` (`WhenEmptyOrUnderutilized`) với disruption budget `20%`.

---

## 2. Đặc tả Tài nguyên Karpenter (`karpenter.sh/v1`)

| Kind | Tên Resource | Tham số Cấu hình Cốt lõi |
| :--- | :--- | :--- |
| **EC2NodeClass** | `default` | AMI Family: `AL2023`, Role: `sre-platform-dev-node-role`, Subnet Selector: `karpenter.sh/discovery: sre-platform-dev`, SG Selector: `karpenter.sh/discovery: sre-platform-dev` |
| **NodePool** | `workload-spot` | Capacity Type: `["spot", "on-demand"]`, Arch: `amd64`, Category: `["c", "m", "t"]` (Gen > 4), Size: `["large", "xlarge", "2xlarge"]`, Limits: `24 CPU` / `48Gi Memory`, `expireAfter: 720h`, `consolidateAfter: 30s` |

---

## 3. Chiến lược Tagging & Labels

| Tầng | Key | Value | Mục đích |
| :--- | :--- | :--- | :--- |
| **AWS Subnets & SG** | `karpenter.sh/discovery` | `sre-platform-dev` | Selector bắt buộc để Karpenter launch EC2 đúng Private App Subnets & `node-sg` |
| **K8s Node Label** | `workload-tier` | `elastic-spot` | Phân biệt Karpenter nodes với System nodes |

---

## 4. Tham chiếu IaC / GitOps
- [ec2nodeclass.yaml](../../gitops/platform/karpenter/ec2nodeclass.yaml)
- [nodepool-workload-spot.yaml](../../gitops/platform/karpenter/nodepool-workload-spot.yaml)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
kubectl get nodepool,ec2nodeclass
```
- **PASS:** `workload-spot` và `default` ở trạng thái `READY = True`; khi node bị terminate hoặc Pod Pending, Karpenter cấp phát Spot node mới trong `< 60 giây`.
