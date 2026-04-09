# GitHub Token Setup for Auto-Sync

## Step 1: Create Personal Access Token (PAT)

1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Give it a name: `Company Dashboard Sync`
4. Set expiration: **No expiration** (or 90 days if you prefer)
5. Select scopes: **ONLY `repo`** (full control of private repositories)
6. Click **"Generate token"**
7. **COPY THE TOKEN IMMEDIATELY** (you won't see it again!)

## Step 2: Add Token to Dashboard

1. Open the dashboard: `https://blead87.github.io/company-dashboard/`
2. In the **GitHub Sync** panel (right sidebar):
   - Paste token in "GitHub Personal Access Token" field
   - Click **Save** (disk icon)
3. Token is saved in your browser's local storage

## Step 3: Test Sync

1. Click **"Sync Now"** button
2. You should see: `✅ Synced to GitHub`
3. Check the repo: https://github.com/blead87/company-dashboard/todos.json

## How Auto-Sync Works

### **Push (Local → GitHub)**
- Happens automatically when you:
  - Add/edit/delete tasks
  - Check/uncheck tasks
  - Change any todo data
- Debounced: Waits 1 second after last change
- Commits with message: `Auto-sync: [timestamp]`

### **Pull (GitHub → Local)**
- Happens automatically:
  - On dashboard load (if token set)
  - Every 2 minutes
  - When you click "Sync Now"
- Remote data overwrites local (simple "last write wins")

### **Two-Way Sync**
"Sync Now" button does:
1. Pull latest from GitHub
2. Push local changes to GitHub

## Security Notes

- Token is stored in **browser local storage** (not cookies)
- Token only has access to `blead87/company-dashboard` repo
- Token can be revoked anytime at https://github.com/settings/tokens
- Dashboard is public GitHub Pages; token stays in your browser

## Troubleshooting

### "Sync failed" error
1. Check token has `repo` scope
2. Check token hasn't expired
3. Try generating a new token

### "Sync error" (network)
1. Check internet connection
2. Try again in a few seconds
3. Use "Pull from GitHub" / "Push to GitHub" separately

### Data conflicts
- Simple strategy: GitHub data wins on pull
- If you lose local changes, check GitHub commit history
- Manual fix: Edit `todos.json` directly in GitHub

## Revoking Access

To disable auto-sync:
1. Go to https://github.com/settings/tokens
2. Find "Company Dashboard Sync" token
3. Click **"Delete"**
4. Refresh dashboard - sync will stop working