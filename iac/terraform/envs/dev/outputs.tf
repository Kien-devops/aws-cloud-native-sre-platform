output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "public_subnets" {
  description = "Public subnet IDs"
  value       = [aws_subnet.public_1a.id, aws_subnet.public_1b.id]
}

output "private_app_subnets" {
  description = "Private application subnet IDs"
  value       = [aws_subnet.private_app_1a.id, aws_subnet.private_app_1b.id]
}

output "private_db_subnets" {
  description = "Private database subnet IDs"
  value       = [aws_subnet.private_db_1a.id, aws_subnet.private_db_1b.id]
}

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = aws_eks_cluster.main.name
}

output "kms_key_arn" {
  description = "KMS CMK Key ARN"
  value       = aws_kms_key.main.arn
}

output "sqs_order_queue_url" {
  description = "SQS Order Queue URL"
  value       = aws_sqs_queue.order_queue.url
}

