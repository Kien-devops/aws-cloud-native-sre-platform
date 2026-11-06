# Module 02: Mạng VPC, Định tuyến & Phân đoạn bảo mật

**Tách đường vào ứng dụng, đường ra internet và lớp dữ liệu private.**

[Labs](../README.md) / Module 02 · [Trước: IAM](../01-iam-security/README.md) · [Tiếp: Foundation](../03-foundation-services/README.md)

## 1. Tổng quan Module

Module 02 xây dựng nền tảng mạng cấp doanh nghiệp (3-Tier Multi-AZ VPC Architecture) tại Region `ap-southeast-1`:
- **3-Tier Subnets:** Phân tầng rõ rệt giữa Public Subnet (ALB, NAT), Private App Subnet (EKS Nodes, Pods), và Private DB Subnet (RDS, ElastiCache hoàn toàn cô lập internet).
- **Định tuyến & FinOps Gateway:** Internet Gateway phục vụ chiều ra vào công cộng; 1 NAT Gateway duy nhất tại `ap-southeast-1a` để tối ưu chi phí dev trong khi vẫn đảm bảo định tuyến thông suốt.
- **PrivateLink & VPC Endpoints:** S3 Gateway Endpoint miễn phí NAT data transfer; Interface Endpoints cho ECR và Secrets Manager.
- **Defense-in-Depth Security Groups:** Ma trận tường lửa phân lớp nghiêm ngặt (`alb-sg` -> `node-sg` -> `db-sg`) với quy tắc tự tham chiếu (Self-referencing rule) cho mạng overlay của EKS pods.
- **VPC Flow Logs:** Thu thập toàn bộ lưu lượng chấp thuận (ACCEPT) và từ chối (REJECT) về CloudWatch Logs với thời gian lưu trữ 7 ngày.

---

## 2. Danh mục bài Lab chi tiết

| Bài Lab | Tiêu đề | Trọng tâm kỹ thuật | Console / CLI Path |
| :--- | :--- | :--- | :--- |
| [02.01](01-vpc-subnets.md) | VPC & Subnets | 6 subnet, 2 AZ, discovery tags | VPC > Subnets |
| [02.02](02-route-table-igw-nat.md) | Routes, IGW & NAT | Public egress và private routing | VPC > Route tables |
| [02.03](03-vpc-endpoints.md) | VPC Endpoints | S3 Gateway, ECR và Secrets Manager | VPC > Endpoints |
| [02.04](04-security-groups.md) | Security Groups | Ranh giới ALB, node và database | EC2 > Security Groups |
| [02.05](05-vpc-flow-logs.md) | Flow Logs | Thu thập traffic và phân tích REJECT | VPC > Flow logs |

---

## 3. Tiêu chí hoàn thành Module (Exit Gate)

- [ ] VPC `sre-platform-dev-vpc` hỗ trợ DNS hostnames và DNS resolution.
- [ ] 6 subnets được tạo đúng CIDR và gắn đầy đủ tag cho EKS Ingress Controller.
- [ ] Private DB Subnets hoàn toàn không có default route (`0.0.0.0/0`) trỏ ra internet.
- [ ] S3 Gateway Endpoint hoạt động, cho phép tải package/state mà không mất phí NAT data transfer.
- [ ] Ma trận Security Groups được cấu hình chuẩn, không có rule `0.0.0.0/0` trỏ tới port 5432 (Postgres) hoặc 6379 (Redis).
- [ ] VPC Flow Logs đẩy thành công các dòng log vào CloudWatch Logs group.
