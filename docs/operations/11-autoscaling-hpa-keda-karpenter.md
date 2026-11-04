# Autoscaling: HPA, KEDA và Karpenter

## 1. Vai trò

HPA/KEDA tăng giảm Pod; Karpenter cung cấp node. AWS quota, subnet IP và instance capacity là giới hạn trần.

- HPA: CPU, memory hoặc custom metric.
- KEDA: event như SQS queue, có thể scale về 0.
- Karpenter: provision node cho Pod pending, không thay HPA/KEDA.

## 2. HPA minh họa

~~~yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: order-service
  namespace: reliability-shop
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: order-service
  minReplicas: 3
  maxReplicas: 20
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 65
~~~

## 3. KEDA với SQS

KEDA cần IAM qua Pod Identity/IRSA tối thiểu, queue đúng region/account và metric ApproximateNumberOfMessagesVisible phù hợp throughput worker.

~~~yaml
triggers:
  - type: aws-sqs-queue
    metadata:
      queueURL: https://sqs.ap-southeast-1.amazonaws.com/ACCOUNT/order
      queueLength: "20"
      awsRegion: ap-southeast-1
~~~

KEDA quyết định số Pod; nếu node không đủ, Karpenter provision.

## 4. Guardrail Karpenter

Giới hạn instance family, architecture, AZ, capacity type và tổng CPU. Dùng disruption budget; kiểm tra subnet IP, security group, quota, node Ready, PDB và topology spread.

## 5. Xác minh

1. Tạo queue hoặc tải tăng trong staging.
2. Kiểm tra HPA/KEDA desired replicas và events.
3. Kiểm tra Pod Pending reason, NodeClaim và node Ready.
4. Đo SLI, queue age, scale latency, cost và số lần scale.
5. Giảm tải; xác nhận scale down không gián đoạn.

| Kết quả | Nội dung |
| --- | --- |
| **Expected** | Pod tăng trước khi queue age vượt SLO; node cấp đủ; scale down có stabilization. |
| **Measured** | Chưa đo. Ghi metric threshold, desired/actual replicas, NodeClaim, queue age và chi phí. |

## 6. Troubleshooting và production

- HPA không scale: metrics-server/custom adapter, request hoặc selector.
- KEDA không đọc SQS: IAM, queue URL, region, visibility timeout, activation threshold.
- Pod Pending: taint/toleration, affinity, subnet IP, quota, constraint.
- Scale oscillation: tăng stabilization, chỉnh target, lọc metric nhiễu.
- Image phải immutable; không dùng latest.
