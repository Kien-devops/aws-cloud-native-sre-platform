# 04.04 - EKS Pod Identity

## Mục tiêu

Chuẩn bị quyền AWS tối thiểu cho ServiceAccount mà không nhúng access key vào Pod.

## Input

- Cluster và namespace/service account name.
- IAM role trust cho EKS Pod Identity, policy giới hạn action/resource/Region.
- Workload cần SQS, Secrets Manager, ECR hoặc CloudWatch API nào.

## Console steps

1. Trong **EKS > Add-ons**, cài **Amazon EKS Pod Identity Agent** theo version tương thích.
2. Mở phần **Access/Pod identities** của cluster, chọn **Create pod identity association**.
3. Chọn namespace, ServiceAccount và IAM role đã review; không dùng role admin.
4. Lặp lại theo workload, mỗi association có mục đích riêng.
5. Ghi association ID/role ARN đã che account ID.

## Verify

- Agent healthy trên node; association đúng cluster/namespace/ServiceAccount.
- Policy có test Allow/Deny rõ ràng; CloudTrail là evidence khi workload chạy.
- Không lưu credential/token trong evidence hoặc manifest.

## Output

- **Expected:** association đúng namespace/service account, Pod nhận đúng quyền tối thiểu.
- **Measured Result:** Chưa thực hiện; không in credential.

Association ID, namespace, ServiceAccount, role purpose, policy scope, Region và timestamp.

## Gate

Role không dùng quyền node/admin, resource ARN cụ thể và có rollback association.

## Cleanup

Xóa association không còn workload; thu hồi role/policy sau khi kiểm tra CloudTrail và dependency.

