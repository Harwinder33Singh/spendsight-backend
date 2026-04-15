# Security Runbook

## If a secret is exposed

1. Rotate the leaked credential immediately in the provider dashboard.
2. Replace local values in `supabase/.env.local` (never commit this file).
3. Rewrite git history to remove leaked material from all commits.
4. Force-push rewritten history and ask collaborators to re-clone.
5. Verify no leaked values exist in current files or commit history.

## Local secret scanning hook

This repository includes a pre-commit hook at `.githooks/pre-commit`.

Install and enable it locally:

```bash
brew install gitleaks
git config core.hooksPath .githooks
```

The hook blocks commits if `gitleaks` is unavailable or if a secret is detected.

## CI secret scanning

GitHub Actions runs `.github/workflows/secret-scan.yml` on pushes and pull requests
to prevent new leaked secrets from being merged.
