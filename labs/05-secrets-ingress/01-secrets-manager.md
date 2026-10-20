# 05.01 - AWS Secrets Manager

## Mục tiêu

Tạo secret runtime mã hóa, phân quyền tối thiểu và sẵn sàng cho External Secrets Operator.

## Input

- Tên secret theo môi trường, KMS key, owner, rotation interval và rollback window.
- JSON schema không chứa secret trong tài liệu; IAM role Pod Identity của ESO.

## Console steps

1. Mở **AWS Secrets Manager > Store a new secret**.
2. Chọn loại secret phù hợp, nhập giá trị thật trực tiếp trong Console; không chụp hoặc copy plaintext vào Git.
3. Đặt tên/path theo môi trường, chọn KMS key và tags owner/expiry.
4. Cấu hình rotation chỉ khi có engine/Lambda tương thích và runbook rollback.
5. Ghi ARN đã redacted, version stage và metadata; không ghi value.

## Verify

- Secret tồn tại đúng Region/KMS; resource policy không public.
- IAM role chỉ `GetSecretValue/DescribeSecret` trên ARN cần thiết.
- Rotation/refresh plan có owner, alert và thời gian rollback.

## Output

- **Expected:** secret metadata, KMS và rotation policy đúng; value không xuất hiện trong evidence.
- **Measured Result:** Chưa thực hiện; chỉ ghi ARN/name đã redact.

Secret ARN redacted, name, KMS key ID redacted, rotation status, owner, TTL và timestamp.

## Gate

Không có plaintext trong evidence, image, Git, log hoặc Terraform output; ESO là consumer duy nhất trong Kubernetes.

## Cleanup

Disable/delete theo recovery window sau khi workload ngừng; kiểm tra versions và CloudTrail trước khi xóa.

