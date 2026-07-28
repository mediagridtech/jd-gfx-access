# Skills & Knowledge Requirements — JD GFX Access Request

This document lists the skills, tools, and domain knowledge needed to build and maintain this project: a Slack-driven workflow that assigns Jump Desktop GFX machine access to users in NY and LA.

## Slack
- **Slack Bolt for JS (TypeScript), Socket Mode** — the app framework: modals with `external_select` for the office/computer/user fields, `view_submission` handling, no public HTTP endpoint required
- **Slack Web API** — posting confirmation/failure messages back to the requester or an audit channel
- **Slack app configuration** — app-level token + bot token scopes, Socket Mode setup, moving the request form off native Workflow Builder and into a Bolt-driven modal (needed once dropdowns must be populated from a live API)

## Jump Desktop API
- Applying the [Jump Desktop OpenAPI spec](https://jumpdesktop.com/openapi/openapi.json) (reviewed 2026-07-24 — see `PROJECT_PLAN.md`'s API Endpoint Reference)
- Bearer-token auth (per-user token from the JD web dashboard)
- Listing team users (per team ID, e.g. NY `T-01GW30D3R7T1717HTHWYQ7DW45`, LA `T-01H6VNE44DZDD0C2TVZC1Z4V57`)
- Listing device/machine inventory per team
- Granting a user access to a specific machine via `POST .../device/{deviceID}/members` (core action of this project)
- Handling API errors gracefully (`{"errors":[{"code","detail","status"}]}` shape)

## Backend Development
- Node.js/TypeScript service structure (no HTTP framework needed — Bolt's Socket Mode receiver replaces Express/Fastify)
- Environment variable/secrets management (Slack bot + app tokens, Jump Desktop API token)
- Basic request validation and error handling
- Structured logging for auditability (who requested access to what machine, when, outcome)

## Infrastructure & Deployment
- Render Background Worker deployment (git-push deploy, encrypted env vars, always-on process for the Socket Mode connection)
- Environment configuration per stage (dev/staging/prod)
- Basic CI for lint/test on push

## Cross-Platform Awareness
- Understanding both macOS and Windows remote-access nuances, since GFX machines run on both OSes and Jump Desktop access behavior may differ slightly per platform

## Nice-to-Have
- Familiarity with access-control/least-privilege concepts, since this project grants remote machine access to specific users
- Experience with audit logging/compliance needs for access-granting systems
