# 07. Tương tác giữa các thành phần nền tảng

## Mục tiêu

Làm rõ thành phần nào tạo, sở hữu và tiêu thụ trạng thái. Một Kubernetes object không được Terraform, Helm CLI và Argo CD cùng sửa.

## Ma trận ownership

| Thành phần | Trách nhiệm | Phụ thuộc |
| --- | --- | --- |
| Terraform | VPC, EKS, IAM, ECR, RDS, Redis, SQS, KMS | AWS API, remote state |
| Argo CD | Add-ons và application manifests | Git, Kubernetes API |
| Argo Rollouts | Canary và AnalysisRun | Metrics provider |
| OTel Collector | Xử lý và xuất telemetry | SDK, backend |
| Prometheus | Scrape và evaluate rules | Endpoints, ServiceMonitor |
| Alertmanager | Group, silence và route alert | Prometheus, receiver |
| HPA/KEDA | Điều chỉnh replicas | Metrics API/queue |
| Karpenter | Tạo node capacity | EC2, IAM, NodePool |
| Chaos Mesh | Fault injection | RBAC, target selector |

## Luồng thay đổi

```text
Git commit -> CI checks -> GitOps commit -> Argo CD sync
                                      -> Kubernetes object
                                      -> Controller reconcile
                                      -> Metrics/events -> SRE operator
```

Controller không thay thế approval. Production change cần review, branch protection, policy và rollback path.

## Ví dụ tương tác

KEDA tăng Payment workers khi SQS backlog tăng. Pod mới Pending nếu cluster thiếu capacity; Karpenter tạo node. Khi workers tăng, downstream payment/DB có thể quá tải. Vì vậy scaling policy phải quan sát cả queue age lẫn downstream saturation.

## Verification

```bash
kubectl get applications -A
kubectl get hpa,scaledobject -A
kubectl get events -A --sort-by=.lastTimestamp
```

**Expected:** desired state, sync status và controller ownership nhất quán. Nếu controller chưa cài, ghi Not deployed.

## Troubleshooting

- OutOfSync liên tục: drift thủ công hoặc controller khác cùng sở hữu.
- HPA không scale: metric thiếu, target sai hoặc request chưa đặt.
- KEDA không scale: scaler auth, queue metric hoặc cooldown.
- Alert thiếu owner: labels service, severity và runbook chưa đầy đủ.

## Production considerations

Giới hạn quyền Argo CD theo project/namespace, audit sync, pin chart/image, dùng sync waves và health checks. Kiểm tra prune policy, finalizers và hành vi khi Git hoặc controller unavailable.
