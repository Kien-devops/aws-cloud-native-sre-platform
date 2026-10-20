# Nền tảng Terraform

> Thiết kế dự kiến cho AWS Cloud-Native SRE Platform. Lệnh và kết quả là minh họa, chưa xác nhận đã triển khai trên AWS.

## Mục tiêu

Terraform quản lý hạ tầng theo mã nguồn, lặp lại được giữa `dev`, `staging` và `prod`. Tách `bootstrap`, module dùng chung và cấu hình môi trường giúp giảm drift, giới hạn thay đổi và hỗ trợ review qua pull request.

## Vấn đề thực tế

State cục bộ dễ mất hoặc bị ghi đè khi nhiều người làm việc. State dùng chung cần S3 có mã hóa, versioning và kiểm soát truy cập; quyền IAM phải đủ dùng nhưng không cấp toàn quyền. `terraform plan` có thể đề xuất thay thế tài nguyên quan trọng, vì vậy phải xem kỹ `destroy` và `replace` trước khi apply.

## Cơ chế và luồng

```text
Pull request -> fmt/validate -> plan lưu artifact -> review
             -> apply có phê duyệt -> AWS API -> state backend
             -> kiểm tra drift
```

`bootstrap` tạo backend và quyền tối thiểu. Module nhận biến, tạo tài nguyên và xuất output. Mỗi môi trường gọi cùng module nhưng giữ state và biến riêng. Secrets không đặt trong mã nguồn hoặc log plan.

## Ví dụ ReliabilityShop

Nền tảng cần VPC nhiều AZ, EKS, ECR, RDS, ElastiCache, SQS, KMS và IAM role. Thay đổi node group phải cho thấy rõ node bị thay thế, ảnh hưởng Pod và chi phí trước khi apply.

## Thiết kế triển khai dự kiến

1. Khởi tạo backend S3 và cơ chế khóa.
2. Áp dụng module mạng, sau đó EKS và các phụ thuộc.
3. Tách state theo môi trường hoặc miền thay đổi.
4. CI chạy `fmt`, `validate`, `plan`; apply từ nhánh được bảo vệ.
5. Lưu plan đã review, output và mã commit làm evidence.

## Verification minh họa

```bash
terraform -chdir=iac/terraform/envs/dev fmt -check -recursive
terraform -chdir=iac/terraform/envs/dev init -backend=false
terraform -chdir=iac/terraform/envs/dev validate
terraform -chdir=iac/terraform/envs/dev plan -out=tfplan
terraform show -no-color tfplan | Select-String "Plan:|must be replaced|destroy"
```

**Expected (minh họa):** `validate` thành công; plan không có thay thế ngoài dự kiến; số create/update/destroy được reviewer xác nhận. Đây không phải kết quả thực tế của môi trường AWS.

## Troubleshooting

| Triệu chứng | Kiểm tra |
| --- | --- |
| Không truy cập state | AWS identity, bucket policy, KMS và state lock |
| Plan báo drift | Đối chiếu console, import đúng resource, kiểm tra provider |
| Thay thế ngoài ý muốn | `terraform show`, lifecycle và thay đổi module |
| Apply bị gián đoạn | State lock, CloudTrail, resource đã tạo và chạy plan lại |

## Lưu ý production

Pin provider/module, mã hóa state, chặn public access, giới hạn IAM và bảo vệ branch. Kiểm tra backup, quota, AZ, dependency và rollback trước apply. Rollback Terraform không luôn khôi phục dữ liệu ứng dụng; migration database cần kế hoạch riêng.

## Nguồn chính thức

- [Terraform Language](https://developer.hashicorp.com/terraform/language)
- [Terraform S3 backend](https://developer.hashicorp.com/terraform/language/backend/s3)
- [AWS Well-Architected Reliability](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html)
