# Module 02 — VPC Multi-AZ Network & Security Boundary

> **Phạm vi:** 3-Tier Network Architecture, Routing, VPC Endpoints & Security Groups | **Region:** `ap-southeast-1`

Module 02 đặc tả toàn bộ hạ tầng mạng Private-first trải dài trên 2 Availability Zones (`ap-southeast-1a` và `ap-southeast-1b`), bao gồm Subnet tagging để AWS Load Balancer Controller & Karpenter tự động nhận diện.

---

## Danh sách Đặc tả

| Mã | Tài liệu | Nội dung Chính |
| :--- | :--- | :--- |
| `02.01` | [VPC & Multi-AZ Subnets](01-vpc-subnets.md) | VPC `10.0.0.0/16`, 6 Subnets (Public, Private App, Private DB) & Subnet Tags |
| `02.02` | [Route Tables, IGW & NAT](02-route-table-igw-nat.md) | IGW, NAT Gateway AZ-a (FinOps Dev), 3 Route Tables phân tầng |
| `02.03` | [VPC Endpoints](03-vpc-endpoints.md) | S3 Gateway Endpoint miễn phí (`sre-platform-dev-vpce-s3`) |
| `02.04` | [Security Groups Matrix](04-security-groups.md) | Chaining SG-to-SG (`alb-sg`, `node-sg`, `db-sg`, `vpce-sg`) & Tagging |
| `02.05` | [VPC Flow Logs](05-vpc-flow-logs.md) | Giám sát lưu lượng mạng REJECT/ALL đẩy về CloudWatch Logs |
