# Module 08: CI/CD Delivery, Autoscaling & Canary Deployment

## 1. Tổng quan Module

Module 08 xây dựng đường ống phân phối ứng dụng tự động hóa hoàn chỉnh và các cơ chế co giãn đàn hồi đa tầng (**Multi-Layer Autoscaling & Progressive Delivery**):
- **CI Build & Security Scan:** Đường ống GitHub Actions tích hợp OIDC đẩy ảnh lên Amazon ECR với Tag Immutability; quét lỗ hổng bảo mật bằng **Trivy** và chặn build nếu phát hiện lỗi Critical/High.
- **GitOps Promotion Pipeline:** Quy trình thăng cấp phiên bản an toàn (`dev` -> `staging` -> `prod`) sử dụng Pull Request và kiểm soát chốt chặn thủ công (Manual Sync Gate) cho production.
- **Pod & Event Autoscaling:** Kết hợp **Horizontal Pod Autoscaler (HPA)** dựa trên CPU/Memory và **KEDA (Kubernetes Event-driven Autoscaling)** mở rộng số lượng worker theo chiều dài hàng đợi SQS, hỗ trợ Scale-to-Zero tiết kiệm chi phí.
- **Node Autoscaling với Karpenter v1.0+:** Tự động bổ sung các EC2 Instances (On-Demand / Spot) phù hợp yêu cầu pod trong vòng dưới 60 giây và tự động dồn pod (Consolidation) khi hạ tải.
- **Canary Deployment & Rollback tự động:** Sử dụng **Argo Rollouts** kết hợp **AnalysisTemplate** truy vấn PromQL; tự động hủy bỏ phát hành (Abort/Rollback) trong vòng 60 giây nếu tỷ lệ lỗi HTTP 5xx vượt quá 1%.

---

## 2. Danh mục bài Lab chi tiết

| Bài Lab | Tiêu đề | Trọng tâm kỹ thuật | Console / CLI Path |
| :--- | :--- | :--- | :--- |
| [**08.01**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/08-delivery-scaling/01-ci-build-scan-ecr.md) | **CI Build, Trivy & OIDC ECR** | GitHub Actions build, scan CVE với Trivy, gán tag `sha-xxxx`, đẩy ECR qua OIDC | GitHub Actions + ECR Console |
| [**08.02**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/08-delivery-scaling/02-gitops-promotion.md) | **GitOps Environment Promotion** | Quản lý overlays, quy trình PR thăng cấp phiên bản, chốt chặn Manual Sync ở Prod | Argo CD UI + GitHub PR |
| [**08.03**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/08-delivery-scaling/03-hpa-keda.md) | **HPA & KEDA SQS Autoscaling** | HPA co giãn `order-service` theo tải CPU; KEDA co giãn `payment-worker` theo hàng đợi SQS | `kubectl` + AWS SQS Console |
| [**08.04**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/08-delivery-scaling/04-karpenter.md) | **Karpenter v1.0 Node Autoscaling** | Triển khai `EC2NodeClass` và `NodePool`, thử nghiệm co giãn node cấp tốc và hợp nhất node | EC2 Console + Karpenter Logs |
| [**08.05**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/08-delivery-scaling/05-argo-rollouts-canary.md) | **Argo Rollouts Canary & Analysis** | Canary 5% -> 20% -> 50% -> 100%, tích hợp PromQL phân tích lỗi thời gian thực | Argo Rollouts Dashboard |
| [**08.06**](file:///e:/repo/aws-cloud-native-sre-platform/aws-cloud-native-sre-platform/labs/08-delivery-scaling/06-rollback.md) | **Automated Rollback on Metric Spike** | Giả lập phát hành phiên bản lỗi `v2.0-bad`, kiểm chứng tự động hủy phát hành trong 60s | Prometheus + Rollouts UI |

---

## 3. Tiêu chí hoàn thành Module (Exit Gate)

- [ ] Đường ống CI từ chối build nếu hình ảnh chứa lỗ hổng bảo mật cấp độ `CRITICAL`.
- [ ] KEDA mở rộng số lượng worker từ 0 lên 5 pods khi bơm 1,000 thông điệp vào SQS Queue và tự động hạ về 0 khi xử lý xong.
- [ ] Karpenter cấp phát EC2 instance mới và đưa vào trạng thái Ready trong vòng dưới 60 giây.
- [ ] Argo Rollouts phân tích thành công metrics trong suốt quá trình chạy Canary và tự động rollback khi tỷ lệ lỗi vượt ngưỡng 1%.
- [ ] Không có gián đoạn dịch vụ hoặc lỗi 5xx kéo dài đối với người dùng cuối trong suốt chu kỳ phát hành mới.
