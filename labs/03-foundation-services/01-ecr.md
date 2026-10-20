# 03.01 - Amazon ECR

## Mục tiêu

Tạo repository image bất biến cho từng service, bật quét và lifecycle có giới hạn.

## Input

- Region và tên repo, ví dụ `reliabilityshop/order`.
- Tag policy: Git SHA hoặc digest; không dùng `latest`.
- KMS, lifecycle và scan policy đã được phê duyệt.

## Console steps

1. Mở **Amazon ECR > Repositories > Create repository**.
2. Chọn **Private**, đặt tên repo và bật **Tag immutability**.
3. Bật **Scan on push** nếu tài khoản hỗ trợ; chọn encryption phù hợp.
4. Tạo repository, mở **Permissions** và chỉ cấp push/pull cho role cần thiết.
5. Trong **Lifecycle policies**, giới hạn image cũ theo số lượng hoặc tuổi.

## Verify

- Repository ở đúng Region, private, immutable.
- Scan status và lifecycle policy hiển thị đúng.
- Không có image/tag ngoài kế hoạch; không push secret.

## Output

- **Expected:** repository private, immutable tag, scan và lifecycle hiển thị đúng.
- **Measured Result:** Chưa thực hiện; điền sau khi Console verification có timestamp.

`repositoryUri`, ARN, Region, scan mode, lifecycle policy ID, encryption mode và timestamp.

## Gate

Role CI push đúng repository, role runtime pull được, tag mutable bị từ chối và image scan có trạng thái rõ ràng.

## Cleanup

Xóa image thử nghiệm trước khi xóa repository. Không xóa digest đang được release hoặc rollback.

