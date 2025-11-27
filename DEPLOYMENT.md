# Deployment guide

This repository contains a Vite React frontend (root) and a Node/Express backend in `server/`.
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
   - `VITE_BACKEND_URL` = `https://<your-backend-url>` (the public URL of your deployed backend API on Render).
4. Deploy. Vercel will run install and build and publish the `dist` folder.

Backend deployment (Render):
- Deploy the backend in the `server/` folder to Render as a Node service.
   Set these environment variables on Render:
   - `MONGO_URL` = your MongoDB Atlas connection string (preferred; otherwise an in-memory DB will be used which is NOT persistent).
   - `JWT_SECRET` = your JWT signing secret (long random string).
   - `CLIENT_URL` = your Vercel frontend URL (e.g. https://your-project.vercel.app) — used for CORS.
   - (PORT is provided by Render automatically; server defaults to 5000 if not set.)

CORS and API base:
- Ensure the backend allows requests from your Vercel domain (or leave CORS open).
 - Point `VITE_BACKEND_URL` in Vercel to your backend public URL.

Notes:
- `.vercelignore` should include `server/` so Vercel won't try to deploy the backend there.
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
