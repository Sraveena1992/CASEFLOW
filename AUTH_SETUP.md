# CASEFLOW secure authentication rollout (not yet deployed)

This commit adds a Node/Express API and PostgreSQL data model. It does NOT make the existing Render static site secure by itself. Deploy and test a new Node web service before switching the public URL. No Anna publish was performed.

## Deployment approach

Create a NEW Render Web Service first so the current live prototype remains available for rollback. Connect this GitHub repository and set:

- Runtime: Node
- Build command: npm install
- Start command: npm start
- Health check path: /api/health

Create a Render PostgreSQL database and set these service environment variables:

- NODE_ENV=production
- DATABASE_URL = Render's internal database URL
- SESSION_SECRET = at least 32 random bytes, generated privately
- ADMIN_EMAIL = initial administrator email
- ADMIN_PASSWORD = unique initial password, 12–128 characters
- COMPANY_INVITE_CODE = a privately generated random code of at least 16 characters; share only with intended company Account Managers
- ALLOWED_EMAIL_DOMAIN = approved work-email domain(s), comma-separated if needed, e.g. `example.com, subsidiary.example.com` (do not include `@`)
- SMTP_HOST, SMTP_PORT (usually 587), SMTP_SECURE (usually false for STARTTLS), SMTP_USER, SMTP_PASS, MAIL_FROM = credentials for an email provider that can send verification messages
- APP_BASE_URL = the exact public base URL of this Node service, e.g. `https://your-new-service.onrender.com`

Do not commit secrets or share them in chat. Keep the initial password in Render environment settings only. After first successful login, remove ADMIN_PASSWORD from the service environment; the database account remains. The server only provisions the initial owner/Admin when no administrator exists; user-management APIs can create Account Managers only, and the database enforces a single Admin role. Set ADMIN_EMAIL to the actual company owner's email before first boot; this environment bootstrap alone does not independently verify the person's identity.

## Roles and access rules

- Company Owner (Admin): the single owner account bootstrapped from ADMIN_EMAIL and ADMIN_PASSWORD; view all cases; create/deactivate Account Manager users; assign cases; view all case records and history. Admin creation/promotion through the user-management API is blocked.
- Account Manager: create cases and view/edit only cases owned by their account; add evidence and view history for those cases. They cannot provision users or access another manager's case by changing an ID.
- Authentication: PostgreSQL-backed server sessions; HttpOnly cookie; Secure cookie in production; SameSite=Lax; session ID regeneration after login; Argon2id password hashes; rate limits; Helmet security headers; parameterized SQL.
- Account Manager onboarding: `/signup.html` accepts work email, password and company invite code; a one-time verification link is emailed and expires in 30 minutes. Pending verification tokens and the invite code are stored as hashes. Signup also requires an exact match to one of the configured `ALLOWED_EMAIL_DOMAIN` domains. Public registration can create only Account Manager accounts; it cannot set or promote Admin. Invite code is initially seeded once from the private `COMPANY_INVITE_CODE` environment variable; changing that variable later does not rotate the stored code.
- Data isolation: authorization is enforced on the API, not by hiding browser buttons. Cases, evidence, and history are stored in PostgreSQL, not localStorage.

## API routes currently scaffolded

- GET /api/auth/csrf — retrieve a CSRF token before login or a state-changing request\n- POST /api/auth/register — JSON body with email, password and inviteCode plus X-CSRF-Token header
- GET /api/auth/verify-email?token=... — consumes a one-time verification link
- POST /api/auth/login — JSON body with email and password plus X-CSRF-Token header
- POST /api/auth/logout
- GET /api/auth/me
- GET /api/cases and POST /api/cases
- GET /api/cases/:id and PATCH /api/cases/:id\n- PATCH /api/cases/:id/assignment — admin-only; assign to an active Account Manager
- POST /api/cases/:id/evidence
- GET /api/admin/users, POST /api/admin/users, PATCH /api/admin/users/:id

## Required work before public cutover

1. Verify the new service's health check and initial administrator sign-in.
2. Configure SMTP and COMPANY_INVITE_CODE in private service settings. Open `/signup.html`, register with a test work mailbox and invite code, and verify the email link expires and cannot be reused. Verify registration cannot create an Admin.
3. Verify that a registered Account Manager cannot call `/api/admin/users`.
4. Create a case under Manager A; log in as Manager B and verify the case is absent and direct GET/PATCH requests return 404.
5. Verify unauthenticated case requests return 401, invalid passwords are rate-limited, and logout invalidates the session.
6. The API now checks CSRF tokens on login and state-changing routes. Test token rotation after login, invalid-token rejection, and logout.
7. The signup UI is added at `/signup.html`; the main dashboard/login and case workflows are NOT yet fully wired to the authenticated API. Replace the existing localStorage-only case workflow with these API calls before cutover.
8. Test evidence, history, human-confirmed state transitions, mobile layout, and Anna-host compatibility. Switch the public Render URL only after acceptance.

## Scope and security notes

This is a backend foundation, not a claim that CASEFLOW is already production-ready. Before sensitive or regulated case data is used, add tested CSRF protection, password reset/MFA, audit retention policy, backups and restore drills, dependency scanning, and security tests. File uploads require separate malware-scanned object storage and are not implemented by these routes. The current server scaffold has not yet been deployed or end-to-end tested.


## Current onboarding limits

This version is a single-company deployment design. The invite code is a shared secret and should be distributed only to intended colleagues; if leaked, anyone with access to the code and an email inbox can request an Account Manager account. Email verification proves control of the mailbox, not independently that the address is an approved corporate domain. The invite code is not yet rotatable from an owner dashboard, and signup email delivery, expiry, duplicate handling and rate limits require live tests. Do not deploy or use for sensitive cases until these checks and the main dashboard API integration are complete. No Anna publish is part of this work.
