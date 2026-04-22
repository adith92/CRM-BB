# Relay CRM — Product Requirements

## Original Problem
Build a modular enterprise CRM SaaS inspired by Odoo and Zoho CRM. Multi-tenant, RBAC, modular, real-time ready, audit logs, multi-language, multi-currency. Layout: sidebar (collapsible) + topbar (search, notifications, quick create, profile) + main content. Modules: CRM (Leads, Opportunities, Pipeline Kanban, Activities, Notes/tags), Contacts, Sales (Quotations, Orders, Pricing), Products. PWA with offline caching. Responsive.

## User Choices (MVP)
- Auth: JWT email/password + Emergent Google OAuth (both)
- Scope: CRM core (Leads, Opportunities, Pipeline Kanban, Activities) + Contacts + Dashboard
- AI lead scoring: deferred to P1
- Design: Clean enterprise (Linear/Attio-style)
- PWA: Basic (manifest + service worker shell caching)

## Architecture
- Backend: FastAPI + MongoDB (Motor), JWT (PyJWT + bcrypt), multi-tenant via `company_id` field on all records.
- Frontend: React + Tailwind + shadcn/ui + recharts. Auth via Authorization Bearer header (localStorage) to work around Emergent ingress CORS constraints.
- Auth: email/password returns `access_token` + `refresh_token` in JSON body; Google OAuth returns `session_token` in body.

## User Personas
- **Admin** — Workspace owner, full access (admin@acme.com)
- **Manager** — Can manage team data (manager@acme.com)
- **Staff** — Day-to-day CRM user (staff@acme.com)

## Implemented (April 2026 — MVP)
- Multi-tenant company + user model with JWT cookies + Bearer, Emergent Google OAuth, brute-force lockout (X-Forwarded-For aware).
- Seeded demo workspace "Acme Inc" with 3 users, 3 contacts, 4 leads, 7 opportunities across 6 stages, 4 activities.
- REST endpoints: /api/auth/* (register/login/logout/me/refresh/google/session), /api/dashboard/stats, full CRUD for leads/opportunities/contacts/activities, PATCH /api/opportunities/{id}/stage (Kanban drag), POST /api/leads/{id}/convert, /api/search.
- Frontend: Login + Signup (with Google buttons), AuthCallback, Dashboard (KPI cards, bar chart pipeline, area chart revenue, recent activities, conversion), Leads (search + status filter + table + edit + convert + delete), Opportunities Kanban (6 columns, HTML5 drag-drop with optimistic update), Contacts (grid + search + edit), Activities (tabs + toggle), Settings, Global search ⌘K, Quick Create, Notifications popover, collapsible sidebar, mobile bottom nav.
- PWA: manifest.json + service-worker.js (shell caching, never caches /api/).
- All interactive elements have data-testid.

## Deferred / Backlog
### P0 (soon)
- Partial PATCH models for Leads/Opportunities/Contacts/Activities (optional fields)
- Lead scoring UI inputs (rule-based) — AI lead scoring later
- Email notifications (SendGrid/Resend) for assigned activities

### P1
- Sales module: Quotations, Orders, Pricing rules, Discounts, Subscriptions
- Products catalog + variants + pricing tiers
- Calendar + Table + Saved filter views
- Custom permission builder (field-level access)
- Real-time WebSocket updates for pipeline and activities
- Audit log UI
- Multi-currency per workspace, multi-language (i18n)
- AI lead scoring (Claude Sonnet 4.5 via Emergent LLM key)
- Webhooks outbound to external systems
- Attachments + Notes with markdown

### P2
- Drag-drop customizable dashboard widgets
- Marketing segmentation on contacts
- Advanced reports + export
- Right-side activity panel
- Team collaboration (mentions, assignments)

## Test Credentials
See `/app/memory/test_credentials.md`.

## Deployment Notes
- Backend binds 0.0.0.0:8001, supervisor-managed.
- Frontend uses REACT_APP_BACKEND_URL; API calls use Bearer token from localStorage.
- Ingress forces `Access-Control-Allow-Origin: *` on preflight, so cookie-based credentials aren't reliable across origins — Bearer token flow used instead.
