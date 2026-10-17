# CampusConnect

A website for college students to post **lost items**, **found items**, and **study resources** (books/notes). Owners review claims before contact details are shown.

## Stack

| Part | Tech |
| --- | --- |
| Website | HTML, CSS, JavaScript (multi-page, no framework) |
| Server | Node.js + Express |
| Database | MongoDB Atlas (Mongoose) |
| Auth | JWT + bcrypt |
| Email | Nodemailer (password reset) |

## Folder layout

- `frontend/` — what students see in the browser
- `backend/` — API (login, posts, comments)

## How to run (two terminals)

**Backend**

```bash
cd backend
npm install
npm run dev
```

API: http://localhost:5000/api/health

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

Website: http://localhost:5173

Do not commit real secrets. Copy `backend/.env.example` to `backend/.env`.
