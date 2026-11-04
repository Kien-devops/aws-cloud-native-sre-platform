# 03. Kiến trúc AWS và Amazon EKS

## Các lớp kiến trúc

```text
Route 53 -> WAF/ALB trong public subnets
                       |
                EKS worker private subnets
                       |
           RDS/ElastiCache/VPC endpoints
```

VPC cần public/private subnet theo AZ, route table rõ ràng, security group tối thiểu và egress được kiểm soát. Worker nodes ưu tiên private subnet; AWS Load Balancer Controller tạo ALB từ Ingress theo ownership đã thống nhất.

## Thành phần EKS

- **Control plane:** AWS quản lý; đội dự án quản lý version, endpoint access và logs.
- **Data plane:** managed node groups hoặc nodes do Karpenter tạo.
- **VPC CNI:** cấp địa chỉ Pod; phải tính ENI/IP capacity.
- **CoreDNS, kube-proxy, CSI drivers:** dependency nền tảng cần kiểm tra tương thích.
- **EKS Pod Identity:** gắn IAM role với Kubernetes service account.

## Networking và IAM

GitHub Actions dùng OIDC thay cho access key dài hạn. Pod không dùng node role cho quyền ứng dụng. Security group chỉ mở traffic cần thiết; NetworkPolicy bổ sung kiểm soát east-west. NAT Gateway và telemetry egress phải được tính chi phí.

## Trình tự triển khai dự kiến

1. Bootstrap remote state và Terraform role.
2. Tạo VPC, subnets, routes, endpoints và flow logs.
3. Tạo EKS, node groups, add-ons và Pod Identity Agent.
4. Bootstrap Argo CD; bàn giao add-ons cho GitOps.
5. Kiểm tra topology, IAM và network trước khi deploy ứng dụng.

## Verification

```bash
aws eks describe-cluster --name <cluster-name> --query 'cluster.status'
kubectl get nodes -o wide
kubectl get pods -n kube-system
```

**Expected:** cluster `ACTIVE`, nodes `Ready`, core add-ons healthy. Đây là kết quả minh họa, chưa phải trạng thái hiện tại.

## Troubleshooting

- Node không join: IAM instance profile, subnet route, security group, bootstrap logs.
- Pod Pending: IP/ENI, taints, requests, topology và capacity.
- ALB không tạo: controller logs, subnet tags, IAM và Ingress annotations.
- DNS lỗi: CoreDNS, VPC resolver, network policy và security group.

## Production considerations

Pin Kubernetes/add-on versions được hỗ trợ. Có maintenance window, upgrade/rollback plan, audit logs, quota alarms và cost budget. EKS control plane managed không khiến workload tự chịu được mất node hoặc AZ.

## Tham khảo

- [EKS Best Practices](https://aws.github.io/aws-eks-best-practices/)
- [EKS Pod Identity](https://docs.aws.amazon.com/eks/latest/userguide/pod-identities.html)
