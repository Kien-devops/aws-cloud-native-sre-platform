# Triển khai nền tảng Amazon EKS

> Thiết kế và tiêu chí kiểm chứng dự kiến. Trạng thái minh họa không xác nhận cluster đã tồn tại.

## Mục tiêu

Xây dựng EKS có mạng nhiều AZ, quyền IAM rõ ràng, node group phù hợp và add-on thiết yếu. Nền tảng phải cung cấp đường đi ổn định từ ALB đến Pod, đồng thời giới hạn quyền quản trị cluster.

## Vấn đề thực tế

Cluster có thể `Active` nhưng ứng dụng vẫn lỗi do subnet sai route, CoreDNS hỏng, security group chặn traffic, node thiếu capacity hoặc Pod Identity chưa cấp quyền. Endpoint public/private cũng quyết định cách CI và quản trị viên kết nối.

## Cơ chế và luồng

```text
Client -> Route 53/ALB -> AWS Load Balancer Controller
       -> Service -> Pod trên node group/Karpenter
       -> RDS/Redis/SQS
Control plane -> VPC CNI, CoreDNS, kube-proxy, IAM/Pod Identity
```

VPC CNI cấp địa chỉ từ subnet; CoreDNS phân giải service; controller theo dõi Ingress và tạo ALB. Add-on phải pin phiên bản tương thích với Kubernetes. Namespace, RBAC, network policy và security group tạo ranh giới giữa platform và ứng dụng.

## Ví dụ ReliabilityShop

Frontend, API Gateway và các service chạy trong namespace ứng dụng; ALB công khai chỉ chuyển tới service khỏe. RDS, ElastiCache và SQS nằm ngoài cluster. Node trải trên ít nhất hai AZ; workload có requests/limits và topology spread.

## Thiết kế triển khai dự kiến

1. Tạo VPC private subnet đa AZ, NAT hoặc VPC endpoint theo nhu cầu.
2. Tạo EKS control plane, endpoint policy và logging.
3. Cài VPC CNI, CoreDNS, kube-proxy, EBS CSI và Load Balancer Controller.
4. Cấu hình Pod Identity hoặc IRSA cho từng controller/service.
5. Tạo node group, taint/label, autoscaling và chính sách cập nhật.
6. Chỉ sau khi nền tảng khỏe mới bootstrap Argo CD và ứng dụng.

## Verification minh họa

```bash
aws eks describe-cluster --name <cluster> --query 'cluster.status'
kubectl get nodes -o wide
kubectl get pods -n kube-system
kubectl get deployment -A
kubectl get ingress -A
```

**Expected (minh họa):** cluster `ACTIVE`; node `Ready` trên AZ dự kiến; add-on sẵn sàng; Ingress có địa chỉ ALB. Đây là tiêu chí kiểm tra, không phải số liệu đã đo.

## Troubleshooting

Kiểm tra theo thứ tự: `kubectl describe node`, Pod events, EndpointSlice, CoreDNS logs, route table, security group và IAM policy. Nếu ALB không tạo, xem log controller và subnet tag. Nếu Pod `Pending`, đối chiếu requests, taint, capacity và topology constraint.

## Lưu ý production

Không dùng node duy nhất cho workload quan trọng. Bật control plane audit logs, mã hóa secrets bằng KMS, hạn chế public endpoint và dùng SSM thay SSH khi phù hợp. Kiểm soát version skew, PodDisruptionBudget, backup dữ liệu và quota. EKS HA control plane không thay thế HA cho ứng dụng hoặc database.

## Nguồn chính thức

- [Amazon EKS Best Practices](https://aws.github.io/aws-eks-best-practices/)
- [EKS User Guide](https://docs.aws.amazon.com/eks/latest/userguide/what-is-eks.html)
- [Kubernetes Concepts](https://kubernetes.io/docs/concepts/)
