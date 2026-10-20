# 05.04 - Xác minh ALB và Ingress

## Mục tiêu

Kiểm tra đường đi HTTPS sau khi GitOps cài controller và Ingress; lab này chỉ quan sát, không apply manifest.

## Input

- Hostname/certificate ARN, service/Ingress name, expected path và health endpoint.
- Argo CD revision, ALB scheme, target port và SLO baseline.

## Console steps

1. Mở **EC2 > Load Balancers**; tìm ALB do controller tạo, kiểm tra scheme/listeners.
2. Mở **Target Groups**; đối chiếu target health, port, health path và AZ.
3. Mở **Route 53 > Hosted zones**; kiểm tra alias record trỏ đúng ALB.
4. Mở **ACM**; xác nhận listener dùng certificate đúng FQDN.
5. Mở **CloudWatch/ALB metrics**; kiểm tra 4xx/5xx, target response time và rejected connection.

## Verify

```bash
kubectl get ingress -A
kubectl describe ingress <name> -n <namespace>
curl -I https://<host>/health
```

**Expected:** DNS đúng, TLS hợp lệ, target healthy, request tới đúng Service. **Measured Result:** lưu response/status, metrics và timestamp.

## Output

ALB ARN redacted, DNS name, listener/certificate, target health, route/path, HTTP result và timestamp.

## Gate

Request user-facing thành công, không có target unhealthy kéo dài; lỗi phải kiểm tra Argo/controller logs trước khi chỉnh Console.

## Cleanup

Xóa record/Ingress thử nghiệm qua GitOps owner; kiểm tra ALB, target group, ENI và certificate còn lại.

