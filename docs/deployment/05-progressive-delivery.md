# Phát hành dần với Canary

> Thiết kế dự kiến. Tỷ lệ traffic và ngưỡng bên dưới chỉ là ví dụ để xây dựng quy trình kiểm chứng.

## Mục tiêu

Phát hành phiên bản mới cho một phần traffic, đo tín hiệu người dùng rồi tăng dần hoặc tự động dừng. Argo Rollouts kết hợp routing, `AnalysisTemplate` và metrics để giảm blast radius.

## Vấn đề thực tế

Canary vẫn có thể gây lỗi nếu traffic quá ít, metric chậm hoặc phân bổ không đúng. Chỉ theo dõi CPU bỏ qua lỗi nghiệp vụ, p95, queue lag và dependency. Rollback image không tự rollback migration database hoặc side effect đã ghi vào dữ liệu.

## Cơ chế và luồng

```text
Client -> Ingress/ALB -> stable hoặc canary service
                         -> Prometheus AnalysisTemplate
                         -> pause/advance/abort
```

Các bước 5%-20%-50%-100% chỉ có ý nghĩa khi đủ request. Mỗi bước cần thời gian quan sát, ngưỡng lỗi, timeout và hành động khi metric không có dữ liệu. Header/cookie routing hữu ích cho test nhưng không được bỏ qua traffic thật trong kiểm chứng.

## Ví dụ ReliabilityShop

Phiên bản mới của `payment-service` nhận 5% traffic. Nếu HTTP 5xx hoặc business failure vượt baseline, Rollout abort và đưa traffic về stable. Khi các bước đạt ngưỡng, tiếp tục 20%, 50%, rồi hoàn tất.

## Thiết kế triển khai dự kiến

1. Chuẩn hóa metric success, latency và saturation.
2. Khai báo Rollout, stable/canary service và traffic routing.
3. Viết AnalysisTemplate có query, failure limit, interval và timeout.
4. Kiểm tra tương thích API, schema và queue trước khi tăng traffic.
5. Ghi revision, weight, analysis result và quyết định operator.

## Verification minh họa

```bash
kubectl get rollout -A
kubectl argo rollouts get rollout payment -n reliabilityshop --watch
kubectl argo rollouts dashboard
```

**Expected (minh họa):** weight khớp bước cấu hình; analysis `Successful` thì rollout tiến; analysis `Failed` thì abort và stable phục vụ lại. Đây là tiêu chí cần quan sát, chưa phải kết quả đã chạy.

## Troubleshooting

Weight không đổi: kiểm tra controller, traffic router và service selector. Analysis không có dữ liệu: kiểm tra Prometheus query, label version, thời gian scrape và quyền mạng. Rollout treo: xem pause step, Pod readiness, PDB và events. Abort không giảm lỗi: xác nhận route thật trên ALB/Ingress và connection pool.

## Lưu ý production

Canary cần rollback nhanh, image bất biến và dashboard theo version. Đặt giới hạn tự động để tránh abort lặp. Database migration dùng chiến lược mở rộng rồi thu hẹp; không xóa cột ngay trong cùng release. Xác định quyền promote/abort và lưu audit trail.

## Nguồn chính thức

- [Argo Rollouts](https://argo-rollouts.readthedocs.io/en/stable/)
- [Kubernetes Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Google SRE: Canarying Releases](https://sre.google/workbook/canarying-releases/)
