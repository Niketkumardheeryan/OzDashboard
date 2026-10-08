# Infurnia Partner Network (Ozone)

Static dashboard (`index.html`) plus a tiny API that stores the full partner list on Vercel.

## Deploy on Vercel

1. Push this folder to GitHub.
2. Import the repo in [Vercel](https://vercel.com/new).
3. In the Vercel project: **Storage → Create → KV** (Redis), then **Connect** it to the project.  
   This sets `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.
4. Deploy once, then **connect Redis**, then **Redeploy** (required so `/api/partners` gets `KV_REST_*` env vars).
5. Open your site — the badge should say partners are on the server. Add a partner, edit an existing one, or remove one, then refresh. All three should remain.

If partners vanish on refresh, storage is not connected yet or you did not redeploy after connecting Redis.

The first 23 partners start in the page. The first successful save stores the full list in Redis. Later deploys read that saved list, so creates, updates, and deletes are not replaced by the original page data.

## Optional

- **Export to Excel**: use **Save to Excel** in the header (download only; does not update the server).
- **Local dev**: `npx vercel dev` (with KV linked or env vars in `.env.local`).
