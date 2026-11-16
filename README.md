# Climate Forward

Complete React + Vite climate awareness website with a carbon estimator, Supabase email/password registration and login, cloud-synced pledges, user profiles, and a role-protected admin dashboard.

## Setup
1. Run `supabase/schema.sql` in the Supabase SQL Editor.
2. Copy `.env.example` to `.env.local`; add your Supabase URL and public publishable key. Never expose a `service_role` or secret key in frontend code.
3. Run `npm install` and `npm run dev`. Set the same environment variables in Vercel and redeploy. Configure Supabase Auth email confirmation and allowed redirect URLs for localhost and production.
4. Register the administrator account through the app; then run the promotion SQL at the end of `supabase/schema.sql` in Supabase SQL Editor. The database role and RLS determine admin access, not an email check in the browser.

Never commit a password. The password previously shared in chat should be changed immediately; use a unique password and enable MFA. The WhatsApp contact link is +250 796 365 450.

```bash
npm install
npm run dev
npm run build
```
