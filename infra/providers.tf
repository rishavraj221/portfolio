terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "local" {
    path = "terraform.tfstate"
  }
}

variable "aws_profile" {
  description = "AWS CLI profile to use"
  type        = string
  default     = "personal"
}

variable "aws_region" {
  description = "Region for the S3 bucket (CloudFront/ACM are global/us-east-1 regardless)"
  type        = string
  default     = "ap-south-1"
}

provider "aws" {
  profile = var.aws_profile
  region  = var.aws_region
}

# ACM certificates for CloudFront must live in us-east-1, no matter where
# everything else runs.
provider "aws" {
  alias   = "use1"
  profile = var.aws_profile
  region  = "us-east-1"
}
