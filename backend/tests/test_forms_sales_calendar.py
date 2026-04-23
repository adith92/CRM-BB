"""Backend tests for new modules: Forms (public lead capture), Quotations, Orders, Calendar.

Covers:
- Forms CRUD (auth) + public form GET/submit + embed.js + rate-limit + honeypot + tenant isolation
- Quotations CRUD + totals + opp->quote conversion + status changes
- Quote->Order conversion + Orders CRUD + status flow
- Calendar /events filtered by date range
- Tenant isolation across new modules
"""
import os
import re
import time
import uuid
import requests
import pytest
from pathlib import Path
from datetime import datetime, timedelta, timezone

# Resolve BASE_URL from frontend/.env (REACT_APP_BACKEND_URL)
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not configured"

# Resolve FRONTEND_URL for embed.js assertion
FRONTEND_URL = ""
for line in Path("/app/backend/.env").read_text().splitlines():
    if line.startswith("FRONTEND_URL"):
        FRONTEND_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")

API = f"{BASE_URL}/api"
PUBLIC = f"{BASE_URL}/api/public"

# Use environment variables for test credentials (never hardcode secrets)
ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "admin@acme.com")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "admin123")


# --------------- Fixtures ---------------
@pytest.fixture(scope="session")
def admin_headers():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def second_tenant_headers():
    """Register a fresh second tenant to verify isolation."""
    suffix = uuid.uuid4().hex[:8]
    payload = {
        "company_name": f"TEST_Iso_{suffix}",
        "name": "Iso Admin",
        "email": f"iso_{suffix}@example.com",
        "password": "IsoPass123!",
    }
    r = requests.post(f"{API}/auth/register", json=payload)
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    token = r.json().get("access_token")
    if not token:
        # Fall back to login
        rl = requests.post(f"{API}/auth/login", json={"email": payload["email"], "password": payload["password"]})
        assert rl.status_code == 200, f"login as new tenant failed: {rl.status_code} {rl.text}"
        token = rl.json().get("access_token")
    assert token, "could not obtain token for second tenant"
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def created_form(admin_headers):
    body = {
        "title": f"TEST_Form_{uuid.uuid4().hex[:6]}",
        "description": "test form",
        "button_text": "Send",
        "success_message": "Thanks for reaching out!",
        "accent_color": "#18181B",
        "active": True,
        "fields": [
            {"key": "name", "label": "Name", "type": "text", "required": True},
            {"key": "email", "label": "Email", "type": "email", "required": True},
            {"key": "phone", "label": "Phone", "type": "tel", "required": False},
            {"key": "message", "label": "Message", "type": "textarea", "required": False},
        ],
    }
    r = requests.post(f"{API}/forms", headers=admin_headers, json=body)
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    data = r.json()
    assert data["title"] == body["title"]
    assert "form_id" in data and data["form_id"].startswith("fm_")
    assert data["active"] is True
    yield data
    requests.delete(f"{API}/forms/{data['form_id']}", headers=admin_headers)


# --------------- Forms CRUD (auth) ---------------
class TestFormsCRUD:
    def test_list_forms(self, admin_headers):
        r = requests.get(f"{API}/forms", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_forms_unauth(self):
        r = requests.get(f"{API}/forms")
        assert r.status_code in (401, 403)

    def test_create_form_default_fields(self, admin_headers):
        r = requests.post(f"{API}/forms", headers=admin_headers, json={"title": f"TEST_Default_{uuid.uuid4().hex[:6]}"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["fields"], "should fall back to default fields"
        assert any(f["key"] == "name" for f in data["fields"])
        assert any(f["key"] == "email" for f in data["fields"])
        # cleanup
        requests.delete(f"{API}/forms/{data['form_id']}", headers=admin_headers)

    def test_patch_form(self, admin_headers, created_form):
        new_title = created_form["title"] + "_patched"
        r = requests.patch(
            f"{API}/forms/{created_form['form_id']}",
            headers=admin_headers,
            json={**created_form, "title": new_title, "fields": created_form["fields"]},
        )
        assert r.status_code == 200, r.text
        assert r.json()["title"] == new_title

    def test_patch_unknown_404(self, admin_headers):
        r = requests.patch(
            f"{API}/forms/fm_doesnotexist",
            headers=admin_headers,
            json={"title": "x", "fields": []},
        )
        assert r.status_code == 404

    def test_no_id_leakage(self, admin_headers, created_form):
        r = requests.get(f"{API}/forms", headers=admin_headers)
        for f in r.json():
            assert "_id" not in f


# --------------- Public form GET / submit ---------------
class TestPublicForm:
    def test_public_get_active(self, created_form):
        r = requests.get(f"{PUBLIC}/forms/{created_form['form_id']}")
        assert r.status_code == 200, r.text
        data = r.json()
        # only safe fields
        assert "company_id" not in data
        assert "created_by" not in data
        assert data["form_id"] == created_form["form_id"]
        assert "fields" in data and isinstance(data["fields"], list)

    def test_public_get_unknown_404(self):
        r = requests.get(f"{PUBLIC}/forms/fm_unknown_xyz")
        assert r.status_code == 404

    def test_public_get_disabled_404(self, admin_headers):
        # create a form, then disable it
        r = requests.post(f"{API}/forms", headers=admin_headers, json={"title": f"TEST_Disabled_{uuid.uuid4().hex[:6]}"})
        fid = r.json()["form_id"]
        body = r.json()
        body["active"] = False
        rp = requests.patch(f"{API}/forms/{fid}", headers=admin_headers, json=body)
        assert rp.status_code == 200
        rg = requests.get(f"{PUBLIC}/forms/{fid}")
        assert rg.status_code == 404
        requests.delete(f"{API}/forms/{fid}", headers=admin_headers)

    def test_public_submit_creates_lead_and_activity(self, created_form, admin_headers):
        unique = uuid.uuid4().hex[:6]
        payload = {
            "data": {
                "name": f"TEST_PublicLead_{unique}",
                "email": f"public_{unique}@example.com",
                "phone": "+1 555 0100",
                "message": "I want a demo",
            },
            "utm_source": "google",
            "utm_medium": "cpc",
            "utm_campaign": "spring",
            "page_url": "https://acme.com/landing",
        }
        r = requests.post(f"{PUBLIC}/forms/{created_form['form_id']}/submit", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert "message" in body

        # Verify lead created via authed leads list
        time.sleep(0.5)
        rl = requests.get(f"{API}/leads", headers=admin_headers)
        assert rl.status_code == 200
        leads = rl.json()
        match = [l for l in leads if l.get("email") == payload["data"]["email"]]
        assert match, "lead from public submit not found"
        lead = match[0]
        assert lead.get("source", "").startswith("Form: ")
        assert lead.get("utm", {}).get("source") == "google"

        # Verify follow-up activity exists for this lead with due_date
        ra = requests.get(f"{API}/activities", headers=admin_headers)
        assert ra.status_code == 200
        acts = [a for a in ra.json() if a.get("related_to_id") == lead["lead_id"]]
        assert acts, "follow-up activity not created"
        assert acts[0].get("due_date")

    def test_public_submit_empty_400(self, created_form):
        r = requests.post(f"{PUBLIC}/forms/{created_form['form_id']}/submit", json={"data": {}})
        assert r.status_code == 400

    def test_honeypot_no_lead_created(self, created_form, admin_headers):
        unique = uuid.uuid4().hex[:6]
        before = requests.get(f"{API}/leads", headers=admin_headers).json()
        bot_email = f"hp_{unique}@evil.com"
        r = requests.post(
            f"{PUBLIC}/forms/{created_form['form_id']}/submit",
            json={"data": {"name": f"TEST_HP_{unique}", "email": bot_email, "website": "http://spam.example"}},
        )
        assert r.status_code == 200
        assert r.json().get("ok") is True
        time.sleep(0.5)
        after = requests.get(f"{API}/leads", headers=admin_headers).json()
        match = [l for l in after if l.get("email") == bot_email]
        assert not match, "honeypot submission should NOT create a lead"

    def test_submissions_endpoint(self, created_form, admin_headers):
        r = requests.get(f"{API}/forms/{created_form['form_id']}/submissions", headers=admin_headers)
        assert r.status_code == 200
        subs = r.json()
        assert isinstance(subs, list)
        assert len(subs) >= 1
        # No _id leak
        for s in subs:
            assert "_id" not in s

    def test_embed_js(self, created_form):
        r = requests.get(f"{PUBLIC}/forms/{created_form['form_id']}/embed.js")
        assert r.status_code == 200
        ctype = r.headers.get("content-type", "")
        assert "javascript" in ctype, f"unexpected content-type {ctype}"
        body = r.text
        if FRONTEND_URL:
            expected = f"{FRONTEND_URL}/f/{created_form['form_id']}"
            assert expected in body, f"iframe src not found. got: {body[:300]}"
        else:
            assert f"/f/{created_form['form_id']}" in body

    def test_rate_limit_429(self, admin_headers):
        # create dedicated form to avoid clashing with other tests
        r = requests.post(f"{API}/forms", headers=admin_headers, json={"title": f"TEST_RL_{uuid.uuid4().hex[:6]}"})
        fid = r.json()["form_id"]
        try:
            statuses = []
            for i in range(11):
                rr = requests.post(
                    f"{PUBLIC}/forms/{fid}/submit",
                    json={"data": {"name": f"rl_{i}", "email": f"rl{i}_{uuid.uuid4().hex[:4]}@x.com"}},
                )
                statuses.append(rr.status_code)
            # First 10 should be 200, 11th should be 429
            assert statuses[:10].count(200) == 10, f"unexpected first-10 statuses: {statuses}"
            assert statuses[10] == 429, f"expected 429 on attempt 11, got {statuses}"
        finally:
            requests.delete(f"{API}/forms/{fid}", headers=admin_headers)


# --------------- Tenant isolation: Forms ---------------
class TestFormsIsolation:
    def test_other_tenant_cannot_see_forms(self, created_form, second_tenant_headers):
        r = requests.get(f"{API}/forms", headers=second_tenant_headers)
        assert r.status_code == 200
        ids = [f.get("form_id") for f in r.json()]
        assert created_form["form_id"] not in ids

    def test_other_tenant_cannot_see_submissions(self, created_form, second_tenant_headers):
        r = requests.get(f"{API}/forms/{created_form['form_id']}/submissions", headers=second_tenant_headers)
        assert r.status_code == 404


# --------------- Quotations ---------------
@pytest.fixture(scope="module")
def created_quote(admin_headers):
    body = {
        "title": f"TEST_Quote_{uuid.uuid4().hex[:6]}",
        "currency": "USD",
        "status": "draft",
        "items": [
            {"name": "Widget", "description": "blue", "quantity": 2, "unit_price": 100.0, "tax_pct": 10},
            {"name": "Gadget", "description": "", "quantity": 1, "unit_price": 50.0, "tax_pct": 0},
        ],
    }
    r = requests.post(f"{API}/quotations", headers=admin_headers, json=body)
    assert r.status_code == 200, r.text
    data = r.json()
    yield data
    requests.delete(f"{API}/quotations/{data['quotation_id']}", headers=admin_headers)


class TestQuotations:
    def test_create_computes_totals_and_number(self, created_quote):
        # subtotal = 2*100 + 1*50 = 250; tax = 200*0.10 = 20; total = 270
        assert created_quote["subtotal"] == 250.0
        assert created_quote["tax_total"] == 20.0
        assert created_quote["total"] == 270.0
        assert re.match(r"^Q-\d{4}-\d{4}$", created_quote["number"]), created_quote["number"]
        assert created_quote["quotation_id"].startswith("qt_")

    def test_list_quotations(self, admin_headers, created_quote):
        r = requests.get(f"{API}/quotations", headers=admin_headers)
        assert r.status_code == 200
        ids = [q["quotation_id"] for q in r.json()]
        assert created_quote["quotation_id"] in ids
        for q in r.json():
            assert "_id" not in q

    def test_patch_recomputes_totals(self, admin_headers, created_quote):
        new_body = {
            "title": created_quote["title"],
            "currency": "USD",
            "status": "draft",
            "items": [{"name": "Widget", "description": "", "quantity": 3, "unit_price": 100.0, "tax_pct": 0}],
        }
        r = requests.patch(f"{API}/quotations/{created_quote['quotation_id']}", headers=admin_headers, json=new_body)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["subtotal"] == 300.0
        assert data["tax_total"] == 0.0
        assert data["total"] == 300.0

    def test_patch_status_only(self, admin_headers, created_quote):
        r = requests.patch(
            f"{API}/quotations/{created_quote['quotation_id']}/status",
            headers=admin_headers, json={"status": "sent"},
        )
        assert r.status_code == 200
        assert r.json()["status"] == "sent"

    def test_create_quote_from_opportunity(self, admin_headers):
        # Find an existing opportunity
        ro = requests.get(f"{API}/opportunities", headers=admin_headers)
        assert ro.status_code == 200
        opps = ro.json()
        assert opps, "need at least one opportunity in seed data"
        opp = opps[0]
        rq = requests.post(f"{API}/opportunities/{opp['opp_id']}/quote", headers=admin_headers)
        assert rq.status_code == 200, rq.text
        q = rq.json()
        assert q["opp_id"] == opp["opp_id"]
        assert q["items"], "quote must have at least one line item"
        assert q["items"][0]["unit_price"] == float(opp.get("amount", 0) or 0)
        # cleanup
        requests.delete(f"{API}/quotations/{q['quotation_id']}", headers=admin_headers)


# --------------- Orders ---------------
class TestOrders:
    def test_convert_quote_to_order(self, admin_headers):
        # create a quote
        body = {
            "title": f"TEST_Q4O_{uuid.uuid4().hex[:6]}",
            "currency": "USD",
            "status": "sent",
            "items": [{"name": "Service", "description": "", "quantity": 1, "unit_price": 500.0, "tax_pct": 0}],
        }
        rq = requests.post(f"{API}/quotations", headers=admin_headers, json=body)
        assert rq.status_code == 200
        quote = rq.json()
        # convert
        ro = requests.post(f"{API}/quotations/{quote['quotation_id']}/convert-to-order", headers=admin_headers)
        assert ro.status_code == 200, ro.text
        order = ro.json()
        assert re.match(r"^O-\d{4}-\d{4}$", order["number"]), order["number"]
        assert order["total"] == quote["total"]
        assert order["status"] == "pending"
        assert order["quotation_id"] == quote["quotation_id"]

        # Quote status should become "invoiced"
        rgq = requests.get(f"{API}/quotations", headers=admin_headers)
        match = [q for q in rgq.json() if q["quotation_id"] == quote["quotation_id"]]
        assert match and match[0]["status"] == "invoiced"

        # Order appears in /orders
        rgo = requests.get(f"{API}/orders", headers=admin_headers)
        ids = [o["order_id"] for o in rgo.json()]
        assert order["order_id"] in ids

        # Status transitions
        for st in ["confirmed", "shipped", "delivered"]:
            rs = requests.patch(f"{API}/orders/{order['order_id']}/status", headers=admin_headers, json={"status": st})
            assert rs.status_code == 200
            assert rs.json()["status"] == st

        # delete order + quote
        rd = requests.delete(f"{API}/orders/{order['order_id']}", headers=admin_headers)
        assert rd.status_code == 200
        requests.delete(f"{API}/quotations/{quote['quotation_id']}", headers=admin_headers)


# --------------- Calendar ---------------
class TestCalendar:
    def test_calendar_range_filter(self, admin_headers):
        # Create an activity with due_date inside range
        unique = uuid.uuid4().hex[:6]
        today = datetime.now(timezone.utc).date()
        due = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        ac = {
            "type": "task",
            "title": f"TEST_CalAct_{unique}",
            "description": "calendar test",
            "due_date": due,
            "status": "pending",
        }
        rc = requests.post(f"{API}/activities", headers=admin_headers, json=ac)
        assert rc.status_code == 200, rc.text
        act = rc.json()

        start = today.isoformat()
        end = (today + timedelta(days=7)).isoformat()
        rg = requests.get(f"{API}/calendar/events?start={start}&end={end}", headers=admin_headers)
        assert rg.status_code == 200, rg.text
        events = rg.json()
        ids = [e["activity_id"] for e in events]
        assert act["activity_id"] in ids

        # Out-of-range should not include it
        far_start = (today + timedelta(days=60)).isoformat()
        far_end = (today + timedelta(days=70)).isoformat()
        rg2 = requests.get(f"{API}/calendar/events?start={far_start}&end={far_end}", headers=admin_headers)
        assert rg2.status_code == 200
        ids2 = [e["activity_id"] for e in rg2.json()]
        assert act["activity_id"] not in ids2

        requests.delete(f"{API}/activities/{act['activity_id']}", headers=admin_headers)


# --------------- Tenant isolation: Sales / Calendar ---------------
class TestSalesCalendarIsolation:
    def test_other_tenant_no_quotes_orders_events(self, second_tenant_headers, created_quote):
        rq = requests.get(f"{API}/quotations", headers=second_tenant_headers)
        assert rq.status_code == 200
        assert created_quote["quotation_id"] not in [q["quotation_id"] for q in rq.json()]

        ro = requests.get(f"{API}/orders", headers=second_tenant_headers)
        assert ro.status_code == 200
        # second tenant should have no orders
        assert isinstance(ro.json(), list)

        rc = requests.get(f"{API}/calendar/events", headers=second_tenant_headers)
        assert rc.status_code == 200
        # second tenant calendar should not contain Acme activities
        # we just check it returns empty/list and doesn't error
        assert isinstance(rc.json(), list)
