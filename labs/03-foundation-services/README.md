# Module 03 — Khởi tạo Dịch vụ Nền tảng (Foundation Services)

> **Mục tiêu Module:** Thiết lập toàn bộ các dịch vụ phụ trợ cốt lõi trên AWS mà nền tảng microservices ReliabilityShop tiêu thụ: Kho chứa container images (ECR), lưu trữ trạng thái IaC (S3 & DynamoDB), hàng đợi giao tiếp bất đồng bộ (SQS & DLQ), cơ sở dữ liệu quan hệ (RDS PostgreSQL), bộ nhớ đệm (ElastiCache Redis) và diễn tập quy trình sao lưu phục hồi thảm họa (Disaster Recovery).

---

## 1. Bản đồ Dịch vụ Nền tảng (Architecture Map)

```text
       [ GitHub Actions CI ]
                 |
            OIDC Push
                 v
      +--------------------+
      |  Amazon ECR Repo   | <---------------+
      |  (Tag Immutability)|                 |
      +--------------------+                 | Pull Images
                                             |
   +---------------------------+             |
   | Amazon S3 & DynamoDB      |             |
   | (Terraform Remote State)  |             |
   +---------------------------+             |
                                             |
     +---------------------------------------+------+
     |          Amazon EKS Cluster                  |
     |                                              |
     |  [ Order Service ] -----> [ Amazon SQS ]     |
     |          |                  (Order Queue)    |
     |          |                        |          |
     |          |                        v          |
     |          |              [ Payment Worker ]   |
     |          |                        |          |
     |          +-------------+          v          |
     |                        |   [ Order DLQ ]     |
     +------------------------|---------------------+
                              |
                 Private DB Subnets (Multi-AZ)
                              |
            +-----------------+-----------------+
            |                                   |
            v                                   v
  +--------------------+              +--------------------+
  | Amazon RDS         |              | Amazon ElastiCache |
  | PostgreSQL 16      |              | Redis 7.x (TLS)    |
  | (Performance       |              | (Cache-Aside &     |
  |  Insights Enabled) |              |  AUTH Enabled)     |
  +--------------------+              +--------------------+
```

---

## 2. Thứ tự thực hành các bài Lab

| Lab | Tên bài | Dịch vụ AWS Console chính | Kết quả đầu ra |
| :--- | :--- | :--- | :--- |
| [03.01](01-ecr.md) | **Amazon ECR Repositories** | Elastic Container Registry | 3 repos riêng tư, Tag Immutability, Scan on push, Lifecycle policy |
| [03.02](02-s3-terraform-state.md) | **S3 & DynamoDB State Backend** | S3, DynamoDB, KMS | S3 Bucket versioning + DynamoDB lock table cho Terraform state |
| [03.03](02-sqs-dlq.md) | **Amazon SQS & Dead-Letter Queue**| Simple Queue Service | Hàng đợi đơn hàng + DLQ cách ly lỗi kèm Redrive Policy (maxReceives=3) |
| [03.04](03-rds-postgresql.md) | **Amazon RDS PostgreSQL** | Relational Database Service | PostgreSQL 16 trong Private DB Subnets, Performance Insights, KMS CMK |
| [03.05](04-elasticache-redis.md) | **Amazon ElastiCache Redis** | ElastiCache In-Memory | Redis Cluster trong Private Subnets, bật TLS + AUTH token từ Secrets Manager |
| [03.06](06-backup-restore.md) | **Diễn tập Sao lưu & Phục hồi** | RDS Snapshots, PITR | Đo đạc thực tế RPO < 5p và RTO < 20p, kiểm chứng tính toàn vẹn dữ liệu |

---

## 3. Điều kiện tiên quyết (Prerequisites)

1. Mạng VPC đa AZ, Route Tables và Subnet Groups từ **Module 02** đã sẵn sàng.
2. Khóa KMS Customer Managed Key (`alias/sre-platform-dev-main`) từ **Module 01** đã được cấp quyền sử dụng cho RDS, S3 và ECR.
3. Secret thông tin đăng nhập database và cache token đã được chuẩn bị từ **Module 05** (`DB_PASSWORD`, `REDIS_AUTH`).
