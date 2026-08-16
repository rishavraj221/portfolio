variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment name, used in resource naming and tags"
  type        = string
  default     = "prod"
}

variable "project" {
  description = "Project name, used as a prefix for resource names"
  type        = string
  default     = "rbac-demo"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.42.0.0/16"
}

variable "cluster_version" {
  description = "Kubernetes version for the EKS cluster"
  type        = string
  default     = "1.30"
}

# ~20 tenants / ~35k users / ~8k daily active in the real system landed near
# 50 req/s peak on 3 pods at 1 vCPU / 1 GiB each. This demo is scoped the same.
variable "node_instance_type" {
  description = "EC2 instance type for the EKS managed node group"
  type        = string
  default     = "t3.small"
}

variable "node_desired_size" {
  type    = number
  default = 3
}

variable "node_min_size" {
  type    = number
  default = 2
}

variable "node_max_size" {
  type    = number
  default = 6
}

variable "backend_replica_count" {
  description = "Replica count for the rbac-demo backend Deployment"
  type        = number
  default     = 3
}

variable "backend_image" {
  description = "Container image for the backend, e.g. <account>.dkr.ecr.<region>.amazonaws.com/rbac-demo-backend:<tag>"
  type        = string
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_name" {
  type    = string
  default = "rbac_demo"
}

variable "db_username" {
  type    = string
  default = "rbac"
}

variable "db_password" {
  description = "Master password for RDS Postgres. Pass via -var or a tfvars file kept out of version control, never hardcode."
  type        = string
  sensitive   = true
}

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.micro"
}

variable "domain" {
  description = "Domain the ALB listener serves, e.g. rbac-demo.rishavraj.info"
  type        = string
}
