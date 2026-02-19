# One Less Thing — MVP

Minimal MVP that reads weather and suggests outfit tiles.

Quick start

1. Copy `.env.example` to `.env` and set `OPENWEATHER_API_KEY`.
2. Install and run:

```bash
npm install
npm run dev
```

3. Open http://localhost:3000 and enter a city to get outfit tiles.

Notes and next steps
- Affiliate linking: MVP uses Amazon search links as placeholders.
- Future: user profiles, vendor OAuth linking, persistent storage, improved UI, images for tiles.

Hosting on onelessthing.life
- You can host this Node app on any server supporting Node 18+ or adapt frontend into a static site and use serverless functions for the API. If you want, I can prepare a deployment guide for your hosting provider.
