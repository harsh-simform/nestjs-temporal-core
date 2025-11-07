# GitHub Actions Workflows

## Release Workflow

The `release.yml` workflow automatically publishes new versions to npm when PRs are merged to the `main` branch.

### How It Works

1. **Trigger**: Automatically runs when code is pushed to `main` (typically from a merged PR)
2. **Version Bump**: Determines the version bump type based on commit message:
   - `feat:` or `feat(scope):` → **MINOR** version bump (e.g., 3.0.12 → 3.1.0)
   - `fix:`, `chore:`, `docs:`, etc. → **PATCH** version bump (e.g., 3.0.12 → 3.0.13)
   - `feat!:` or `BREAKING CHANGE:` → **MAJOR** version bump (e.g., 3.0.12 → 4.0.0)
3. **Test**: Runs all tests to ensure quality
4. **Build**: Builds the package
5. **Publish**: Publishes to npm registry
6. **Release**: Creates a GitHub release with changelog

### Setup Requirements

#### 1. Add NPM Token to GitHub Secrets

1. Generate an NPM access token:
   ```bash
   npm login
   npm token create
   ```

2. Add the token to GitHub repository secrets:
   - Go to your repository on GitHub
   - Navigate to **Settings** → **Secrets and variables** → **Actions**
   - Click **New repository secret**
   - Name: `NPM_TOKEN`
   - Value: Your npm token
   - Click **Add secret**

#### 2. Conventional Commit Messages

Use conventional commit format for your PR titles or merge commits:

**Features (Minor Release):**
```
feat: add support for multiple workers
feat(client): add retry logic for workflow execution
```

**Fixes (Patch Release):**
```
fix: resolve memory leak in worker shutdown
fix(discovery): handle undefined activity metadata
chore: update dependencies
docs: improve README examples
```

**Breaking Changes (Major Release):**
```
feat!: redesign worker registration API
feat: new API

BREAKING CHANGE: The worker registration method has been renamed
```

### Workflow Steps

```yaml
main branch ← PR merged
  ↓
Checkout & Setup
  ↓
Run Tests
  ↓
Determine Version Bump (from commit message)
  ↓
Bump package.json version
  ↓
Update CHANGELOG.md
  ↓
Build Package
  ↓
Commit & Tag (chore: release vX.Y.Z [skip ci])
  ↓
Push to GitHub
  ↓
Publish to npm
  ↓
Create GitHub Release
```

### Skipping Releases

To push to `main` without triggering a release, add `[skip ci]` to your commit message:

```bash
git commit -m "docs: update README [skip ci]"
```

### Manual Release (if needed)

If you need to release manually:

```bash
# 1. Checkout main and ensure it's up to date
git checkout main
git pull

# 2. Run tests
npm test

# 3. Bump version (patch/minor/major)
npm version patch  # or minor, or major

# 4. Build
npm run build

# 5. Publish
npm publish --access public

# 6. Push changes and tags
git push origin main --tags
```

### Troubleshooting

**Workflow fails with "npm ERR! 403 Forbidden"**
- Verify `NPM_TOKEN` secret is set correctly
- Ensure the token has publish permissions
- Check if the token hasn't expired

**Wrong version bump type**
- Check your commit message follows conventional commit format
- The workflow looks at the **last commit** on main (usually the merge commit)
- Ensure PR titles use conventional commit format if using squash merge

**Tests fail**
- The workflow will not publish if tests fail
- Check the test logs in the Actions tab
- Fix the issues and push again

**CHANGELOG not updating correctly**
- The workflow generates changelog from commits since last tag
- If no previous tag exists, it includes all commits
- You can manually edit CHANGELOG.md after release

### Benefits

✅ **Automated**: No manual npm publish needed  
✅ **Consistent**: Version bumps follow semantic versioning  
✅ **Safe**: Tests must pass before publishing  
✅ **Documented**: Automatic changelog and GitHub releases  
✅ **Traceable**: Git tags link versions to commits  

### Example PR Flow

1. Create feature branch: `git checkout -b feat/add-health-checks`
2. Make changes and commit: `git commit -m "feat: add health check endpoint"`
3. Push and create PR: `git push origin feat/add-health-checks`
4. Merge PR to main (use "Squash and merge" with proper title)
5. **Workflow automatically**:
   - Detects `feat:` prefix
   - Bumps minor version (e.g., 3.0.12 → 3.1.0)
   - Runs tests
   - Builds package
   - Publishes to npm
   - Creates GitHub release
   - Updates CHANGELOG.md

Done! 🎉 Your package is live on npm.
