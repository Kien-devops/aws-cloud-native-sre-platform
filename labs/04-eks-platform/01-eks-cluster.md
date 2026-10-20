# 04.01 - EKS control plane

## Mục tiêu

Tạo cluster EKS trong VPC nhiều AZ với endpoint access, logging và encryption được xác định.

## Input

- VPC/private subnets, cluster IAM role, Kubernetes version, cluster name.
- Endpoint public/private policy, KMS key, control-plane log types và tags.

## Console steps

1. Mở **Amazon EKS > Clusters > Add cluster > Create**.
2. Chọn version được hỗ trợ, cluster service role và bật control-plane logging cần thiết.
3. Chọn VPC, private subnets và security groups; cấu hình endpoint access hạn chế.
4. Bật secrets encryption bằng KMS nếu policy yêu cầu; đặt tags môi trường/owner.
5. Tạo cluster và chờ trạng thái **Active**.

## Verify

- Cluster `Active`, đúng version/Region/VPC/subnets.
- Endpoint access không vượt phạm vi quản trị; log groups xuất hiện nếu đã bật.
- Chưa tạo node group nếu chưa kiểm tra IAM/network.

## Output

- **Expected:** cluster Active, endpoint/logging/encryption đúng cấu hình.
- **Measured Result:** Chưa thực hiện; lưu ARN đã redact và timestamp.

Cluster ARN/name, endpoint access mode, version, VPC/subnets, KMS key, log groups và timestamp.

## Gate

Role quản trị được cấp qua Access Entry/role đã phê duyệt và cluster truy cập được từ mạng quản trị hợp lệ.

## Cleanup

Không xóa cluster nếu còn node group, load balancer hoặc workload. Lập dependency inventory trước teardown.

