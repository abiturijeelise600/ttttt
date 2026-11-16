# Climate Forward

A complete React + Vite climate awareness website with a climate estimator, user registration/login, Supabase-synced action pledges, user profiles and an admin dashboard.

## Setup

1. Run `supabase/schema.sql` in the Supabase SQL Editor.
2. Copy `.env.example` to `.env.local`; enter your Supabase project URL and public publishable key. Never use a `service_role` or secret key in this frontend.
3. Run `npm install` then `npm run dev`. Set the same environment variables in Vercel and redeploy. Configure Supabase Auth email confirmation and allowed redirect URLs for your deployed domain.
4. Register the intended administrator account through the app. Then run the admin promotion statement at the end of `supabase/schema.sql` in the SQL Editor. Admin status is database-controlled and protected by RLS.

Do not put passwords in source code or commit them. A password shared in chat should be changed immediately; use a unique password and enable MFA for the administrator.

## Commands

```bash
npm install
npm run dev
npm run build
```

WhatsApp contact shown on the site: +250 796 365 450. The emissions estimate is illustrative, not an official carbon-footprint calculation.
