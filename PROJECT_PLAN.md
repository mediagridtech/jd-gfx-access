# Project Name: JD GFX Access Request

## 📌 Quick Links
- **Repository:** this directory (`/Users/jc/Documents/ZLA/JumpDesktopAccess`) — scaffolded 2026-07-27, not yet pushed to a git remote
- **Documentation:** [Jump Desktop OpenAPI Reference](https://jumpdesktop.com/openapi/#section/FAQ)
- **Staging/Production:** TBD
- **Issue Tracker:** TBD
- **Slack Workflow:** "JD GFX Access Request" (built in Slack Workflow Builder — see screenshot reference)
- **Jump Desktop Teams:**
  - NY — `ZNYGFX Users` — https://app.jumpdesktop.com/dashboard/teams/T-01GW30D3R7T1717HTHWYQ7DW45/users
  - LA — `ZLAGFX Users` — https://app.jumpdesktop.com/dashboard/teams/T-01H6VNE44DZDD0C2TVZC1Z4V57/users

## 🛠 Tech Stack
- **Language:** Node.js 20 LTS + TypeScript
- **Framework:** [Slack Bolt for JS](https://slack.dev/bolt-js), run in **Socket Mode** — the app opens an outbound WebSocket to Slack, so it needs no public HTTPS endpoint, no signing-secret verification, no reverse proxy. This matters because Phase 2 (dynamic computer/user dropdowns) requires a real Slack app modal with `external_select` options, which Bolt can serve entirely over Socket Mode.
- **Database:** None for v1 — Jump Desktop is the source of truth for machines/users. Audit trail (Phase 4) starts as structured logs + a confirmation post to an admin Slack channel; revisit a real datastore only if that proves insufficient.
- **Infrastructure:** [Render](https://render.com) Background Worker service (always-on process, no public ingress needed since it's Socket Mode). Push-to-deploy from git, encrypted env vars built in, cheap always-on tier, no AWS account/IAM/API Gateway setup required.
- **Decided:** 2026-07-24. If the org already standardizes on AWS, the equivalent would be a small Fargate task or EC2 box (Lambda doesn't fit — Socket Mode needs a persistent connection, which would force HTTP mode + API Gateway instead, giving up the "no public endpoint" benefit).

## 🚀 Local Development Setup
1. **Prerequisites:** Node.js 20 LTS, a Slack app with Socket Mode enabled (App-Level Token with `connections:write` scope)
2. **Environment Variables:**
   - `JUMPDESKTOP_API_TOKEN` — Bearer token generated from the Jump Desktop web dashboard (Security → Generate New Token); sent as `Authorization: Bearer <token>`
   - `SLACK_BOT_TOKEN` — bot token (`xoxb-...`) for posting messages/calling Slack Web API
   - `SLACK_APP_TOKEN` — app-level token (`xapp-...`) for the Socket Mode WebSocket connection
   - Copy `.env.example` to `.env`
   - *Note: Never commit actual secrets.*
3. **Installation:**
   ```bash
   npm install
   ```
4. **Running Locally:**
   ```bash
   cp .env.example .env   # fill in SLACK_BOT_TOKEN, SLACK_APP_TOKEN, JUMPDESKTOP_API_TOKEN
   npm run dev            # tsx watch, connects via Socket Mode
   ```
   `npm run build && npm start` compiles to `dist/` and runs the compiled output (what Render will run in production).

## 🧪 Testing & Quality
- **Unit Tests:** TBD — no test runner wired up yet
- **Linting:** `npm run lint` (ESLint + typescript-eslint, config in `.eslintrc.json`)
- **Formatting:** TBD
- **Type checking:** `npm run typecheck`

## 📋 Architecture & Standards
- **Pattern:** Slack Bolt app (Socket Mode) — replaces the original Workflow Builder form with a Bolt-driven modal so the computer/user dropdowns can be backed by live Jump Desktop data
- **Flow (as implemented in the scaffold):**
  1. A slash command (`/jdgfxaccess`, see `OPEN_MODAL_COMMAND` in `src/slack/handlers.ts`) opens the **JD GFX Access Request** modal
  2. User picks an office (static_select), then a computer and requester (`external_select` menus scoped to that office's team, options fetched live from Jump Desktop as the user types)
  3. On submit, the handler resolves the requester's email → Jump Desktop user ID, then calls `POST /device/{deviceID}/members` to grant access
  4. A confirmation or failure message is DMed back to the submitter, and optionally mirrored to `AUDIT_CHANNEL_ID`
- **Styling:** N/A (backend service, no UI beyond the Slack modal)
- **Key Files:**
  - `src/index.ts` — Bolt app bootstrap, Socket Mode start
  - `src/config.ts` — env var loading/validation
  - `src/jumpdesktop/client.ts` — Jump Desktop API client (`findTeamUserByEmail`, `listTeamDevices`, `listTeamUsers`, `grantDeviceAccess`, `revokeDeviceAccess`, `getDeviceConnectionUrls`)
  - `src/jumpdesktop/types.ts` — API response types + `JumpDesktopApiError`
  - `src/slack/modal.ts` — builds the request modal's blocks
  - `src/slack/teams.ts` — office code ↔ Jump Desktop team ID mapping
  - `src/slack/handlers.ts` — slash command, `external_select` options handlers, `view_submission` handler (the core grant-access logic)

## 📅 Roadmap & Status

### Phase 1 — Discovery & Design
- [x] Draft Slack workflow form (office, computer, requester fields) — currently free-text for computer & requester
- [x] Review Jump Desktop OpenAPI spec in detail — confirmed endpoints for listing team users, listing devices, and granting per-user machine access (see [API Endpoint Reference](#-api-endpoint-reference) below)
- [x] Confirm auth model for Jump Desktop API — Bearer token (`ApiToken`), generated per-user via the web dashboard (Security page → Generate New Token). No OAuth flow.
- [x] Decide tech stack + hosting for the webhook backend — Node.js/TypeScript + Slack Bolt (Socket Mode) on Render (see [Tech Stack](#-tech-stack))

### Phase 2 — Dynamic Form Data
- [x] Replace "Which computer(s)?" free-text field with a dropdown populated from Jump Desktop machine inventory (per selected office/team) — scaffolded in `src/slack/handlers.ts` (`app.options(ACTION_IDS.computer, ...)`), untested against a live workspace
- [x] Replace "Who needs access?" free-text field with a dropdown/lookup populated from Jump Desktop team users API — scaffolded (`app.options(ACTION_IDS.user, ...)`), filters client-side by name/email substring, untested
- [x] Moved off native Workflow Builder entirely — the request form is now a Bolt-driven modal (`src/slack/modal.ts`) opened via slash command, since Workflow Builder can't back a dropdown with live API data

### Phase 3 — Access Assignment Automation
- [x] Implement handler to receive form submissions — `app.view(CALLBACK_ID, ...)` in `src/slack/handlers.ts` (Socket Mode `view_submission`, not an HTTP endpoint)
- [x] Implement Jump Desktop API call to grant the requested user access — `grantDeviceAccess()` in `src/jumpdesktop/client.ts`, wired into the submission handler
- [ ] Handle edge cases: user already has access (currently just re-adds, harmless but not called out to the requester), machine not found, invalid office/computer combination — only "user not found in team" is currently handled explicitly
- [x] Post success/failure confirmation back to Slack — DM to submitter, optional mirror to `AUDIT_CHANNEL_ID`
- [ ] **Not yet done:** register the actual Slack app (scopes, slash command, interactivity/Socket Mode config) and test this end-to-end against a real workspace + Jump Desktop team

### Phase 4 — Hardening & Rollout
- [ ] Add logging/audit trail of who was granted access to what, when, and by whom
- [ ] Add error handling/retry for Jump Desktop API failures
- [ ] Access revocation flow (out of scope for v1? — confirm with stakeholders)
- [ ] Document runbook for troubleshooting failed requests
- [ ] Pilot with a small group before full rollout to NY/LA GFX teams

## 🔌 API Endpoint Reference

Reviewed 2026-07-24 from the live spec at https://jumpdesktop.com/openapi/openapi.json (OpenAPI 3.0, base URL `https://api.jumpdesktop.com`). 35 endpoints total, grouped below by relevance to this project.

**Auth:** Bearer token (`Authorization: Bearer <token>`). Each user generates their own token from the web dashboard (Security page → "Generate New Token"). No OAuth/refresh flow — treat the token as a long-lived secret.

### Endpoints needed for this project

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/team/{teamID}/users` | List/search team users. Supports `?email=` filter — use to resolve the Slack requester's email → Jump Desktop `userID`. Response: `TeamUserInfo[]` (`id`, `email`, `firstName`, `lastName`, `role`, `remoteAccess` enabled/disabled). |
| `GET` | `/v1/team/{teamID}/devices` | List/search team computers. Supports `?name=` filter (wildcard with `*`) — use to populate the "which computer(s)" dropdown per office/team. Response: `TeamDeviceInfo[]` (`id`, `name`, `users` = array of user IDs with direct access, `groups`, `lastOnlineAt`). |
| `POST` | `/v1/team/{teamID}/device/{deviceID}/members` | **Core grant-access call.** Body: `{"users": ["<userID>"], "groups": [...]}` — adds the user to the machine's remote-access list without touching existing members. This is what fulfills the Slack request. |
| `POST` | `/v1/team/{teamID}/device/{deviceID}/members/delete` | Revoke access — same body shape, removes listed users/groups. Needed for Phase 4 revocation flow. |
| `PATCH` | `/v1/team/{teamID}/device/members` | Bulk variant of add — body includes `devices[]`, `users[]`, `groups[]`, useful if a single request ever needs to grant access to multiple machines at once. |
| `PUT` | `/v1/team/{teamID}/device/{deviceID}/members` | **Destructive — overwrites** the full member list for a device. Avoid for this use case (would wipe existing access); only relevant if we ever want "set exact access list" semantics. |
| `GET` | `/v1/team/{teamID}/device/{deviceID}/urls` | Returns `connect`/`dashboard`/`askScreenShare` URLs for a device — useful to include in the Slack confirmation message so the user can connect immediately. |
| `GET` | `/v1/team/{teamID}` | Basic team info (sanity check that a team ID resolves). |

### Other endpoints available (not needed for v1, noted for completeness)
- **Team Access Groups** (`/v1/team/{teamID}/group...`) — create/manage access groups; could later replace per-device grants with "add user to a GFX access group" if groups are already set up per office.
- **Team Computers** — `device-get`, `device-remove`, `device-patch` (rename/edit), `device-get-history` (connection history per device), `device-invite/*` (generate a Jump Desktop Connect installer to auto-enroll a new machine).
- **Team Logs** — `/history` and `/history/devices` (team-wide activity/connection history — good for the audit trail called out in Phase 4).
- **Team Annotations** — arbitrary key/value metadata on users/devices/groups — could tag devices with `office: NY|LA` if not already inferable from naming/team.
- **Team Users (admin)** — invite/remove users, modify user, disable TOTP, SSO/SAML user listing, add existing SSO user to team.
- **Team Billing**, **User Information** (`/v1/user/teams` — teams the token's owner belongs to).

### Key implementation notes
- **Errors:** every endpoint returns a `default` response shaped `{"errors": [{"code","detail","status"}]}` on failure — surface `detail` in the Slack failure message.
- **Access model:** a device's effective access = its direct `users[]` **plus** any access groups it belongs to. When resolving "does this user already have access," check both the device's `users` array and its `groups` membership — a flat `POST .../members` add is still correct and idempotent, but a "does user already have access" pre-check needs to consider groups too.
- **Team scoping confirms the NY/LA design:** since every endpoint is scoped under `/v1/team/{teamID}/...`, the existing plan to route to team `T-01GW30D3R7T1717HTHWYQ7DW45` (NY) or `T-01H6VNE44DZDD0C2TVZC1Z4V57` (LA) based on the Slack "office" answer is exactly the right shape — no cross-team endpoint exists, so office selection must map 1:1 to team ID in code.
- **User must already exist on the team** — there's no "grant access to any email" shortcut; the requester must already be a member of `ZNYGFX Users`/`ZLAGFX Users` (found via `GET .../users?email=`). If not found, the flow should fail gracefully or fall back to the invite endpoint (`POST /v1/team/{teamID}/invite/user`), which is a product decision to confirm with stakeholders.

## 📞 Primary Contacts
- **Project Lead:** jc@mediagrid.tech
- **Dev Team:** TBD
