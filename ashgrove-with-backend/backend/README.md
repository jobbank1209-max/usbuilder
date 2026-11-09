# Ashgrove backend: sign up, contact form and email replies

A browser page cannot talk to MySQL safely, so this small Node server sits between the site and the database.
It stores sign ups and enquiries in MySQL, sends the visitor an automatic email reply and sends you a notification.

## 1. Create the database
    mysql -u root -p < schema.sql
Then create a limited user (the commented lines at the bottom of `schema.sql`).

## 2. Configure
    cp .env.example .env
Fill in the database login, the SMTP login (your host, Brevo, Mailgun, SES or a Gmail app password),
`OWNER_EMAIL` (where enquiries arrive) and `ALLOWED_ORIGIN` (your website address).

## 3. Run
    npm install
    npm start
Check http://localhost:3000/api/health returns `{"ok":true}`.

## 4. Connect the site
In the site's script, set:
    var API_BASE='https://api.yourdomain.com';
The sign up page and the estimate form then post to `/api/signup` and `/api/contact`.

## Hosting and safety
- Host the server on anything that runs Node (a VPS, Render, Railway, Fly). Serve it over HTTPS.
- Passwords are hashed with bcrypt, never stored in plain text. Database and email logins stay in `.env`, never in the website.
- Requests are rate limited and the contact form has a hidden bot trap field.
- Replies are sent from `MAIL_FROM`. Use an address on your own domain and set up SPF and DKIM with your email provider so replies do not land in spam.
- This sets up sign up only. Add sign in, email confirmation and password reset before relying on accounts.


## Admin page

The website has an admin page at `#admin`. It lists enquiries and sign ups, and lets you mark enquiries as replied.

1. Add `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` and `ADMIN_SECRET` to `.env` (see `.env.example`).
2. Restart the server. Sign in on the admin page with that email and password.
3. Sign ins last 8 hours and are limited to 8 tries per 15 minutes.

Without `API_BASE` set in the website, the admin page runs in demo mode with sample data (email `admin@ashgrove.example`, password `demo1234`). Demo mode is not secure and is only for previewing the design.


## Customer login

`login.html` signs customers in with a username (or email) and password. It calls `POST /api/login`, which returns a token valid for 7 days, and `GET /api/me` to read the signed in account. It needs `ADMIN_SECRET` in `.env` (the same secret signs admin and customer tokens, but they cannot be used for each other). Sign up now asks for a username. If your users table already exists, run the ALTER statements at the bottom of `schema.sql`.

Without `API_BASE` set, the login page runs in demo mode (username `demo`, password `demo1234`).
