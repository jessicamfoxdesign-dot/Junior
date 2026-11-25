# Junior

A sourdough starter's diary: snap the jar and it reads the rise level, log feedings,
and work out levain builds and dough by baker's percentages.

Live at https://junior.jessicafoxdesign.com (ICDSoft, folder `www/junior`).

## Where things live
- **Database, sign-in, photos and the AI reader:** the Kitchen Compass Supabase project
  (`skwxknqanuviigzkaycz`). Junior moved there from Garden Life's project on 2026-11-25.
- **Sign-in:** Google, limited to the Kitchen Compass household list (`allowed_emails`).
  Each person's starter is private to them, even inside the household.
- **Tables:** everything is named `sourdough_*`. See
  `supabase/migrations/20261125140000_junior_in_kitchen_compass.sql`.
- **AI:** `supabase/functions/read-starter-level` reads a jar photo with Claude (Anthropic only).
  Needs the secret `ANTHROPIC_API_KEY` on the Kitchen Compass project. Counts toward a daily
  limit of 50 calls per person (`claim_ai_use`).

## Build and upload
```sh
npm ci
npm test
npm run build
```
Upload the contents of `dist/` (including `.htaccess`) to `www/junior`.
`.env` holds only the project URL and the publishable key, which are public by design.

## Deploying database or function changes
The Kitchen Compass project has no automatic deploy from GitHub. Apply migrations and deploy the
function through the Supabase dashboard or CLI (`supabase db push`, `supabase functions deploy read-starter-level`).
