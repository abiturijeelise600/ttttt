# Climate Forward

Complete React + Vite climate awareness website with a simple emissions estimator, Supabase email/password registration and login, user profiles, cloud-synced climate pledges, and a role-protected admin dashboard.

## Setup
1. Run `supabase/schema.sql` in the Supabase SQL Editor.
2. Copy `.env.example` to `.env.local`; add your Supabase URL and public publishable key. Never expose a `service_role` or secret key in this frontend.
3. Run `npm install` then `npm run dev`. Set the same environment variables in Vercel and redeploy. Configure Supabase Auth redirect URLs and email confirmation.
4. Register the intended admin through the app, then run the commented admin-promotion SQL in Supabase SQL Editor. Admin is assigned by database role and RLS, not a client-side email check.

Do not commit passwords. The password previously shared in chat should be changed immediately; use a unique password and enable MFA. WhatsApp contact: +250 796 365 450. The estimate is illustrative, not official.

```bash
npm install
npm run dev
npm run build
```
