variable "domain" {
  description = "Apex domain, must already have a Route53 hosted zone"
  type        = string
  default     = "rishavraj.info"
}

variable "www_domain" {
  description = "www subdomain, 301-redirected to the apex at the edge"
  type        = string
  default     = "www.rishavraj.info"
}

variable "github_owner" {
  description = "GitHub username or org that owns the repo"
  type        = string
  default     = "rishavraj221"
}

variable "github_repo" {
  description = "GitHub repo name (owner/repo)"
  type        = string
  default     = "portfolio"
}
