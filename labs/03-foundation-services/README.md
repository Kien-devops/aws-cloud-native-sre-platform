# Module 03 — AWS Foundation Services (ECR, SQS, RDS, ElastiCache)

> **Phạm vi:** Container Registry, Messaging & Stateful Data Layer | **Region:** `ap-southeast-1`

Module 03 đặc tả các dịch vụ AWS Managed cốt lõi phục vụ kiến trúc microservices **ReliabilityShop**: kho chứa image bất biến (ECR), hàng đợi bất đồng bộ kèm Dead-Letter Queue (SQS), cơ sở dữ liệu quan hệ (RDS PostgreSQL 16.9) và tầng bộ nhớ đệm TLS (ElastiCache Redis 7.1).

---

## Danh sách Đặc tả

| Mã | Tài liệu | Nội dung Chính |
| :--- | :--- | :--- |
| `03.01` | [Amazon ECR Repositories](01-ecr.md) | 5 Private Repos (`reliabilityshop/*`), Scan on Push, Lifecycle Policy |
| `03.02` | [Amazon SQS & DLQ](02-sqs-dlq.md) | Queues cô lập theo môi trường (`dev`/`staging`/`prod`), KMS CMK, Redrive Policy `maxReceiveCount=3` |
| `03.03` | [Amazon RDS PostgreSQL](03-rds-postgresql.md) | `sre-platform-dev-pg` (v16.9), Private DB Subnets, KMS Encrypted, Outbox Schema |
| `03.04` | [Amazon ElastiCache Redis](04-elasticache-redis.md) | `sre-platform-dev-redis` (v7.1), Encryption in-transit (TLS) & at-rest |
| `03.06` | [Backup & DR Restore](06-backup-restore.md) | Automated Backup, Snapshot Retention & Kiểm chứng RPO/RTO |
