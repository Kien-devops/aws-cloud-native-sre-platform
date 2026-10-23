resource "aws_db_subnet_group" "main" {
  name        = "sre-platform-dev-rds-subnet-group"
  description = "Subnet group for dev RDS across Private DB subnets"
  subnet_ids  = [aws_subnet.private_db_1a.id, aws_subnet.private_db_1b.id]

  tags = {
    Name        = "sre-platform-dev-rds-subnet-group"
    Environment = var.environment
    Project     = "sre-platform"
  }
}

resource "aws_db_instance" "postgres" {
  identifier                  = "sre-platform-dev-pg"
  engine                      = "postgres"
  engine_version              = "16.9"
  instance_class              = "db.t4g.micro"
  allocated_storage           = 20
  max_allocated_storage       = 50
  db_name                     = "reliability_shop"
  db_subnet_group_name        = aws_db_subnet_group.main.name
  kms_key_id                  = aws_kms_key.main.arn
  storage_encrypted           = true
  performance_insights_enabled = true
  skip_final_snapshot         = true

  lifecycle {
    ignore_changes = [password, username]
  }

  tags = {
    Name        = "sre-platform-dev-pg"
    Environment = var.environment
    Project     = "sre-platform"
  }
}
