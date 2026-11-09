# Email setup (new enquiry alert to you, plus an automatic reply to the visitor)

Uses Resend (resend.com, free tier available) and a Supabase Edge Function.

1. Create a Resend account. Add and verify your domain (Domains > Add domain, then add the DNS records it shows).
   Until a domain is verified you can only send to your own email, which is fine for a first test.
2. Resend > API Keys > create a key.
3. Install the Supabase CLI (https://supabase.com/docs/guides/cli) and run, in this folder's parent:
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
4. Set the secrets (change the values):
   supabase secrets set RESEND_API_KEY=re_xxx WEBHOOK_SECRET=any-long-random-text OWNER_EMAIL=you@yourdomain.com MAIL_FROM="Ashgrove Construction <hello@yourdomain.com>" REPLY_WINDOW="two working days"
5. Deploy the function (it checks the webhook secret itself, so turn off JWT check):
   supabase functions deploy notify-enquiry --no-verify-jwt
6. Supabase dashboard > Database > Webhooks > Create a new hook:
   - Table: contacts, Events: Insert
   - Type: Supabase Edge Functions, choose notify-enquiry
   - Add an HTTP header: x-webhook-secret = the same WEBHOOK_SECRET
7. Send a test enquiry from the Contact page. You should get the alert, and the visitor gets the reply.
   If nothing arrives, check Edge Functions > notify-enquiry > Logs.

Sign up confirmation emails are separate: Authentication > Emails. For real use, set your own SMTP there
(Authentication > Emails > SMTP Settings, host smtp.resend.com, port 465, user resend, password your API key),
because Supabase's built in sender is limited to a few emails per hour.
