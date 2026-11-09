# Supabase setup (replaces the MySQL backend)

With Supabase you do not need the `backend` folder at all. The website talks to Supabase directly.

1. Create a project at supabase.com. Wait until it is ready.
2. SQL Editor > New query > paste `schema.sql` > Run.
3. Project Settings > API: copy the Project URL and the `anon` public key.
4. Paste them into `SB_URL` and `SB_KEY` at the top of the script in `login.html`, `signup.html` and `index.html`.
   Never use the `service_role` key in the website.
5. Authentication > Providers > Email: keep it on. For testing, turn off "Confirm email" so sign ups work at once.
   Authentication > URL Configuration: set Site URL to your Vercel address.
6. Open signup.html on your site and sign up with your own email. Then run in the SQL Editor:
   update public.profiles set role = 'admin' where email = 'you@yourdomain.com';
7. Sign in at index.html#admin with that email and password. Enquiries and sign ups now come live from Supabase.

Daily backups: Supabase takes them on paid plans (Database > Backups). On the free plan, use the CSV button on the admin page.
