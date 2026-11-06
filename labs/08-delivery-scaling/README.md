# Module 08: CI/CD Delivery, Autoscaling & Canary Deployment

**Build bất biến, promotion có review, capacity đi theo nhu cầu.**

[Labs](../README.md) / Module 08 · [Trước: Observability](../07-observability/README.md) · [Tiếp: SRE Validation](../09-sre-validation/README.md)

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
| [08.01](01-ci-build-scan-ecr.md) | CI Build & Scan | Tests, Trivy, ECR và OIDC | GitHub Actions / ECR |
| [08.02](02-gitops-promotion.md) | GitOps Promotion | PR, overlays và manual sync prod | GitHub / Argo CD |
| [08.03](03-hpa-keda.md) | HPA & KEDA | CPU scaling và SQS backlog | Kubernetes / SQS |
| [08.04](04-karpenter.md) | Karpenter | NodePool, NodeClass và consolidation | EC2 / controller logs |
| [08.05](05-argo-rollouts-canary.md) | Canary & Analysis | Weight, pause và Prometheus gate | Argo Rollouts |
| [08.06](06-rollback.md) | Rollback | Abort và khôi phục desired state | Git / Rollouts |

---

## 3. Tiêu chí hoàn thành Module (Exit Gate)

- [ ] Đường ống CI từ chối build nếu hình ảnh chứa lỗ hổng bảo mật cấp độ `CRITICAL`.
- [ ] KEDA mở rộng số lượng worker từ 0 lên 5 pods khi bơm 1,000 thông điệp vào SQS Queue và tự động hạ về 0 khi xử lý xong.
- [ ] Karpenter cấp phát EC2 instance mới và đưa vào trạng thái Ready trong vòng dưới 60 giây.
- [ ] Argo Rollouts phân tích thành công metrics trong suốt quá trình chạy Canary và tự động rollback khi tỷ lệ lỗi vượt ngưỡng 1%.
- [ ] Không có gián đoạn dịch vụ hoặc lỗi 5xx kéo dài đối với người dùng cuối trong suốt chu kỳ phát hành mới.
