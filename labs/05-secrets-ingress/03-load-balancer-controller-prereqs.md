# 05.03 - Điều kiện trước AWS Load Balancer Controller

## Mục tiêu

Chuẩn bị AWS-side prerequisites; controller và Ingress manifest sẽ được cài qua GitOps.

## Input

- EKS healthy, private/public subnet tags, Pod Identity association hoặc IAM method đã chọn.
- Controller version, cluster name, VPC ID, ALB scheme và security policy.

## Console steps

1. Trong **VPC > Subnets**, kiểm tra tag discovery và role public/private đúng thiết kế.
2. Trong **EKS > Add-ons/Access**, xác nhận Pod Identity Agent và role controller đã sẵn sàng.
3. Trong **EC2 > Security Groups**, chuẩn bị SG ingress/egress tối thiểu.
4. Trong **EKS > Cluster**, kiểm tra endpoint/API access cho Argo CD/controller.
5. Ghi rõ controller ownership; không tạo ALB thủ công cho workload Kubernetes.

## Verify

- Subnet tags, route, SG và IAM association khớp cluster/VPC.
- Controller policy chỉ có action cần cho ALB/NLB resources.
- Không có ALB thủ công trùng ownership với Ingress dự kiến.

## Output

- **Expected:** subnet tags, IAM role và security group đủ để controller tạo ALB.
- **Measured Result:** Chưa thực hiện; lưu tag/status và timestamp.

VPC/subnet/SG IDs redacted, controller role purpose, scheme, version và timestamp.

## Gate

Argo CD là owner của controller/Ingress manifests; controller là owner của ALB runtime.

## Cleanup

Xóa SG/role chưa dùng; không xóa subnet tags hoặc role đang được controller dùng.

