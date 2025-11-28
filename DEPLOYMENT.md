# Deployment guide

This repository contains a Vite React frontend in `client/` and a Node/Express backend in `server/`.

Recommended approach:
- Deploy the frontend to Vercel (static build).
 - Deploy the backend to a separate host (Render, Railway, Fly, Heroku, etc.) and set `MONGO_URL` and `JWT_SECRET` there.

Vercel setup (frontend):
1. In Vercel, import repository `abdulhaqkhatai/habbu`. When Vercel asks for a Root Directory, set it to `client` so Vercel builds the frontend.
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

   Render deployment step-by-step (backend)
   1. In Render, click "New" → "Web Service".
   2. Connect to GitHub and select repository `abdulhaqkhatai/habbu`.
   3. For the service root directory, enter `server` (this tells Render to use server/package.json).
   4. Branch: main (or whichever branch).
   5. Build Command: leave empty (Render will run `npm install`).
   6. Start Command: `npm start` (this runs `node server.js` in the `server/` directory).
   7. Environment variables to set on Render:
      - MONGO_URL → your MongoDB Atlas URI (example: mongodb+srv://user:pass@cluster0.mongodb.net/marksdb)
      - JWT_SECRET → a secure random string
      - CLIENT_URL → your Vercel frontend URL (example: https://your-frontend.vercel.app)
   8. Deploy and wait until the service shows a public URL (example: https://my-backend.onrender.com).


CORS and API base:
- Ensure the backend allows requests from your Vercel domain (or leave CORS open).
 - Point `VITE_BACKEND_URL` in Vercel to your backend public URL.

Notes:
- `.vercelignore` should include `server/` so Vercel won't try to deploy the backend there.
- `vercel.json` added to specify static build and SPA routing.

Local test commands:
```powershell
# run frontend locally
cd client
npm install
npm run dev

# run backend locally
cd server
npm install
npm run dev

# build and preview frontend
cd client
npm run build
npm run preview
```

If you want, I can connect the repo to Vercel, set environment variables, and verify a deployment.
