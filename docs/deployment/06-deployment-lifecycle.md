# Vòng đời triển khai

> Quy trình mục tiêu cho ReliabilityShop. Trạng thái, thời gian và kết quả trong ví dụ không đại diện cho một lần phát hành thực tế.

## Mục tiêu

Liên kết source, kiểm thử, build, scan, artifact bất biến, cập nhật GitOps, rollout, xác minh và rollback. Mỗi bước phải truy được commit, image digest, người phê duyệt và tín hiệu sau triển khai.

## Vấn đề thực tế

Pipeline có thể xanh nhưng image sai tag, manifest chưa cập nhật hoặc secret runtime thiếu. Deploy trực tiếp bằng kubeconfig làm mất audit và phá mô hình GitOps. Rollback cũng thất bại nếu artifact bị xóa hoặc migration không tương thích.

## Cơ chế và luồng

```text
Commit -> unit/integration/contract test -> SAST/SCA/image scan
       -> build image -> push ECR bằng digest
       -> PR cập nhật GitOps -> Argo CD sync
       -> rollout/health check -> SLO và monitoring
       -> promote hoặc rollback revision
```

CI chỉ cần quyền push ECR và tạo PR. ESO/Pod Identity cấp secrets lúc runtime. Deployment job không giữ admin kubeconfig; quyền đồng bộ nằm ở Argo CD hoặc cơ chế được kiểm soát riêng.

## Ví dụ ReliabilityShop

Commit đổi `order-service` tạo image có digest. Workflow chạy test và Trivy, mở PR đổi overlay staging. Sau khi merge, Argo CD sync; rollout kiểm tra readiness, error rate, p95 và dependency. Nếu ngưỡng xấu, revert PR hoặc abort canary.

## Thiết kế triển khai dự kiến

1. Tạo artifact với commit SHA, SBOM và provenance.
2. Scan dependency, secret, IaC và image trước khi promote.
3. Dùng digest thay `latest`; ký image nếu quy định yêu cầu.
4. Cập nhật GitOps qua PR có review và policy.
5. Xác minh sau deploy bằng health, SLI, logs, traces và audit.
6. Giữ artifact cũ đủ lâu cho rollback; ghi lại quyết định.

## Verification minh họa

```bash
kubectl rollout status deployment/order -n reliabilityshop --timeout=5m
kubectl get pods -n reliabilityshop -o wide
kubectl get events -n reliabilityshop --sort-by=.lastTimestamp
aws ecr describe-images --repository-name reliabilityshop/order --image-ids imageDigest=<digest>
```

**Expected (minh họa):** rollout hoàn tất; Pod dùng image digest đã review; health check và SLO không xấu hơn baseline; audit trail liên kết commit với revision. Đây là expected, không phải bằng chứng đã deploy.

## Troubleshooting

Build lỗi: kiểm tra lockfile, cache và runner. Push ECR lỗi: kiểm tra token, repository policy và region. Pod không khởi động: xem image pull secret, admission, config/secret và events. Argo CD không sync: xem diff, repo credential và RBAC. Sau deploy lỗi: đối chiếu digest, logs, traces và dependency metrics rồi rollback revision đã biết.

## Lưu ý production

Pin GitHub Actions, dùng OIDC thay static key, giới hạn concurrency và bảo vệ environment. Tách build artifact khỏi deployment artifact nhưng giữ provenance. Có approval cho production, rollback đã diễn tập, backup dữ liệu và thông báo sự cố. Đo lead time, change failure rate, recovery time và error budget.

## Nguồn chính thức

- [GitHub Actions Security](https://docs.github.com/en/actions/security-for-github-actions)
- [Amazon ECR User Guide](https://docs.aws.amazon.com/AmazonECR/latest/userguide/what-is-ecr.html)
- [Kubernetes Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [DORA Metrics](https://dora.dev/guides/dora-metrics-four-keys/)
