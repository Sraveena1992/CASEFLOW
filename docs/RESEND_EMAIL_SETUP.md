# CASEFLOW email verification with Resend

The staging signup flow sends verification emails through the Resend HTTPS API. It no longer uses Gmail SMTP, so it does not need outbound SMTP ports.

## Configure Render (staging only)

1. Create/sign in to a Resend account at https://resend.com/.
2. In Resend, add a domain you control and complete the DNS verification steps Resend shows.
3. Create a Resend API key. Keep it private; never commit it or paste it into chat.
4. In Render, open the **caseflow-staging** Web Service → **Environment** and add:
   - `RESEND_API_KEY`: the API key from Resend
   - `MAIL_FROM`: a sender such as `CASEFLOW <verify@your-verified-domain.example>`, replaced with an address on your verified domain
5. Keep `APP_BASE_URL=https://caseflow-staging.onrender.com` and the existing database/auth variables unchanged.
6. After successful testing, remove old `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, and `SMTP_PASS` variables; the app no longer reads them.
7. Wait for the Render deploy to finish, then test signup with a permitted email domain and valid company invite code. Check inbox and spam folder.

## Important

- Do not use a fake sender domain; Resend requires a verified sender/domain for normal delivery.
- A Resend API key is a secret. Store it only in Render Environment.
- The verification link expires after 30 minutes.
- If signup fails, check Render Logs for the HTTP status/provider error. A successful API response means Resend accepted the message, not necessarily that it reached the recipient's inbox.
- This integration is intended for `staging-auth-integration`; do not apply it to `main` until staging has been tested.
