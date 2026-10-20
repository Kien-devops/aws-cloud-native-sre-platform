# 05.02 - ACM và Route 53

## Mục tiêu

Cấp certificate cho domain và chuẩn bị DNS record cho ALB/Ingress.

## Input

- FQDN/subdomain, hosted zone, Region; ACM certificate cho ALB phải cùng Region.
- Phương thức DNS validation, owner DNS và TTL dự kiến.

## Console steps

1. Mở **AWS Certificate Manager > Request**; chọn public certificate và FQDN.
2. Chọn **DNS validation**, tạo request rồi mở validation record.
3. Vào **Route 53 > Hosted zones**, thêm CNAME validation record đúng giá trị.
4. Chờ certificate **Issued**; không bỏ qua cảnh báo domain ownership.
5. Ghi certificate ARN redacted, FQDN, validation timestamp và TTL.

## Verify

- Certificate `Issued`, SAN đúng, không sắp hết hạn.
- Hosted zone authoritative; record validation không sai zone.
- Chưa trỏ record ứng dụng vào ALB chưa tồn tại.

## Output

- **Expected:** certificate ISSUED, DNS validation/record đúng domain lab.
- **Measured Result:** Chưa thực hiện; redact domain nội bộ nếu cần.

Certificate ARN redacted, FQDN/SAN, hosted zone ID redacted, validation record và timestamp.

## Gate

Certificate và DNS ownership được xác nhận; record ứng dụng sẽ do bước ingress/handoff quản lý.

## Cleanup

Xóa validation/alias record thử nghiệm; chỉ xóa certificate sau khi gỡ listener tham chiếu.

