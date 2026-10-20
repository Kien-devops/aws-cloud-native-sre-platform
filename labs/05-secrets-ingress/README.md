# Module 05 — Secret Management, DNS & Ingress Routing

> **Mục tiêu Module:** Thiết lập toàn diện hạ tầng quản lý bí mật (Secrets Manager), mã hóa bảo mật (KMS CMK), chứng chỉ số SSL/TLS (ACM & Route 53) và hạ tầng mạng Ingress (AWS Load Balancer Controller & ALB) sẵn sàng cho microservices ReliabilityShop.

---

## 1. Kiến trúc phân hệ Secret & Ingress

```text
       Internet Client (HTTPS:443)
                  |
             Route 53
         (shop.dev Alias)
                  |
     Application Load Balancer (ALB)
  [ACM TLS Cert: *.dev.sreplatform...]
                  |
        Target Group (IP Mode)
                  |
       +----------v----------+
       | Amazon EKS Cluster  |
       |                     |
       |  ReliabilityShop    |
       |  Microservice Pods  |
       |          ^          |
       |          | Mount    |
       |   K8s Secret        |
       |   (app-credentials) |
       |          ^          |
       |          | Sync     |
       |  External Secrets   |
       |  Operator (ESO)     |
       +----------+----------+
                  |
        EKS Pod Identity
                  |
    +-------------v-------------+
    | AWS Secrets Manager       |
    | - DB_USER, DB_PASSWORD    |
    | - REDIS_AUTH, JWT_SECRET  |
    |                           |
    | Encrypted by KMS CMK:     |
    | alias/sre-platform-dev    |
    +---------------------------+
```

---

## 2. Thứ tự thực hành các bài Lab

| Lab | Tên bài | Dịch vụ AWS Console chính | Kết quả đầu ra |
| :--- | :--- | :--- | :--- |
| [05.01](01-secrets-manager.md) | **AWS Secrets Manager & KMS CMK** | Secrets Manager, KMS | Secret `/sre-platform/dev/reliability-shop/credentials` mã hóa bằng CMK |
| [05.02](02-acm-route53.md) | **ACM & Route 53 DNS** | Certificate Manager, Route 53 | Chứng chỉ SSL/TLS trạng thái `Issued` sẵn sàng cho HTTPS |
| [05.02b](02-external-secrets-handoff.md) | **External Secrets Operator Handoff** | IAM Roles, EKS Pod Identity | Đồng bộ tự động Secret từ AWS vào Kubernetes etcd qua ESO |
| [05.03](03-load-balancer-controller-prereqs.md) | **AWS LBC Prerequisites** | VPC Subnet Tags, IAM, EC2 SG | Gắn tag subnets, tạo IAM Role Pod Identity và Security Group cho ALB |
| [05.04](04-alb-ingress-validation.md) | **Xác minh ALB & Ingress Routing** | EC2 ALB, Target Groups, CloudWatch | ALB hoạt động, Target healthy, Route 53 trỏ chuẩn, HTTPS 200 OK |

---

## 3. Điều kiện tiên quyết chung (Prerequisites)

1. EKS Cluster `sre-platform-dev` đã được tạo và ở trạng thái `Active` (hoàn thành Module 04).
2. VPC với tối thiểu 2 Public Subnets và 2 Private Subnets trải rộng trên 2 AZ (hoàn thành Module 02).
3. Đã có quyền quản trị AWS Console (IAM User/Role) với các quyền trên Secrets Manager, KMS, ACM, Route 53, EC2 và EKS.
4. Tên miền sở hữu hợp lệ đã được ủy quyền quản lý qua Route 53 Public Hosted Zone.
