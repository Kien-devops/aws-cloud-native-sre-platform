resource "aws_sqs_queue" "order_dlq" {
  name                      = "reliability-shop-dev-order-dlq"
  kms_master_key_id         = aws_kms_key.main.arn
  message_retention_seconds = 1209600

  tags = {
    Name        = "reliability-shop-dev-order-dlq"
    Environment = var.environment
    Project     = "sre-platform"
  }
}

resource "aws_sqs_queue" "order_queue" {
  name                      = "reliability-shop-dev-order-queue"
  kms_master_key_id         = aws_kms_key.main.arn
  message_retention_seconds = 345600

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.order_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "reliability-shop-dev-order-queue"
    Environment = var.environment
    Project     = "sre-platform"
  }
}

