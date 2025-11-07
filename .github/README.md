# Automated Release Setup - Quick Start

## 🚀 Setup Steps (Required Before First Use)

### Step 1: Add NPM Token to GitHub

```bash
# 1. Generate NPM token (if you don't have one)
npm login
npm token create

# 2. Copy the token

# 3. Go to GitHub:
# Repository → Settings → Secrets and variables → Actions → New repository secret
# Name: NPM_TOKEN
# Value: <paste your token>
```

### Step 2: Use Conventional Commits

When creating PRs or merging to main, use these commit message formats:

| Commit Prefix | Version Bump | Example |
|--------------|--------------|---------|
| `fix:` | Patch (3.0.12 → 3.0.13) | `fix: resolve worker shutdown issue` |
| `feat:` | Minor (3.0.12 → 3.1.0) | `feat: add health check endpoint` |
| `feat!:` or `BREAKING CHANGE:` | Major (3.0.12 → 4.0.0) | `feat!: redesign worker API` |

## 📝 Usage Example

```bash
# 1. Create feature branch
git checkout -b feat/add-new-feature

# 2. Make changes and commit
git commit -m "feat: add awesome new feature"

# 3. Push and create PR
git push origin feat/add-new-feature

# 4. Merge PR to main
# → Workflow automatically runs and publishes!
```

## 🎯 What Happens Automatically

1. ✅ Tests run
2. ✅ Version bumped (based on commit message)
3. ✅ Package built
4. ✅ Published to npm
5. ✅ Git tag created
6. ✅ GitHub release created
7. ✅ CHANGELOG.md updated

## 🔧 Testing the Workflow

Once you've added the `NPM_TOKEN` secret, you can test by:

1. Merging a PR with a conventional commit message
2. Watch the workflow run in **Actions** tab
3. Check npm for the new version
4. Check **Releases** on GitHub

## 📚 More Information

See `.github/workflows/README.md` for detailed documentation.

---

**Ready to use!** Just add the NPM_TOKEN secret and merge your next PR. 🚀
