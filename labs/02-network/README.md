# Module 02: Mạng VPC, Định tuyến & Phân đoạn bảo mật

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
| [**02.01**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/02-network/01-vpc-subnets.md) | **3-Tier VPC & Subnets** | Dựng VPC `10.0.0.0/16`, 6 subnets trên 2 AZs (1a/1b), gắn thẻ EKS & Karpenter discovery | VPC > Your VPCs / Subnets |
| [**02.02**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/02-network/02-route-table-igw-nat.md) | **Route Tables, IGW & NAT** | Tạo IGW, cấp phát EIP cho NAT Gateway 1a, thiết lập bảng định tuyến cô lập mạng dữ liệu | VPC > Route tables / NAT |
| [**02.03**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/02-network/03-vpc-endpoints.md) | **VPC Endpoints (S3, ECR, Secrets)** | S3 Gateway Endpoint bypass NAT; Interface Endpoints cho ECR API, DKR và Secrets Manager | VPC > Endpoints |
| [**02.04**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/02-network/04-security-groups.md) | **Ma trận Security Groups** | Khởi tạo `alb-sg`, `node-sg`, `db-sg`; chặn mọi truy cập trực tiếp từ internet vào database | EC2 > Security Groups |
| [**02.05**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/02-network/05-vpc-flow-logs.md) | **VPC Flow Logs & CloudWatch** | Bật Flow Logs ghi lại toàn bộ traffic, cấu hình CloudWatch Logs Insights query phân tích REJECT | VPC > Flow logs |

---

## 3. Tiêu chí hoàn thành Module (Exit Gate)

- [ ] VPC `sre-platform-dev-vpc` hỗ trợ DNS hostnames và DNS resolution.
- [ ] 6 subnets được tạo đúng CIDR và gắn đầy đủ tag cho EKS Ingress Controller.
- [ ] Private DB Subnets hoàn toàn không có default route (`0.0.0.0/0`) trỏ ra internet.
- [ ] S3 Gateway Endpoint hoạt động, cho phép tải package/state mà không mất phí NAT data transfer.
- [ ] Ma trận Security Groups được cấu hình chuẩn, không có rule `0.0.0.0/0` trỏ tới port 5432 (Postgres) hoặc 6379 (Redis).
- [ ] VPC Flow Logs đẩy thành công các dòng log vào CloudWatch Logs group.
