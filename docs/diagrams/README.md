# Sơ đồ kiến trúc và vận hành

Các file `.mmd` là mã nguồn Mermaid, dùng để mô tả luồng logic mục tiêu. Có thể xem bằng Mermaid Preview, GitHub hoặc Mermaid Live Editor. Sơ đồ không xác nhận tài nguyên AWS hiện hữu.

| Sơ đồ | Nội dung |
| --- | --- |
| [platform-architecture.mmd](platform-architecture.mmd) | Client → ALB/WAF → EKS services → data → telemetry |
| [observability-flow.mmd](observability-flow.mmd) | Request → OTel → metrics/logs/traces → Grafana/Alertmanager |
| [incident-response-flow.mmd](incident-response-flow.mmd) | Phát hiện → phân loại → giảm thiểu → phục hồi → postmortem |
| [progressive-delivery-flow.mmd](progressive-delivery-flow.mmd) | Commit → test → ECR → GitOps → canary → promote/rollback |
| [chaos-experiment-flow.mmd](chaos-experiment-flow.mmd) | Giả thuyết → baseline → fault → giới hạn → cải tiến |

## Cách dùng an toàn

Trước khi dùng sơ đồ làm runbook, đối chiếu tên resource, namespace, account, region và phiên bản thực tế. Nhãn trong sơ đồ là **Expected**; **Measured Result** phải lấy từ manifest, event, metric, log hoặc trace đã lưu. Không chạy fault hoặc thay đổi traffic production chỉ dựa vào sơ đồ.

Tham khảo [mục lục tài liệu](../README.md) và [README repository](../../README.md).
