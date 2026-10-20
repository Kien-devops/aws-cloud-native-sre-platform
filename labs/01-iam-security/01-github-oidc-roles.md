# 01.01 — GitHub OIDC và IAM roles

> Trạng thái: Hướng dẫn Console-first; tùy chọn nếu chỉ học thủ công trên Console.

## Input

- GitHub organization/repository và branch hoặc environment được phép.
- Region/account mục tiêu và danh sách AWS actions tối thiểu.

## Console path

1. Mở **IAM → Identity providers → Add provider**.
2. Chọn **OpenID Connect**, URL `https://token.actions.githubusercontent.com`, audience `sts.amazonaws.com`.
3. Mở **IAM → Roles → Create role → Web identity**.
4. Thêm điều kiện `sub` giới hạn repository/branch hoặc environment; chỉ cấp quyền ECR/IaC cần thiết.

## Verify

- [ ] Provider chỉ có audience `sts.amazonaws.com`.
- [ ] Trust policy không dùng wildcard repository ngoài phạm vi.
- [ ] Role policy không cấp `AdministratorAccess`.
- [ ] Có CloudTrail event khi workflow kiểm thử assume role.

## Output

- Role ARN và policy revision đã redact.
- Expected: workflow được quyền đúng phạm vi, không dùng access key dài hạn.
- Measured Result: `Chưa thực hiện` nếu chưa có workflow evidence.

## Gate

Dừng trước khi cấp quyền push ECR hoặc Terraform nếu trust condition chưa giới hạn.

## Cleanup

Disable/xóa role và provider sau khi workflow không còn dùng; kiểm tra CloudTrail trước khi xóa.
