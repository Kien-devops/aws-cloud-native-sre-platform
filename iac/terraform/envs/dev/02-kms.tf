resource "aws_kms_key" "main" {
  description             = "Main CMK for SRE Platform Dev: EKS, Secrets Manager, and RDS"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Name        = "sre-platform-dev-main-cmk"
    Environment = var.environment
    Project     = "sre-platform"
  }
}

resource "aws_kms_alias" "main" {
  name          = "alias/sre-platform-dev-main"
  target_key_id = aws_kms_key.main.key_id
}

