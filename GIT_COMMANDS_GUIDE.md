# Git Commands Guide - Push to GitHub

## Basic Workflow

### 1. Check Current Status
```powershell
git status
```
Shows which files are modified, added, or deleted.

### 2. Add Files to Staging
```powershell
# Add all files
git add .

# Add specific file
git add src/server.js

# Add multiple files
git add file1.js file2.js
```

### 3. Commit Changes
```powershell
git commit -m "Description of your changes"
```
Examples:
- `git commit -m "Fixed URL verification"`
- `git commit -m "Added new feature"`
- `git commit -m "Updated database schema"`

### 4. Push to GitHub
```powershell
git push origin main
```

## Complete Example

```powershell
# Navigate to project
cd "C:\Slack Dev"

# Check what changed
git status

# Add all changes
git add .

# Commit with message
git commit -m "Fixed Slack URL verification issue"

# Push to GitHub
git push origin main
```

## Common Commands

### View Changes
```powershell
git status          # See what files changed
git diff            # See actual changes in files
git log             # See commit history
```

### Undo Changes
```powershell
# Unstage files (before commit)
git reset

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Discard changes to a file
git checkout -- filename.js
```

### Check Remote Repository
```powershell
# See remote repository URL
git remote -v

# Change remote URL (if needed)
git remote set-url origin https://github.com/username/repo.git
```

## Troubleshooting

### If push fails with authentication error:
1. GitHub no longer accepts passwords
2. Use Personal Access Token instead:
   - Go to GitHub → Settings → Developer settings → Personal access tokens
   - Generate new token
   - Use token as password when pushing

### If you get "branch is ahead" error:
```powershell
# Pull latest changes first
git pull origin main

# Then push
git push origin main
```

### If you need to force push (be careful!):
```powershell
git push origin main --force
```
⚠️ Only use if you're sure - this overwrites remote history!

## Daily Workflow

1. Make changes to your code
2. `git status` - Check what changed
3. `git add .` - Stage changes
4. `git commit -m "Description"` - Commit
5. `git push origin main` - Push to GitHub
6. Render automatically deploys (if auto-deploy is enabled)

