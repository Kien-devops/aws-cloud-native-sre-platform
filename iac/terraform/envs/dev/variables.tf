variable "aws_region" {
  description = "AWS region for infrastructure deployment"
  type        = string
  default     = "ap-southeast-1"
}

variable "environment" {
  description = "Deployment environment name"
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "Base CIDR block for the SRE platform VPC"
  type        = string
  default     = "10.0.0.0/16"
}

