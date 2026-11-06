# SRE runbooks

**Triage có thứ tự, mitigation có giới hạn, recovery có bằng chứng.**

[Trang chủ](../../README.md) / [SRE](../README.md) / Runbooks

| Tình huống | Tài liệu |
| --- | --- |
| Bắt đầu một incident | [Incident triage](incident-triage.md) |
| Pod, node, API, queue hoặc telemetry lỗi | [Common failures](common-failures.md) |
| Ghi timeline và quyết định | [Incident template](../incidents/incident-template.md) |
| Tổng kết nguyên nhân và phòng ngừa | [Postmortem template](../postmortems/template.md) |

All commands are diagnostic by default. Confirm namespace, workload, cluster, and change window before mutations. GitOps remains the source of truth; record approval and evidence for rollback or scaling actions.

Luồng xử lý: xác nhận impact → thu thập evidence → khoanh vùng dependency → mitigation nhỏ nhất → xác minh SLI → ghi action phòng ngừa.
