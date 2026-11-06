# Module 03 — Khởi tạo Dịch vụ Nền tảng (Foundation Services)

**Artifact, messaging và dữ liệu cho hành trình order.**

[Labs](../README.md) / Module 03 · [Trước: Network](../02-network/README.md) · [Tiếp: EKS](../04-eks-platform/README.md)

> **Mục tiêu Module:** Thiết lập toàn bộ các dịch vụ phụ trợ cốt lõi trên AWS Console mà nền tảng microservices ReliabilityShop tiêu thụ: Kho chứa container images (Amazon ECR), hàng đợi giao tiếp bất đồng bộ và cách ly thông điệp độc hại (Amazon SQS & Dead-Letter Queue), cơ sở dữ liệu quan hệ (Amazon RDS PostgreSQL với Outbox & Idempotency schema), bộ nhớ đệm phân tán (Amazon ElastiCache Redis) và diễn tập quy trình sao lưu phục hồi thảm họa (Disaster Recovery).

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
      +--------------------+                 | Pull Images (SHA Digest)
                                             |
     +---------------------------------------+------+
     |          Amazon EKS Cluster                  |
     |                                              |
     |  [ Order Service ] -----> [ Amazon SQS ]     |
     |  (Outbox Pattern)           (Order Queue)    |
     |          |                        |          |
     |          |                        v          |
     |          |              [ Payment Worker ]   |
     |          |              (Idempotent Consumer)|
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
  | - orders           |              +--------------------+
  | - order_outbox     |
  | - processed_events |
  +--------------------+
```

---

## 2. Thứ tự thực hành các bài Lab

| Lab | Tên bài | Dịch vụ AWS Console chính | Kết quả đầu ra |
| :--- | :--- | :--- | :--- |
| [**03.01**](01-ecr.md) | **Amazon ECR Repositories** | Elastic Container Registry | Repositories riêng tư, Tag Immutability, Scan on push, Lifecycle policy |
| [**03.02**](02-sqs-dlq.md) | **Amazon SQS & Dead-Letter Queue**| Simple Queue Service | Hàng đợi đơn hàng + DLQ cách ly lỗi kèm Redrive Policy (`maxReceiveCount = 3`) |
| [**03.03**](03-rds-postgresql.md) | **Amazon RDS PostgreSQL** | Relational Database Service | PostgreSQL 16 trong Private DB Subnets, Performance Insights, KMS CMK, Outbox Schema |
| [**03.04**](04-elasticache-redis.md) | **Amazon ElastiCache Redis** | ElastiCache In-Memory | Redis Cluster trong Private Subnets, bật TLS + AUTH token từ Secrets Manager |
| [**03.05**](06-backup-restore.md) | **Diễn tập Sao lưu & Phục hồi** | RDS Snapshots, PITR | Đo đạc thực tế RPO < 5p và RTO < 20p, kiểm chứng tính toàn vẹn dữ liệu |

---

## 3. Điều kiện tiên quyết (Prerequisites)

1. Mạng VPC đa AZ, Route Tables và Subnet Groups từ **Module 02** đã sẵn sàng.
2. Khóa KMS Customer Managed Key (`alias/sre-platform-dev-main`) từ **Module 01** đã được cấp quyền sử dụng cho RDS và ECR.
3. Secret thông tin đăng nhập database và cache token đã được chuẩn bị từ **Module 05** (`DB_PASSWORD`, `REDIS_AUTH`).
