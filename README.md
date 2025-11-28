# Marks Analysis — Mono-repo

This repository now contains two separate sub-projects:

- client/  — React + Vite frontend
- server/  — Node.js + Express backend

How to run locally

Backend (server):
```powershell
cd server
npm install
npm start       # production-style start (or `npm run dev` for nodemon)
```

Frontend (client):
```powershell
cd client
npm install
npm run dev     # start Vite dev server
```

Deploy
- Frontend: deploy `client/` to Vercel
- Backend: deploy `server/` to Render
