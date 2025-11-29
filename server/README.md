# Marks Analysis - Backend

Minimal Express + MongoDB backend for the Marks Analysis app.

Features:
- Signup & login with JWT
- CRUD for tests (teacher role required for writes)

Setup (Windows PowerShell):

```powershell
cd d:\coding\marksAnalys\server
copy .env.example .env
# Edit .env and set MONGO_URL (the provided URI is already in .env.example)
npm install
npm run dev
```

Endpoints:
- POST /api/auth/signup { username, password, role }
- POST /api/auth/login { username, password }
- GET /api/tests (requires Authorization: Bearer <token>)
- POST /api/tests (teacher only)
- PUT /api/tests/:id (teacher only)
- DELETE /api/tests/:id (teacher only)

Notes:
- Replace `JWT_SECRET` with a strong secret in production.
- The provided connection string can be put into `MONGO_URL` in `.env`.
