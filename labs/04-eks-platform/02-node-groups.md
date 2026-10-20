# 04.02 - Managed node groups

## Mục tiêu

Tạo managed node groups private, trải nhiều AZ, có instance profile, scaling và labels/taints phù hợp.

## Input

- Cluster `Active`, node IAM role, private subnets nhiều AZ.
- Instance type, AMI type, desired/min/max, disk, labels, taints và update strategy.

## Console steps

1. Vào **EKS > Clusters > <cluster> > Compute > Add node group**.
2. Chọn node IAM role, subnets private và instance type có capacity phù hợp.
3. Đặt desired/min/max, disk size, labels/taints và update configuration.
4. Bật remote access chỉ khi có lý do; ưu tiên SSM và không mở SSH rộng.
5. Tạo node group, chờ **Active** rồi ghi ASG/node group metadata.

## Verify

- Node group `Active`; node ở tối thiểu hai AZ, `Ready` sau khi cluster access được cấu hình.
- IAM role, SG, subnet và scaling limits đúng; không có public IP ngoài thiết kế.
- Requests/limits và topology spread sẽ được kiểm tra ở GitOps stage.

## Output

- **Expected:** nodes Ready, phân bố AZ đúng, requests/limits và labels được áp dụng.
- **Measured Result:** Chưa thực hiện; lưu node summary, không ghi credential.

Node group name, ASG, instance type, desired/min/max, AZs, IAM role, labels/taints và timestamp.

## Gate

Còn capacity cho system pods, rolling update và mất một node; không dùng node group duy nhất cho workload quan trọng.

## Cleanup

Scale về mức lab trước khi dừng; xóa node group chỉ sau khi drain/workload migration được phê duyệt.

