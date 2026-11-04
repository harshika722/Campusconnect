# CampusConnect

A college lost-and-found and resource-sharing web app. Students can post lost items, found items, and study resources (books, notes). Owners review claims before any contact details are shared.

**Live demo:** https://campusconnect-frontend-rust-seven.vercel.app
**API:** https://campusconnect-7xlj.onrender.com

> The backend runs on a free Render plan and sleeps when idle, so the first request after a break can take up to a minute.

## Features

- **Accounts:** sign up, log in, log out with JWT authentication and bcrypt-hashed passwords
- **Posts:** create Lost, Found, and Resource posts with location, date, price, photo URL, and tags
- **Feed:** filter by category and search by text
- **Claims:** a user can send a claim on someone else's post. Only the post owner and the claimer can see a claim
- **Privacy-first contact sharing:** the poster approves or rejects a claim, and the poster's contact is revealed only to the approved claimer
- **Dashboard:** edit, delete, and mark your own posts as resolved or reopened, and save your contact
- **Reports:** logged-in users can report a post
- **Forgot password:** emailed reset link that expires in 15 minutes and works only once
- **Email OTP verification on signup:** an account is created only after the user enters a 6-digit code sent to their email. The code expires in 10 minutes, allows 5 attempts, and is stored only as a hash

## Tech stack

| Part | Tech |
| --- | --- |
| Frontend | HTML, CSS, JavaScript (multi-page, no framework) |
| Backend | Node.js, Express |
| Database | MongoDB Atlas (Mongoose) |
| Auth | JWT, bcrypt |
| Email | Nodemailer, Brevo API |
| Hosting | Vercel (frontend), Render (backend) |

## Security

- Passwords are hashed with bcrypt and never stored in plain text
- Protected routes check the JWT; edit, delete, status change, and claim decisions are enforced on the server and return 403 for non-owners
- An owner cannot claim their own post (rejected by the backend, not only hidden in the UI)
- Claims are visible only to the post owner and the claimer
- Password reset tokens are random, stored only as a SHA-256 hash, expire in 15 minutes, and are single-use. The forgot-password response is the same whether or not the email exists, and the endpoint is rate limited
- Signup validates its inputs: name, email, and password must be text, the email format is checked, and the password length is limited
- User text is escaped before it is rendered, which prevents HTML and script injection
- Secrets live in environment variables and `.env` is git-ignored
- Signup is verified by email OTP: details wait in a separate pending collection (password already hashed), the real account is created only after the correct code, codes are single-use, attempts and resends are limited, and a fake email cannot complete signup

## Folder layout

```
backend/
  middleware/   JWT auth check
  models/       User, Post, Comment, Report, PendingSignup
  routes/       auth, posts, comments
  utils/        mailer (Brevo API or SMTP)
  server.js
frontend/
  index.html, createpost.html, postdetail.html, dashboard.html
  login.html, signup.html, forgotpassword.html, resetpassword.html
  css/, js/
```

## API overview

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | No | Validate details and email a 6-digit code (no account yet) |
| POST | `/api/auth/signup/verify` | No | Check the code and create the account |
| POST | `/api/auth/signup/resend` | No | Send a new code (1 per minute, max 5) |
| POST | `/api/auth/login` | No | Log in, returns token |
| POST | `/api/auth/forgot-password` | No | Send reset link |
| POST | `/api/auth/reset-password` | No | Set a new password with the token |
| PATCH | `/api/auth/me` | Yes | Save own contact |
| GET | `/api/posts` | No | List posts (`category`, `search`) |
| GET | `/api/posts/:id` | No | One post |
| GET | `/api/posts/mine` | Yes | My posts |
| POST | `/api/posts` | Yes | Create post |
| PUT / DELETE | `/api/posts/:id` | Owner | Edit / delete post |
| PATCH | `/api/posts/:id/status` | Owner | Mark resolved or open |
| POST | `/api/posts/:id/report` | Yes | Report a post |
| GET / POST | `/api/posts/:id/comments` | GET: optional, POST: Yes | List / add comment or claim |
| PATCH | `/api/comments/:id/claim` | Post owner | Approve or reject a claim |
| GET | `/api/posts/:id/contact` | Approved claimer | Reveal poster's contact |

## Run locally

**1. Backend**

```
cd backend
npm install
```

Copy `.env.example` to `.env` and fill in `MONGO_URI` and `JWT_SECRET`. Then:

```
npm start
```

The API runs at `http://localhost:5000`. Without a mail provider configured, the signup code and the password reset link are printed in the backend terminal.

**2. Frontend**

Open `frontend/index.html` with the VS Code Live Server extension. On `127.0.0.1` or `localhost` the frontend automatically uses `http://localhost:5000/api`; on the deployed site it uses the Render API.
## Environment variables (backend)

| Name | Purpose |
| --- | --- |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign tokens |
| `CLIENT_URL` | Frontend address, used to build the reset link |
| `BREVO_API_KEY`, `MAIL_FROM` | Email through the Brevo API (used on Render) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | Alternative: any SMTP server |
| `TRUST_PROXY` | Set to `1` when running behind a proxy such as Render |
| `ALLOWED_EMAIL_DOMAINS` | Optional. Comma-separated domains (for example `college.edu`) to allow only college emails |

## Testing

Tested manually with multiple accounts: signup and login, post create/edit/delete, the full claim, approve, and contact-reveal flow, privacy checks (a third user cannot see claims or the contact), authorization checks (non-owners get 403), token-removal behavior, and the forgot-password flow including single-use and invalid tokens. Signup email OTP was tested with correct and wrong codes, and with an unverified signup (no account is created until the code is verified).

## Author

Harshika Tyagi — [github.com/harshika722](https://github.com/harshika722)
