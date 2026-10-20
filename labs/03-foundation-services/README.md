# Lab 03 - Dịch vụ nền tảng AWS

Chuỗi lab tạo các dịch vụ AWS mà ReliabilityShop phụ thuộc: ECR, S3 remote state, SQS, RDS và ElastiCache. Chỉ thao tác trên AWS Console; không chạy Terraform, `kubectl apply` hoặc GitOps.

## Thứ tự và phụ thuộc

`01-ecr`, `02-s3-terraform-state` và `03-sqs-dlq` chạy sau networking. `04-rds-postgresql` và `05-elasticache-redis` cần private subnets, security groups và KMS. `06-backup-restore` chạy sau data services.

## Bàn giao

Ghi resource ID/ARN, Region, subnet group, security group, encryption key, tags và timestamp vào evidence đã che dữ liệu nhạy cảm. Terraform có thể import AWS resources sau lab; Kubernetes Secret và workload vẫn do ESO/Argo CD sở hữu.

