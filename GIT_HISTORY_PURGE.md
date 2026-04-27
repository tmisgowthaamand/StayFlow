# Git History Purge Instructions

⚠️ **CRITICAL**: After committing all changes from this security remediation, you MUST purge secrets from Git history.

## Prerequisites

Install BFG Repo Cleaner:
- Download from: https://rtyley.github.io/bfg-repo-cleaner/
- Or use: `brew install bfg` (macOS) / `choco install bfg-repo-cleaner` (Windows)

## Commands to Run

```bash
# 1. Ensure all changes are committed
git add -A
git commit -m "SECURITY: Remove committed secrets, purge from history"

# 2. Run BFG to purge secrets from history
bfg --delete-files .env
bfg --delete-files service-account.json
bfg --delete-folders dist --no-blob-protection

# 3. Clean up Git references
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 4. Force push to remote (THIS WILL REWRITE HISTORY)
git push --force
```

## Verification

After purging, verify secrets are gone:
```bash
git log --all --full-history -- .env
git log --all --full-history -- service-account.json
```

Both commands should return empty results.

## Important Notes

- This rewrites Git history and requires force push
- Notify all team members to re-clone the repository
- Any open PRs will need to be rebased
- CI/CD pipelines may need to be retriggered
