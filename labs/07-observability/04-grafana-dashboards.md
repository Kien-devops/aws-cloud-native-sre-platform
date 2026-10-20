# 07.04 Grafana và dashboard

## Handoff

- Console: xác nhận DNS/TLS hoặc private access path của Grafana.
- GitOps: datasource, folder, dashboard và provisioning nằm trong `observability/grafana/`.

## Checklist

- [ ] Bật SSO/MFA hoặc cơ chế xác thực được phê duyệt.
- [ ] Tách quyền viewer, operator và admin.
- [ ] Tạo dashboard request, dependency, SQS, node và telemetry health.
- [ ] Link panel metrics → logs → traces bằng `trace_id`.
- [ ] Version hóa dashboard; không lưu credential trong JSON.

**Expected:** operator mở được dashboard theo môi trường và drill-down được một request.  
**Measured:** Chưa thực hiện.  
**Gate:** datasource healthy; panel quan trọng có dữ liệu; quyền truy cập đúng owner.  
**Cleanup:** xóa dashboard thử nghiệm và user tạm; giữ audit log.
