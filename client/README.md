# Marks Analysis (React + Vite)

Simple student marks analysis app.

Features:
- Login (teacher/student) — simple local auth stored in localStorage
- Teacher view: add/edit/delete weekly tests
- Student view: read-only
- Weekly and monthly averages per subject and overall

Getting started (Windows PowerShell):

```powershell
cd d:\coding\marksAnalys
npm install
npm run dev
```

Default accounts seeded in localStorage:
- teacher / teacher (role: teacher)
- student / student (role: student)

Notes:
- Data persists in localStorage of your browser.
- This is intentionally minimal; improvements: real auth, charts, CSV import/export.
