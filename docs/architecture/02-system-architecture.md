# 02. Kiến trúc hệ thống

## Phạm vi

Kiến trúc mục tiêu là ReliabilityShop trên Amazon EKS đa Availability Zone, dùng RDS PostgreSQL, Redis và SQS. Đây là target architecture; các thư mục triển khai hiện chưa cung cấp bằng chứng tài nguyên đang chạy.

## Kiến trúc logic

```text
Client -> Route 53 -> WAF -> ALB TLS
                           -> Ingress/API Gateway
                              -> Auth
                              -> Order -> Inventory
                                       -> PostgreSQL
                                       -> SQS -> Payment Worker
                              -> Redis
```

Observability chạy song song:

```text
Service -> OpenTelemetry -> Prometheus/Loki/Tempo -> Grafana
                                                -> Alertmanager
```

## Ranh giới quản lý

Terraform quản lý AWS resources và bootstrap. Argo CD quản lý Kubernetes desired state sau bootstrap. Application CI kiểm thử, quét, build image bất biến và đề xuất image reference. Một resource chỉ có một nguồn quản lý.

## Request flow

Order request được xác thực, kiểm tra inventory, ghi dữ liệu và gửi payment event. Mỗi bước truyền trace context hoặc correlation ID. Response cho người dùng chỉ được coi là thành công khi điều kiện nghiệp vụ bắt buộc đã hoàn tất.

## Failure scenarios

- Mất worker hoặc một AZ.
- ALB target hoặc Ingress unhealthy.
- RDS connection pool cạn, Redis chậm, SQS backlog.
- Collector mất telemetry.
- Release mới lỗi trong khi node vẫn khỏe.

Mỗi failure domain cần chỉ rõ tác động, tín hiệu phát hiện, mitigation và cách xác minh phục hồi.

## Verification

```bash
kubectl get nodes -L topology.kubernetes.io/zone
kubectl get pods -A -o wide
kubectl get endpointslice -A
```

**Expected:** workload phân bố theo topology policy đã chọn. Cần đối chiếu thêm ALB target health, RDS events, SQS age và request test.

## Troubleshooting

- Request không vào Pod: kiểm tra DNS, ALB listener, target group, Ingress và EndpointSlice.
- Chỉ lỗi ở một AZ: kiểm tra subnet, route, node capacity và topology.
- Service hoạt động nhưng telemetry thiếu: kiểm tra SDK, Collector pipeline và network policy.
- Drift liên tục: tìm controller hoặc thao tác thủ công đang sửa cùng resource.

## Production considerations

Multi-AZ tăng chi phí và không loại bỏ mọi single point of failure. Cần capacity headroom, PDB, topology spread, backup/restore, security groups, quotas và cleanup plan. Multi-Region DR nằm ngoài giai đoạn đầu.

## Tham khảo

- [Amazon EKS](https://docs.aws.amazon.com/eks/latest/userguide/what-is-eks.html)
- [AWS Reliability Pillar](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html)
