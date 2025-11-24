# Deployment guide

This repository contains a Vite React frontend (root) and a Node/Express backend in `server/`.

Recommended approach:
- Deploy the frontend to Vercel (static build).
- Deploy the backend to a separate host (Render, Railway, Fly, Heroku, etc.) and set `MONGO_URI` and `JWT_SECRET` there.

Vercel setup (frontend):
1. In Vercel, import repository `abdulhaqkhatai/habbu`.
2. Project settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. Environment variables (Vercel > Settings > Environment Variables):
   - `VITE_API_BASE` = `https://<your-backend-url>`
4. Deploy. Vercel will run install and build and publish the `dist` folder.

Backend deployment (separate):
- Deploy to Render/Railway/Heroku. Set these env vars on the host:
  - `MONGO_URI` = MongoDB connection string
  - `JWT_SECRET` = JWT signing secret
  - `PORT` = host default or leave unset

CORS and API base:
- Ensure the backend allows requests from your Vercel domain (or leave CORS open).
- Point `VITE_API_BASE` in Vercel to your backend public URL.

Notes:
- `.vercelignore` added to skip `server/` and `node_modules` when deploying to Vercel.
- `vercel.json` added to specify static build and SPA routing.

Local test commands:
```powershell
# run frontend locally
npm install
npm run dev

# run backend locally
cd server
npm install
npm run dev

# build and preview frontend
npm run build
npm run preview
```

If you want, I can connect the repo to Vercel, set environment variables, and verify a deployment.
