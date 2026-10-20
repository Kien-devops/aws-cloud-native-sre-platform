# Auto-remediation an toàn

Auto-remediation chỉ phù hợp với lỗi lặp lại, chẩn đoán chắc chắn, hành động có giới hạn và rollback rõ.

~~~text
Metric/Event -> rule -> xác nhận điều kiện -> remediation -> verify
                              |                    |
                              +-> rate limit       +-> rollback/escalate
~~~

## 1. Guardrail bắt buộc

- Cho phép theo allowlist service, namespace và môi trường.
- Có cooldown, retry tối đa, concurrency và circuit breaker.
- Không tự sửa dữ liệu, IAM, network critical hoặc failover production.
- Mọi hành động có audit ID, trước/sau, owner và notification.
- GitOps vẫn là nguồn chuẩn; remediation không tạo drift lâu dài.

## 2. Ví dụ ReliabilityShop

KEDA đã scale Order Worker nhưng queue vẫn tăng do một Pod treo. Controller chỉ được restart đúng Pod khi:

1. Readiness fail liên tục trên 10 phút.
2. Deployment có ít nhất hai replica healthy khác.
3. Không có rollout đang chạy.
4. Restart count chưa vượt 1 lần trong 30 phút.
5. Pod mới phải Ready và queue depth giảm; nếu không, dừng và page.

Pseudo flow:

~~~text
if condition_confirmed and within_budget:
    capture_evidence
    restart_one_pod
    verify_for_10_minutes
    if not_recovered:
        disable_rule
        page_on_call
~~~

## 3. AWS/Kubernetes implementation

EventBridge hoặc Prometheus Alertmanager có thể kích hoạt Lambda/Step Functions. AWS Systems Manager Automation phù hợp cho EC2. Trong EKS, service account dùng Pod Identity với IAM tối thiểu; Kubernetes RBAC chỉ cấp verb/resource cần thiết.

Không trao wildcard, không lưu kubeconfig hoặc static AWS key trong workflow.

## 4. Xác minh

- Unit test predicate và trường hợp không được chạy.
- Dry-run trả về target, lý do và hành động dự kiến.
- Fault injection trong dev/staging; kiểm tra cooldown và rollback.
- Theo dõi tỷ lệ remediation thành công, false positive và số lần escalation.

| Kết quả | Nội dung |
| --- | --- |
| **Expected** | Một Pod lỗi được thay an toàn; availability giữ ổn định; rule dừng sau giới hạn. |
| **Measured** | Chưa chạy. Ghi event ID, target, thời gian, trước/sau và kết quả verify. |

## 5. Troubleshooting và production

- Remediation lặp vô hạn: circuit breaker ngoài workflow và kill switch thủ công.
- Sai target: dùng UID/resourceVersion, kiểm tra lại ngay trước mutation.
- Metric trễ: xác nhận bằng hai nguồn hoặc nhiều mẫu liên tiếp.
- Quyền thiếu/thừa: xem CloudTrail và Kubernetes audit; thu hẹp IAM/RBAC.
- Tự động hóa không thay runbook, owner và xử lý nguyên nhân gốc.
