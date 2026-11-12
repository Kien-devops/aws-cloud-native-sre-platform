# 10.03 — IaC vs GitOps Ownership Matrix

> **Phạm vi:** Separation of Responsibilities | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Clear Boundary (No Overlapping Control):** Phân định rạch ròi tài nguyên nào thuộc quyền quản lý của **Terraform** (`iac/`), tài nguyên nào thuộc **Argo CD** (`gitops/`), và tài nguyên nào thuộc **Kubernetes Controllers** (LBC, Karpenter, ESO).

---

## 2. Ma trận Quyền Sở hữu (Ownership Matrix)

| Công cụ / Controller | Tài nguyên Quản lý Trực tiếp | Source of Truth |
| :--- | :--- | :--- |
| **Terraform (`iac/`)** | VPC, Subnets, IGW, NAT, S3 Gateway, KMS CMK, EKS Cluster, System Node Group, RDS, ElastiCache, SQS/DLQ | `iac/terraform/envs/dev/*.tf` |
| **Argo CD (`gitops/`)** | Namespaces, Deployments, Rollouts, Services, Ingress specs, ExternalSecrets, ScaledObjects, NodePool, Monitoring | `gitops/` |
| **AWS LBC (In-Cluster)** | AWS ALB & Target Groups (tạo động từ K8s `Ingress`) | K8s `Ingress` (`group.name: sre-platform`) |
| **Karpenter (In-Cluster)** | EC2 Spot Worker Nodes (tạo động khi có Pod Pending) | `EC2NodeClass` & `NodePool` |
| **ESO (In-Cluster)** | K8s `Secret` (`app-credentials`, `grafana-admin-secret`) | AWS Secrets Manager |

---

## 3. Chiến lược Tagging & Labels
- Terraform dùng `ManagedBy = Console-to-IaC` / `Terraform`; Argo CD dùng `app.kubernetes.io/instance`; AWS LBC dùng `elbv2.k8s.aws/cluster`.

---

## 4. Tham chiếu IaC / GitOps
- [iac/README.md](../../iac/README.md)
- [gitops/README.md](../../gitops/README.md)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
- **PASS:** Không có tài nguyên nào bị cả Terraform và Argo CD cùng tranh quyền sửa đổi (zero state fight).
