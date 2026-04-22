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

## Phase 1 Extension (April 2026)
- **Public Lead Capture**: Forms model + builder UI. Public routes `/f/:formId` and `/api/public/forms/{id}`. Embeddable script at `/api/public/forms/{id}/embed.js` (iframe loader). UTM tracking (source/medium/campaign/page_url). Rate limit 10/hour per IP+form. Honeypot field to deter bots. Each successful submission creates a Lead (score 50, source "Form: …", tags ['inbound','form']) AND a follow-up task Activity due next day. Forms can be toggled live/paused, previewed, edited, embedded, and their submissions inspected inline.
- **Sales module**: Quotations (auto-numbered Q-YYYY-0001 per company/year, multi-line items with quantity/price/tax, computed subtotal/tax_total/total, status draft→sent→accepted→rejected→invoiced). One-click **opportunity → quote** conversion from Pipeline card menu. One-click **quote → order** conversion (auto-number O-YYYY-0001, items/totals copied, quote marked invoiced). Order status tracking (pending→confirmed→shipped→delivered→cancelled).
- **Calendar**: Month grid (6×7) with prev/next/today navigation. Each cell shows up to 3 typed event chips (call/meeting/email/task) with overflow counter. Click a day to see its full list + quick "Schedule on this day". Schedule dialog creates an Activity with `due_date` (date+time), which appears on both Calendar and Activities pages. Backend endpoint `/api/calendar/events?start=&end=` returns activities in range.
- Navigation expanded: Sales + Calendar + Forms added to sidebar. Mobile bottom nav focuses on 5 essentials (Home/Leads/Pipeline/Calendar/Tasks).

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
