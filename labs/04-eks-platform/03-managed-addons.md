# 04.03 — EKS Managed Add-ons

> **Phạm vi:** Core Cluster Networking, Storage & Identity | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **AWS-Managed Lifecycle:** Sử dụng EKS Managed Add-ons thay cho cài thủ công để tự động tương thích phiên bản Kubernetes và vá bảo mật.
- **Pod Identity Native:** Bắt buộc cài `eks-pod-identity-agent` làm DaemonSet trên mọi node để cấp credentials ngắn hạn cho Pods.

---

## 2. Đặc tả 7 Add-ons trên Cluster `sre-platform-dev`

| Add-on Name | Loại | Namespace | Vai trò Kỹ thuật |
| :--- | :--- | :--- | :--- |
| `vpc-cni` | EKS Managed | `kube-system` | Gắn VPC ENI & Private IP trực tiếp cho từng Pod |
| `coredns` | EKS Managed | `kube-system` | Phân giải DNS nội bộ (`*.svc.cluster.local`) & forward VPC Resolver |
| `kube-proxy` | EKS Managed | `kube-system` | Duy trì iptables/IPVS rules cho Kubernetes Services |
| `eks-pod-identity-agent` | EKS Managed | `kube-system` | DaemonSet cấp IAM STS credentials qua Pod Identity |
| `aws-ebs-csi-driver` | EKS Managed | `kube-system` | Cấp phát EBS `gp3` PVC cho Prometheus, Loki, Tempo, Grafana |
| `metrics-server` | EKS Managed / Helm | `kube-system` | Cung cấp CPU/Memory metrics cho HPA (`kubectl top`) |
| `aws-load-balancer-controller` | Helm / GitOps | `kube-system` | Quản lý Shared ALB & TargetGroupBinding từ Ingress |

---

## 3. Chiến lược Tagging & Labels

| Tag Key | Tag Value | Mục đích |
| :--- | :--- | :--- |
| `Project` | `sre-platform` | Tag gắn trên từng EKS Add-on resource |
| `Environment` | `dev` | Phân biệt cấu hình theo môi trường |

---

## 4. Tham chiếu IaC / GitOps
- [03-eks.tf](../../iac/terraform/envs/dev/03-eks.tf) — `bootstrap_self_managed_addons = false`.
- [gitops/platform/](../../gitops/platform/README.md) — Platform add-ons bổ sung điều phối qua Argo CD.

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
aws eks list-addons --cluster-name sre-platform-dev --region ap-southeast-1
```
- **PASS:** Toàn bộ add-ons ở trạng thái `ACTIVE`, `kubectl get pods -n kube-system` 100% `Running`.
