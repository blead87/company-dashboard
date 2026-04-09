# Enable GitHub Pages

To make the dashboard accessible at `https://blead87.github.io/company-dashboard/`:

## Manual Steps (via GitHub Web UI):

1. Go to: https://github.com/blead87/company-dashboard/settings/pages
2. Under "Source", select:
   - **Branch:** `master`
   - **Folder:** `/` (root)
3. Click **Save**
4. Wait 1-2 minutes for deployment

## After enabling:
- Dashboard will be available at: `https://blead87.github.io/company-dashboard/`
- It may take a few minutes to become active
- You can check status at: https://github.com/blead87/company-dashboard/deployments

## Alternative: Use GitHub CLI
```bash
gh api -X POST /repos/blead87/company-dashboard/pages \
  -f source.branch=master \
  -f source.path=/
```

## Testing:
Once enabled, visit: https://blead87.github.io/company-dashboard/

The dashboard should load with:
- Sample todo items
- Company tabs (Oorban, MFC, Legnofino, Penalma, Personal)
- Add/delete/complete functionality
- Mobile-responsive design