# Labs triển khai AWS Cloud-Native SRE Platform

Chuỗi lab này dựng môi trường `dev` từ đầu đến khi đủ điều kiện go-live, sau đó mới promotion sang `staging` và `prod`. Thực hiện đúng thứ tự; khi một **Gate** chưa đạt, dừng và xử lý trước khi sang bước kế tiếp.

## Luồng triển khai

```text
00 Chuẩn bị -> 01 IAM/Security -> 02 Network -> 03 Foundation Services
-> 04 EKS Platform -> 05 Secrets/Ingress -> 06 GitOps/Application
-> 07 Observability -> 08 Delivery/Scaling -> 09 SRE Validation
-> 10 Handoff/Cleanup
```

| Phase | Đầu ra bắt buộc |
| --- | --- |
| `00-chuan-bi` | Phạm vi, Region, naming, budget và quy tắc evidence |
| `01-iam-security` | IAM/OIDC/KMS/audit guardrail |
| `02-network` | VPC đa AZ, route, endpoint, security group, flow logs |
| `03-foundation-services` | ECR, state backend, SQS/DLQ, RDS và Redis |
| `04-eks-platform` | EKS, node, add-on và Pod Identity khỏe |
| `05-secrets-ingress` | Secrets Manager, ESO, DNS/TLS và ingress prerequisites |
| `06-gitops-application` | Argo CD và ReliabilityShop `Synced/Healthy` |
| `07-observability` | Metrics, logs và traces liên kết được |
| `08-delivery-scaling` | Image bất biến, autoscaling, canary và rollback |
| `09-sre-validation` | SLO baseline, load/resilience evidence và quyết định go-live |
| `10-handoff-cleanup` | Ownership rõ, Terraform reconcile, restore và cost review |

## Quy ước cho mọi lab

- **Console path:** đường dẫn thao tác AWS Console. Tên màn hình có thể đổi nhẹ theo UI.
- **Handoff:** bước chuyển sang Git, CLI, Helm hoặc `kubectl`; không giả định Console quản lý tài nguyên Kubernetes.
- **Expected:** tiêu chí mong đợi, chưa phải kết quả thực tế.
- **Measured:** chỉ ghi khi đã chạy, kèm timestamp, Region, revision và evidence đã che Account ID/ARN/token.
- **Gate:** điều kiện bắt buộc để đi tiếp. Không đánh dấu đạt nếu thiếu bằng chứng.
- **Cleanup:** tài nguyên cần xóa theo thứ tự ngược để tránh phí và lỗi phụ thuộc.

Không lưu secret, access key, kubeconfig, token, full ARN hoặc Account ID vào Git. Các bước tạo, sửa, import hoặc xóa tài nguyên production phải được review và phê duyệt riêng.
