# GitOps với Argo CD

> Mô hình triển khai dự kiến. Trạng thái minh họa không xác nhận Argo CD đang chạy trong cluster.

## Mục tiêu

Git là nguồn trạng thái mong muốn; Argo CD liên tục so sánh trạng thái đó với Kubernetes và đồng bộ khi được phép. Mục tiêu là thay đổi có review, audit được, dễ rollback và hạn chế thao tác tay.

## Vấn đề thực tế

Drift xuất hiện khi người vận hành sửa bằng `kubectl edit`, Helm render khác phiên bản hoặc secret runtime không nằm trong Git. Bật `prune` và `selfHeal` thiếu phạm vi có thể xóa tài nguyên ngoài ý muốn. Application sai project hoặc namespace cũng có thể mở rộng quyền.

## Cơ chế và luồng

```text
Commit/PR -> Git repository -> Argo CD Application
         -> render Kustomize/Helm -> diff -> sync
         -> Kubernetes API -> health/status -> notification
```

Mỗi môi trường dùng overlay riêng. `syncPolicy` phải quy định rõ tự động hay thủ công, có `prune` hay không và cách xử lý hook. Argo CD chỉ quản lý manifest; secrets nên lấy từ External Secrets hoặc hệ thống tương đương.

## Ví dụ ReliabilityShop

PR đổi image digest của `order-service` trong overlay staging. Argo CD hiển thị diff, sync, chờ rollout và báo health. Nếu ai đó sửa replica trực tiếp, trạng thái `OutOfSync` là tín hiệu để review hoặc self-heal theo policy.

## Thiết kế triển khai dự kiến

1. Bootstrap Argo CD bằng manifest hoặc Helm đã pin phiên bản.
2. Tạo AppProject giới hạn repository, namespace và cluster resource.
3. Khai báo Application cho platform rồi cho từng môi trường.
4. Dùng PR để thay đổi manifest; bật sync tự động có kiểm soát.
5. Lưu revision, diff, sync result và rollout event làm evidence.

## Verification minh họa

```bash
argocd app list
argocd app get reliabilityshop-staging
argocd app diff reliabilityshop-staging
kubectl get applications.argoproj.io -n argocd
kubectl get events -A --sort-by=.lastTimestamp
```

**Expected (minh họa):** Application `Synced` và `Healthy`; diff rỗng sau sync; revision trùng commit được review. Đây chỉ là trạng thái mong đợi.

## Troubleshooting

`Unknown` hoặc `Missing` thường liên quan repository credential, path, plugin render hoặc quyền Kubernetes. `OutOfSync` cần xem diff và managed fields. Sync treo cần xem operation history, webhook, admission policy và events. Không xóa Application trước khi hiểu orphan resources.

## Lưu ý production

Dùng credential ngắn hạn, RBAC tối thiểu, SSO/MFA và audit log. Bảo vệ nhánh, ký commit hoặc image khi cần. Tách quyền sync khỏi quyền sửa cấu hình. Rollback bằng commit/revision đã biết; migration schema phải tương thích hai phiên bản trong rollout.

## Nguồn chính thức

- [Argo CD Documentation](https://argo-cd.readthedocs.io/en/stable/)
- [Argo CD AppProject](https://argo-cd.readthedocs.io/en/stable/user-guide/projects/)
- [Kubernetes Declarative Management](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/declarative-config/)
