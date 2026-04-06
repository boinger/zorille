# Infrastructure Checklist

Use this checklist during Phase 3 when infrastructure scanning is active (infra files detected and `--no-infra` not set). Items marked `[QUICK]` run in quick mode. Each pattern is grep-detectable — no absence-based patterns. Record findings with file path, line number, and severity.

---

### Infrastructure

#### Docker

- `[QUICK]` **Unpinned base image** — `(?i)^FROM\s+\S+:latest\b|^FROM\s+\w+\s*$` — Unpinned base images pull different code on each build, breaking reproducibility and introducing unaudited changes. Pin to a specific version or digest.
- `[QUICK]` **Container running as root** — `(?i)^USER\s+root` — Containers default to root if no USER directive is set. A container escape with root gives full host access. Use a non-root USER directive.
- **Secrets in build args** — `(?i)ARG\s+(PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE_KEY|CREDENTIALS)` — Build args are visible in image history (`docker history`) and layer metadata. Use build secrets or runtime environment variables instead.
- **ADD instead of COPY** — `(?i)^ADD\s+` — ADD has implicit tar extraction and remote URL fetch, which can introduce unexpected files. Use COPY unless you specifically need tar extraction.

#### Kubernetes

- `[QUICK]` **Privileged container** — `privileged:\s*true` — Privileged containers bypass kernel namespace isolation. A compromised container has full host access. Use specific capabilities instead.
- **Host networking** — `hostNetwork:\s*true` — Host networking exposes all host ports to the container and bypasses network policies. Use pod networking unless host-level access is required.

#### Terraform / OpenTofu

- **Overly permissive IAM** — `"Action"\s*:\s*"\*"` — Wildcard IAM actions grant all permissions. Follow least-privilege: scope actions to specific services and operations.
- **Public S3 bucket** — `(?i)acl\s*=\s*"public` — Public ACLs expose bucket contents to the internet. Use private ACLs with explicit access grants.
- **Hardcoded credentials in Terraform** — `(?i)(password|secret_key|access_key)\s*=\s*"[^"]{8,}"` — Credentials in .tf files are committed to version control. Use variables with sensitive flag or external secret managers.

#### CI/CD — GitHub Actions

- **Unpinned action version** — `uses:\s+\S+@(main|master)\b` — Actions pinned to branch names execute whatever code is on that branch at run time. Pin to a full commit SHA for supply chain safety.
- **pull_request_target with checkout** — `pull_request_target` — The pull_request_target event runs with write permissions and secrets access on the base branch. Combined with checking out PR code, this enables code injection from forks.
- **Secrets in run blocks** — `\$\{\{\s*secrets\.` — Secrets interpolated directly in `run:` blocks can leak via process listing, error messages, or logs. Use environment variables with the `env:` mapping instead.

#### Docker Compose

- **Privileged mode** — `privileged:\s*true` — Same risk as Kubernetes privileged containers: full host access on container escape.
- **Ports bound to all interfaces** — `ports:\s*\n\s*-\s*"?\d+:\d+` — Ports without a bind address default to 0.0.0.0, exposing services to all network interfaces. Bind to 127.0.0.1 for local-only access.

#### nginx

- **Server tokens enabled** — `server_tokens\s+on` — Exposes the nginx version in response headers and error pages, giving attackers version-specific exploit information.
- **Weak TLS protocols** — `ssl_protocols\s+.*(?:SSLv3|TLSv1\.0|TLSv1\.1)` — SSLv3, TLS 1.0, and TLS 1.1 have known vulnerabilities (POODLE, BEAST). Use TLS 1.2+ only.
