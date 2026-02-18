# Netlify Deployment Guide - TaskFlow

## Prerequisites
- Netlify account (free tier available at https://netlify.com)
- GitHub repository pushed with the Netlify configuration files
- Supabase project with connection credentials

## Step-by-Step Deployment

### 1. Push Code to GitHub
```bash
cd c:\Projects\PM
git add .
git commit -m "Add Netlify configuration"
git push origin temp  # or your branch name
```

### 2. Create Netlify Site
1. Go to https://app.netlify.com
2. Click "Add new site" > "Import an existing project"
3. Select GitHub and authorize Netlify
4. Choose your `Kristiyan-Kiryakov90/PM` repository
5. Select the branch you want to deploy (e.g., `main` or `temp`)

### 3. Configure Build Settings
Netlify should auto-detect your `netlify.toml`, but verify:
- **Build command**: `cd frontend && npm install && npm run build`
- **Publish directory**: `dist`
- **Base directory**: (leave empty)

### 4. Set Environment Variables
In Netlify dashboard:
1. Go to **Site settings** > **Build & deploy** > **Environment**
2. Add these variables:

| Variable | Value |
|----------|-------|
| VITE_SUPABASE_URL | `https://zuupemhuaovzqqhyyocz.supabase.co` |
| VITE_SUPABASE_ANON_KEY | (from frontend/.env) |
| VITE_APP_URL | `https://your-site-name.netlify.app` |

**Important**: Replace `your-site-name` with your actual Netlify site name.

### 5. Update Supabase CORS Settings
To allow requests from your Netlify domain:
1. Go to Supabase dashboard
2. Project settings > API
3. Add to "Additional Redirect URLs":
   ```
   https://your-site-name.netlify.app
   ```

### 6. Update Your App URL (Optional but Recommended)
After deployment is successful, you may want to update:
- `frontend/.env` - VITE_APP_URL for local development
- `frontend/vite.config.js` - CSP headers if needed for new domain

### 7. Trigger Deploy
Netlify auto-deploys on push to the configured branch. Or manually:
1. Site settings > **Deploys**
2. Click "Trigger deploy" > "Deploy site"

## Deployment Checklist

- [ ] `netlify.toml` exists in project root
- [ ] `frontend/public/_redirects` exists
- [ ] Code pushed to GitHub
- [ ] Netlify site created and linked to repository
- [ ] Build settings verified (command and publish directory)
- [ ] Environment variables set in Netlify:
  - [ ] VITE_SUPABASE_URL
  - [ ] VITE_SUPABASE_ANON_KEY
  - [ ] VITE_APP_URL
- [ ] Supabase CORS settings updated
- [ ] Initial deploy completed successfully
- [ ] Test site functionality after deployment

## Monitoring & Troubleshooting

### View Deploy Status
- Site overview > **Deploys** tab shows all deployments
- Click on a deploy to see logs

### Common Issues

**"Build failed" error:**
- Check build logs in Deploys tab
- Verify environment variables are set
- Ensure `npm run build` works locally:
  ```bash
  cd frontend
  npm install
  npm run build
  ```

**Page shows "Network error" or blank:**
- Check browser console for errors (F12)
- Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are correct
- Ensure Supabase has your Netlify domain in CORS settings
- Check that Supabase project is accessible

**Redirects not working (404 on sub-pages):**
- Verify `_redirects` file exists in `frontend/public/`
- Check that `dist` folder is being built correctly
- Redeploy if file was added after initial push

## Domain Setup (Optional)

To use a custom domain:
1. Site settings > **Domain management**
2. Click "Add custom domain"
3. Follow instructions to update DNS records with your registrar
4. Netlify auto-renews SSL certificate (free)

## Performance Tips

- Netlify CDN automatically caches and serves files globally
- Static assets (JS, CSS, images) are cached for 1 year
- HTML files are never cached to ensure fresh content
- Deploy previews created for pull requests

## Next Steps

1. Verify all pages load correctly (auth, dashboard, projects, tasks, admin)
2. Test authentication flow (signup, signin)
3. Test project and task management features
4. Monitor Netlify Analytics (optional)
5. Set up automatic deployments (happens by default on push)

---

**For questions or issues**, check:
- Netlify docs: https://docs.netlify.com
- Supabase docs: https://supabase.com/docs
