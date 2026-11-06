# Reliability reports

**Báo cáo từ dữ liệu đo được, giữ rõ những trường chưa có bằng chứng.**

[Trang chủ](../../README.md) / [SRE](../README.md) / Reliability reports

| Đầu vào | Công cụ | Đầu ra |
| --- | --- | --- |
| JSON evidence đã che thông tin nhạy cảm | [generate.py](generate.py) | Markdown report |

Các trường gồm `window`, `availability`, `latency`, `error_budget_remaining`, `incident_count`, `mttd`, `mtta`, `mttr`, `evidence`. Giá trị thiếu được giữ là `NOT_MEASURED`; script không truy vấn telemetry backend.

`generate.py` renders Markdown from measured JSON evidence. Missing fields remain `NOT_MEASURED`; the tool never invents runtime values.

Example:

```powershell
python .\sre\reliability-reports\generate.py evidence.json report.md
```
