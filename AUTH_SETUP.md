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

Do not commit secrets or share them in chat. Keep the initial password in Render environment settings only. After first successful login, remove ADMIN_PASSWORD from the service environment; the database account remains. The server only provisions the initial admin when no administrator exists.

## Roles and access rules

- Admin: view all cases; create/deactivate users; assign admin or account_manager role; view all case records and history.
- Account Manager: create cases and view/edit only cases owned by their account; add evidence and view history for those cases. They cannot provision users or access another manager's case by changing an ID.
- Authentication: PostgreSQL-backed server sessions; HttpOnly cookie; Secure cookie in production; SameSite=Lax; session ID regeneration after login; Argon2id password hashes; login rate limiting; Helmet security headers; parameterized SQL; no public sign-up.
- Data isolation: authorization is enforced on the API, not by hiding browser buttons. Cases, evidence, and history are stored in PostgreSQL, not localStorage.

## API routes currently scaffolded

- GET /api/auth/csrf — retrieve a CSRF token before login or a state-changing request\n- POST /api/auth/login — JSON body with email and password plus X-CSRF-Token header
- POST /api/auth/logout
- GET /api/auth/me
- GET /api/cases and POST /api/cases
- GET /api/cases/:id and PATCH /api/cases/:id\n- PATCH /api/cases/:id/assignment — admin-only; assign to an active Account Manager
- POST /api/cases/:id/evidence
- GET /api/admin/users, POST /api/admin/users, PATCH /api/admin/users/:id

## Required work before public cutover

1. Verify the new service's health check and initial administrator sign-in.
2. Create an Account Manager through the admin-only route; verify that account cannot call /api/admin/users.
3. Create a case under Manager A; log in as Manager B and verify the case is absent and direct GET/PATCH requests return 404.
4. Verify unauthenticated case requests return 401, invalid passwords are rate-limited, and logout invalidates the session.
5. The API now checks CSRF tokens on login and state-changing routes. Test token rotation after login, invalid-token rejection, and logout.
6. Connect the UI login screen and replace the existing localStorage-only case workflow with these API calls. The current UI remains a static/local prototype until this integration is complete.
7. Test evidence, history, human-confirmed state transitions, mobile layout, and Anna-host compatibility. Switch the public Render URL only after acceptance.

## Scope and security notes

This is a backend foundation, not a claim that CASEFLOW is already production-ready. Before sensitive or regulated case data is used, add tested CSRF protection, password reset/MFA, audit retention policy, backups and restore drills, dependency scanning, and security tests. File uploads require separate malware-scanned object storage and are not implemented by these routes. The current server scaffold has not yet been deployed or end-to-end tested.
