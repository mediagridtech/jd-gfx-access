# Project Name: JD GFX Access Request

## 📌 Quick Links
- **Repository:** https://github.com/mediagridtech/jd-gfx-access (pushed 2026-07-28)
- **Documentation:** [Jump Desktop OpenAPI Reference](https://jumpdesktop.com/openapi/#section/FAQ)
- **Production host:** `znyvps1` (Linux, Docker) — cloned to `~/jd-gfx-access` via a repo-scoped, read-only GitHub deploy key (`~/.ssh/jd_gfx_deploy_key` on that host). Deploy with `docker compose up -d --build` from that directory (see "On-prem deployment (Docker)" below).
- **Issue Tracker:** TBD
- **Slack Workflow:** "JD GFX Access Request" (built in Slack Workflow Builder — see screenshot reference)
- **Jump Desktop Teams:**
  - NY — `ZNYGFX Users` — https://app.jumpdesktop.com/dashboard/teams/T-01GW30D3R7T1717HTHWYQ7DW45/users
  - LA — `ZLAGFX Users` — https://app.jumpdesktop.com/dashboard/teams/T-01H6VNE44DZDD0C2TVZC1Z4V57/users

## 🛠 Tech Stack
- **Language:** Node.js 20 LTS + TypeScript
- **Framework:** [Slack Bolt for JS](https://slack.dev/bolt-js), run in **Socket Mode** — the app opens an outbound WebSocket to Slack, so it needs no public HTTPS endpoint, no signing-secret verification, no reverse proxy. This matters because Phase 2 (dynamic computer/user dropdowns) requires a real Slack app modal with `external_select` options, which Bolt can serve entirely over Socket Mode.
- **Database:** None for v1 — Jump Desktop is the source of truth for machines/users. Audit trail (Phase 4) starts as structured logs + a confirmation post to an admin Slack channel; revisit a real datastore only if that proves insufficient.
- **Infrastructure:** On-prem Linux server/VM with Docker, run via `docker compose` (`Dockerfile` + `docker-compose.yml`) — always-on container, no public ingress needed since it's Socket Mode, so no reverse proxy/TLS/firewall rule required at all, just outbound internet access. A raw `systemd` unit (`deploy/jd-gfx-access.service`) is also in the repo for a non-Docker host, but Docker is the primary path since Docker's own restart policy handles process supervision.
- **Decided:** 2026-07-24 (stack), revised 2026-07-28 (hosting: Render → on-prem, then on-prem/systemd → on-prem/Docker once a Docker-equipped Linux box was confirmed available). Render's Background Worker tier has no free plan (~$7/mo minimum), and since Socket Mode has zero inbound requirements, an existing internal server is a better fit than paying for managed hosting. `render.yaml` is left in the repo as a fallback if on-prem ever becomes impractical.

### On-prem deployment (Docker — primary path)
1. On the Docker host: `git clone git@github.com:mediagridtech/jd-gfx-access.git && cd jd-gfx-access`
2. Create `.env` in the repo root (copy from `.env.example`, fill in real tokens — never commit this file)
3. `docker compose up -d --build`
4. `docker compose logs -f` to confirm `Now connected to Slack`
5. **Redeploying:** `git pull && docker compose up -d --build`

`restart: unless-stopped` in `docker-compose.yml` means the container survives host reboots and restarts automatically if it crashes, as long as the Docker daemon itself is enabled on boot (default on most distros).

### On-prem deployment (systemd — fallback for a non-Docker host)
1. On the target server: install Node.js 20 LTS, then `git clone` this repo to e.g. `/opt/jd-gfx-access`
2. `cd /opt/jd-gfx-access && npm install && npm run build`
3. Create `/opt/jd-gfx-access/.env` on the server directly (copy from `.env.example`, fill in real tokens — never commit this file)
4. Create a dedicated unprivileged user to run the service: `sudo useradd -r -s /usr/sbin/nologin jdgfx` (or adjust the `User=` line in the unit file to whatever account you use), then `chown -R jdgfx:jdgfx /opt/jd-gfx-access`
5. `sudo cp deploy/jd-gfx-access.service /etc/systemd/system/`
6. `sudo systemctl daemon-reload && sudo systemctl enable --now jd-gfx-access`
7. `sudo journalctl -u jd-gfx-access -f` to confirm `Now connected to Slack` in the logs
8. **Redeploying:** `git pull && npm install && npm run build && sudo systemctl restart jd-gfx-access`

**Critical constraint learned during local testing:** Slack allows only one active Socket Mode connection per app token. Running this anywhere else (a laptop, a second server) at the same time as the deployed instance will cause connection flapping/crashes. Once the Docker container (or systemd service) is confirmed running, stop any local `npm run dev` permanently.

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
- [x] Decide tech stack + hosting for the webhook backend — Node.js/TypeScript + Slack Bolt (Socket Mode), hosted on-prem via Docker (see [Tech Stack](#-tech-stack); revised from the original Render plan)

### Phase 2 — Dynamic Form Data
- [x] Replace "Which computer(s)?" free-text field with a dropdown populated from Jump Desktop machine inventory (per selected office/team) — implemented in `src/slack/handlers.ts` (`app.options(ACTION_IDS.computer, ...)`), **confirmed working live** 2026-07-27 after fixing the office→dropdown state bug (see Phase 3 note below)
- [x] Replace "Who needs access?" free-text field with a dropdown/lookup populated from Jump Desktop team users API — implemented (`app.options(ACTION_IDS.user, ...)`), filters client-side by name/email substring, confirmed working live
- [x] Moved off native Workflow Builder entirely — the request form is now a Bolt-driven modal (`src/slack/modal.ts`) opened via slash command, since Workflow Builder can't back a dropdown with live API data

### Phase 3 — Access Assignment Automation
- [x] Implement handler to receive form submissions — `app.view(CALLBACK_ID, ...)` in `src/slack/handlers.ts` (Socket Mode `view_submission`, not an HTTP endpoint)
- [x] Implement Jump Desktop API call to grant the requested user access — `grantDeviceAccess()` in `src/jumpdesktop/client.ts`, wired into the submission handler
- [ ] Handle edge cases: user already has access (currently just re-adds, harmless but not called out to the requester), machine not found, invalid office/computer combination — only "user not found in team" is currently handled explicitly
- [x] Post success/failure confirmation back to Slack — DM to submitter, optional mirror to `AUDIT_CHANNEL_ID`
- [x] Slack app registered (bot token, app-level token, `/jdgfxaccess` slash command, Socket Mode + Interactivity enabled) and end-to-end flow **confirmed working** 2026-07-27 against a real workspace + Jump Desktop team
  - Bug fixed along the way: Slack's `block_suggestions` (options) payload doesn't reliably include sibling field values in `view.state.values` — the office selection is now threaded through the modal's `private_metadata` instead (see `src/slack/modal.ts` and the `app.action(ACTION_IDS.office, ...)` handler in `handlers.ts`)

### Phase 4 — Hardening & Rollout
- [x] Deployed on-prem: `znyvps1` (Linux/Docker), cloned via a repo-scoped read-only deploy key, run with `docker compose up -d --build` — see "On-prem deployment (Docker)" above
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
