# 08.03 — Pod Autoscaling (HPA & KEDA SQS Scaler)

> **Phạm vi:** Workload Horizontal & Event-Driven Scaling | **Region:** `ap-southeast-1`

---

## 1. Mục tiêu & Nguyên tắc Thiết kế
- **Compute-Driven Scaling (HPA):** `order-service` co giãn theo mức sử dụng CPU/Memory thực tế (`metrics-server`).
- **Event-Driven Scaling (KEDA):** `payment-worker` co giãn theo độ dài hàng đợi Amazon SQS (`queueLength: "5"`), xác thực qua **EKS Pod Identity** (`TriggerAuthentication` -> `aws-eks`).
- **Argo CD `ignoreDifferences`:** Cấu hình Argo CD bỏ qua sai khác trường `spec.replicas` trên Deployment/Rollout do HPA và KEDA điều khiển động.

---

## 2. Đặc tả Tài nguyên Autoscaling

| Kind | Tên Resource | Target Workload | Tham số Cấu hình Cốt lõi |
| :--- | :--- | :--- | :--- |
| **HorizontalPodAutoscaler** | `order-service-hpa` | `order-service` | `minReplicas: 2`, `maxReplicas: 10`, Target CPU: `70%` |
| **TriggerAuthentication** | `keda-aws-credentials` | `payment-worker` | `podIdentity.provider: aws-eks` |
| **ScaledObject (KEDA)** | `payment-worker-scaler` | `payment-worker` | Trigger: `aws-sqs-queue`, `queueLength: "5"`, `minReplicaCount: 2`, `maxReplicaCount: 10`, `pollingInterval: 10s`, `cooldownPeriod: 60s` |

---

## 3. Chiến lược Tagging & Labels

| Label Key | Label Value | Mục đích |
| :--- | :--- | :--- |
| `app.kubernetes.io/part-of` | `reliability-shop` | Định danh bộ scaler của ứng dụng |

---

## 4. Tham chiếu IaC / GitOps
- [hpa.yaml](../../gitops/applications/reliability-shop/base/hpa.yaml)
- [keda-scaledobject.yaml](../../gitops/applications/reliability-shop/base/keda-scaledobject.yaml)

---

## 5. Tiêu chí Nghiệm thu (Verification & SRE Gate)
```bash
kubectl get hpa,scaledobject -n reliability-shop
```
- **PASS:** HPA và KEDA `ScaledObject` hiển thị `READY = True`, `ACTIVE = True`, không bị Argo CD đánh dấu `OutOfSync` khi replicas thay đổi.
