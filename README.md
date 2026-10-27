# Dell + HP Activation Price List

Responsive public price-list website with a restricted admin dashboard.

## Features

- Dell and HP product catalogs, search, brand and category filters
- Billing price, offer price, SRP, effective SRP, offer dates and notes
- Automatic offer status and discount percentage
- Admin login and add/edit/delete product operations
- Supabase Row Level Security (RLS) policies protect all writes
- Vite + React frontend suitable for GitHub Pages

## Architecture and security

- **GitHub Pages** serves the static frontend.
- **Supabase Auth** authenticates admins.
- **Supabase Postgres + RLS** stores products and enforces write access.
- The frontend uses only the Supabase publishable/anon key. This key is intended to be public when RLS is configured correctly.
- **Never** put a Supabase `service_role` key, GitHub token, or admin password in frontend code, `.env` committed to Git, or GitHub Actions variables that are exposed to client builds.
- An account is allowed to administer products only when its trusted JWT `app_metadata.role` is `admin`. The browser cannot securely grant this role to itself.

## 1. Create the Supabase project

1. Create a project at https://supabase.com/.
2. In the project dashboard, open **SQL Editor**.
3. Run all of [`supabase/schema.sql`](supabase/schema.sql).
4. Open **Project Settings → API** (or the API keys page) and copy the project URL and publishable key (or legacy anon key). Do not copy the service-role/secret key.
5. In **Authentication → Providers**, ensure Email/password sign-in is enabled.
6. In **Authentication → URL Configuration**, add your deployed GitHub Pages URL to the allowed redirect URLs if required.

## 2. Create an admin account securely

1. In **Authentication → Users**, create the admin user with an email and a strong password. Disable public sign-ups if you do not need user registration.
2. Assign the trusted custom claim `app_metadata.role = "admin"` to that user using a trusted administrative method.
3. Refresh the user's session after assigning the role (sign out and sign back in).

**Important:** Do not set the role from browser code or user-editable `user_metadata`. Supabase's dashboard UI for app metadata can vary. If your dashboard does not let you set app metadata directly, use a trusted server-side Admin API script with the service-role key, run locally and never commit it. Example below.

### Optional one-time local Node script to assign the admin role

Create `scripts/set-admin-role.mjs` locally (do not commit it) with:

```js
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL;
if (!url || !serviceRoleKey || !email) throw new Error("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and ADMIN_EMAIL");

const adminClient = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
if (listError) throw listError;
const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
if (!user) throw new Error("Admin user not found. Create it in Supabase first.");
const { error } = await adminClient.auth.admin.updateUserById(user.id, {
  app_metadata: { ...user.app_metadata, role: "admin" }
});
if (error) throw error;
console.log(`Admin role assigned to ${email}. Sign out and sign back in.`);
```

Run this locally only after creating the user:
```bash
npm install @supabase/supabase-js
SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="YOUR_SECRET_SERVICE_ROLE_KEY" \
ADMIN_EMAIL="admin@example.com" node scripts/set-admin-role.mjs
```
On Windows PowerShell, set the three environment variables with `$env:NAME="value"` before running `node scripts/set-admin-role.mjs`. Never upload the script or secret key.

## 3. Configure and run locally

Install Node.js 20 or newer, then:

```bash
npm install
cp .env.example .env
```

Edit `.env`:
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

Then start the site:
```bash
npm run dev
```
Open the local URL printed by Vite. On Windows, copy `.env.example` to `.env` manually if `cp` is unavailable.

## 4. Push to your existing GitHub repository

1. Extract this project ZIP.
2. Copy the project files into your existing repository. If the repository already has a site, back it up before replacing files.
3. Add `.env` to `.gitignore` (it is already ignored). Never commit `.env`.
4. Commit and push the files to your default branch.

Example from the extracted project folder:
```bash
git init
git add .
git commit -m "Build Dell and HP activation price list"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```
If using an existing clone, do not run `git init` or add a second remote; copy files into the existing working directory and commit normally.

## 5. Deploy on GitHub Pages

Recommended simple setup:

1. In the GitHub repository, open **Settings → Pages**.
2. Set **Build and deployment → Source** to **GitHub Actions**.
3. Add the GitHub Actions workflow below as `.github/workflows/deploy.yml`.
4. In repository **Settings → Secrets and variables → Actions → Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (publishable/anon key; not the service role key)
5. Push to the configured branch. The workflow builds and publishes `dist/`.

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy price list to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm install
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ vars.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ vars.VITE_SUPABASE_ANON_KEY }}
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

This project uses `base: "./"` so it can be served from a GitHub Pages project URL. If your repo uses a custom build setup, preserve that relative base or configure Vite's `base` for your exact repository path.

## 6. Final checks before using it

- Confirm the public catalog loads while signed out.
- Confirm a signed-out visitor cannot insert, edit or delete a product (RLS enforces this even if they call the API directly).
- Confirm a normal authenticated user without `app_metadata.role = admin` cannot edit.
- Confirm the admin can add, edit and delete products.
- Test offer start/end dates and mobile layout.
- Use a strong unique admin password and enable MFA on the admin email account where possible.

## Notes

- Public visitors see active products only. Admins can also see inactive products while signed in.
- Offer status is calculated in the browser using the visitor's current date. Confirm business timezone requirements if offers must follow a specific local timezone.
- Price values are manually entered; this starter does not automatically import vendor pricing.
- This starter is a repository-ready implementation, but it is not deployed to your repository yet. Provide your existing GitHub repository URL to adapt the workflow and give exact deployment steps.
