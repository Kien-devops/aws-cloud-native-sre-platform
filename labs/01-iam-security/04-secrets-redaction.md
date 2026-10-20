# 01.04 — Tiêu chuẩn Quản lý Bí mật và Cơ chế Tự động Che giấu Dữ liệu (Redaction Automation)

> **Trạng thái:** Hướng dẫn tiêu chuẩn thực hành bắt buộc cho mọi thành viên nhóm SRE.  
> **Áp dụng cho:** Ngăn chặn lộ lọt mật khẩu, khóa bí mật, token trong terminal, Git repository và các tệp bằng chứng lab.

---

## 1. Mục tiêu và Nguyên tắc SRE

- **Mục tiêu:** 
  - Thiết lập quy tắc "Zero Plaintext Secrets" trên toàn bộ vòng đời phát triển và vận hành (DevOps / SRE).
  - Áp dụng các công cụ và kỹ thuật phát hiện rò rỉ secret (Secret Scanning) cục bộ trước khi lệnh `git commit` được thực thi.
  - Xây dựng quy trình xử lý sự cố (Incident Playbook) khi phát hiện bí mật bị commit nhầm lên kho lưu trữ.
- **Nguyên tắc SRE:**
  - **Secret Sprawl is a Critical Defect:** Rò rỉ thông tin xác thực là một lỗ hổng nghiêm trọng (P0 Incident) đe dọa sự sống còn của nền tảng.
  - **Immediate Invalidation (Hủy bỏ tức thì):** Một khi secret đã bị lộ ra ngoài, việc xóa commit trong Git history không giải quyết được vấn đề; secret đó phải được coi là đã bị xâm phạm và phải bị thu hồi/đổi mới (revocation/rotation) ngay lập tức.
  - **Runtime Injection Only:** Workloads microservices chỉ được phép nhận secrets tại thời điểm chạy (runtime) thông qua External Secrets Operator hoặc CSI Secret Store, tuyệt đối không hardcode trong Dockerfile hay Kubernetes ConfigMaps.

---

## 2. Danh mục Dữ liệu Tuyệt đối Cấm Lưu trữ Plaintext

1. **Database Credentials:** Username/Password kết nối PostgreSQL, MySQL.
2. **Cache Tokens:** Auth tokens kết nối Redis/ElastiCache.
3. **API Keys & Webhook Secrets:** Stripe Key, GitHub Personal Access Token (PAT), Slack Webhook URLs.
4. **AWS Credentials:** `aws_access_key_id`, `aws_secret_access_key`, `aws_session_token`.
5. **Cryptographic Material:** Khóa riêng tư RSA/ED25519 (`id_rsa`, `.pem`, `.key`), JWT Secret Signing Keys.
6. **Kubeconfig Files:** Tệp chứa bearer tokens hoặc client certificates kết nối EKS control plane.

---

## 3. Thiết lập Công cụ Quét và Che giấu Cục bộ (Pre-commit Hook)

Để đảm bảo không bao giờ vô tình commit secret vào Git, cấu hình pre-commit hook trong môi trường làm việc:

### Bước 1: Cài đặt và Chạy Gitleaks Cục bộ
Tải và chạy công cụ [Gitleaks](https://github.com/gitleaks/gitleaks) để quét toàn bộ repository:

```bash
# Quét toàn bộ lịch sử commit và thư mục làm việc
gitleaks detect --source . --verbose
```

### Bước 2: Tạo Git Pre-commit Hook Tự động
Tạo file `.git/hooks/pre-commit` để tự động chặn commit nếu phát hiện chuỗi nghi vấn secret:

```bash
cat << 'EOF' > .git/hooks/pre-commit
#!/usr/bin/env bash
# SRE Platform Secret Detection Hook

echo "==> Running Gitleaks secret check..."
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks protect --staged --verbose
  if [ $? -ne 0 ]; then
    echo "❌ ERROR: Gitleaks detected sensitive credentials in staged files!"
    echo "Please redact secrets before committing."
    exit 1
  fi
else
  echo "⚠️ Warning: gitleaks is not installed. Performing regex check..."
  if git diff --cached | grep -E -i "(AKIA[0-9A-Z]{16}|secret_access_key|password\s*[:=]\s*['\"][^'\"]+['\"])"; then
    echo "❌ ERROR: Potential plaintext secret detected in git diff!"
    exit 1
  fi
fi

echo "✅ Secret check passed."
EOF

chmod +x .git/hooks/pre-commit
```

---

## 4. Quy trình Xử lý Khẩn cấp khi Lộ Secret (Break-Glass Runbook)

Nếu lỡ tay commit hoặc push tệp có chứa secret thật lên Git:

1. **Bước 1: Cô lập và Thu hồi Ngay lập tức (Revoke Immediately):**
   - Không tốn thời gian cố gắng rebase hay sửa commit history trên Git trước.
   - Lập tức vào **AWS Secrets Manager** hoặc **AWS IAM Console** -> Đổi mật khẩu database hoặc xóa bỏ Access Key bị lộ.
2. **Bước 2: Xoay vòng Bí mật (Rotate Secret):**
   - Sinh mật khẩu/token mới trên Secrets Manager.
   - Kích hoạt ESO sync hoặc restart application pods để nhận secret mới.
3. **Bước 3: Kiểm toán Thiệt hại trên CloudTrail (Audit Trail):**
   - Vào **CloudTrail Console** -> Lọc các sự kiện phát sinh từ IP lạ hoặc thời điểm sau khi secret bị lộ để xác minh xem kẻ xấu đã lợi dụng credential hay chưa.
4. **Bước 4: Làm sạch Lịch sử Git (Clean Git History):**
   - Sử dụng `git-filter-repo` hoặc BFG Repo-Cleaner để loại bỏ hoàn toàn tệp nhạy cảm khỏi toàn bộ commit history.

---

## 5. Mẫu Checklist Tự Đánh giá (Self-Audit Checklist)

Trước khi gửi Pull Request hoặc nộp bằng chứng bài lab, hoàn thành checklist sau:

- [ ] Lệnh `git status` không hiển thị tệp `.env`, `.pem`, `kubeconfig`, hay file state `.tfstate`.
- [ ] Không có chuỗi `AKIA...` hay password thật trong bất kỳ file markdown nào thuộc thư mục `labs/`.
- [ ] Các ARN trong file bằng chứng đã được thay thế phần Account ID bằng `***REDACTED***`.
- [ ] Các ảnh chụp màn hình Console (nếu có) đã được làm mờ (blur) toàn bộ vùng hiển thị Account ID, Email, và giá trị ô Value.

---

## 6. Điều kiện hoàn thành Gate (Gate Check)

- [ ] Toàn bộ thành viên nắm vững quy trình Redaction.
- [ ] Hook kiểm tra secret tự động hoặc lệnh quét thủ công đã chạy không phát hiện lỗi.
- [ ] Cam kết tuân thủ nguyên tắc "Zero Secrets in Git" cho toàn bộ 10 Phase của dự án.
