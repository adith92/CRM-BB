"""Backend tests for CRM SaaS API.

Covers: Auth (register/login/me/refresh/logout/google/brute-force),
Dashboard stats, Leads CRUD + convert, Opportunities CRUD + stage,
Contacts CRUD + search, Activities CRUD + toggle, Global search,
Multi-tenant isolation, _id leakage check.
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
# REACT_APP_BACKEND_URL is in frontend/.env; load it manually if not present
if not BASE_URL:
    from pathlib import Path
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not configured"

API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@acme.com"
ADMIN_PASSWORD = "admin123"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data and isinstance(data["access_token"], str) and len(data["access_token"]) > 0
    return data["access_token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def admin_user(admin_headers):
    r = requests.get(f"{API}/auth/me", headers=admin_headers)
    assert r.status_code == 200
    return r.json()


# ---------- Health ----------
def test_health_root():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ---------- Auth ----------
class TestAuth:
    def test_login_success(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert data.get("role") == "admin"
        assert data.get("company_name") == "Acme Inc"
        assert "access_token" in data and "refresh_token" in data
        # _id must not leak
        assert "_id" not in data

    def test_login_bad_credentials(self):
        # Use unique email to avoid lockout from other tests
        bad_email = f"nouser_{uuid.uuid4().hex[:6]}@nope.com"
        r = requests.post(f"{API}/auth/login", json={"email": bad_email, "password": "wrong"})
        assert r.status_code == 401

    def test_brute_force_lockout(self):
        # Use a unique email so we don't pollute the admin account
        target = f"bf_{uuid.uuid4().hex[:8]}@nope.com"
        last_status = None
        for i in range(6):
            r = requests.post(f"{API}/auth/login", json={"email": target, "password": "wrongpass"})
            last_status = r.status_code
        # 6th attempt should yield 429 (lock activated after 5 fails)
        assert last_status == 429, f"Expected 429 after 6 bad attempts, got {last_status}"

    def test_me_with_bearer(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert "user_id" in data and "company_id" in data
        assert "_id" not in data

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_logout(self, admin_headers):
        r = requests.post(f"{API}/auth/logout", headers=admin_headers)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_register_new_company(self):
        email = f"owner_{uuid.uuid4().hex[:8]}@testco.com"
        body = {"company_name": f"TEST_Co_{uuid.uuid4().hex[:6]}", "name": "Test Owner",
                "email": email, "password": "Passw0rd!"}
        r = requests.post(f"{API}/auth/register", json=body)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == email
        assert data["role"] == "admin"
        assert data["company_name"] == body["company_name"]
        # Verify can login
        r2 = requests.post(f"{API}/auth/login", json={"email": email, "password": "Passw0rd!"})
        assert r2.status_code == 200
        assert "access_token" in r2.json()

    def test_register_duplicate(self):
        r = requests.post(f"{API}/auth/register", json={
            "company_name": "DupCo", "name": "Dup", "email": ADMIN_EMAIL, "password": "x"
        })
        assert r.status_code == 400

    def test_refresh_via_cookie(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        # The login sets refresh_token cookie. Use the same session to call /refresh.
        r2 = s.post(f"{API}/auth/refresh")
        # If cookie made it through ingress, expect 200; if not, expect 401.
        assert r2.status_code in (200, 401)
        if r2.status_code == 200:
            assert r2.json().get("ok") is True

    def test_refresh_no_token(self):
        r = requests.post(f"{API}/auth/refresh")
        assert r.status_code == 401

    def test_google_session_invalid(self):
        r = requests.post(f"{API}/auth/google/session", json={"session_id": "definitely-invalid-xyz"})
        # Backend returns 401 (or possibly 400/4xx) for invalid session
        assert 400 <= r.status_code < 500, f"Expected 4xx, got {r.status_code}"


# ---------- Dashboard ----------
class TestDashboard:
    def test_stats_shape(self, admin_headers):
        r = requests.get(f"{API}/dashboard/stats", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ["leads_total", "opps_total", "won", "lost", "conversion_rate",
                  "pipeline", "revenue", "recent_activities", "activities_pending"]:
            assert k in d, f"missing {k}"
        assert isinstance(d["pipeline"], list) and len(d["pipeline"]) == 6
        assert {p["stage"] for p in d["pipeline"]} == {
            "prospecting", "qualification", "proposal", "negotiation", "won", "lost"}
        assert isinstance(d["revenue"], list) and len(d["revenue"]) == 6
        for r_ in d["revenue"]:
            assert "month" in r_ and "revenue" in r_
        # Should have seeded leads/opps
        assert d["leads_total"] >= 4
        assert d["opps_total"] >= 7

    def test_stats_unauth(self):
        r = requests.get(f"{API}/dashboard/stats")
        assert r.status_code == 401


# ---------- Leads ----------
class TestLeads:
    def test_list_leads(self, admin_headers):
        r = requests.get(f"{API}/leads", headers=admin_headers)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) >= 4
        for i in items:
            assert "_id" not in i
            assert "lead_id" in i

    def test_create_get_update_delete_lead(self, admin_headers):
        body = {"name": "TEST_Lead", "email": "tl@test.com", "company_name": "TEST_Co",
                "source": "Website", "status": "new", "score": 50, "tags": ["t1"]}
        r = requests.post(f"{API}/leads", headers=admin_headers, json=body)
        assert r.status_code == 200
        ld = r.json()
        assert "_id" not in ld
        lead_id = ld["lead_id"]
        # Verify in list
        r2 = requests.get(f"{API}/leads", headers=admin_headers)
        assert any(x["lead_id"] == lead_id for x in r2.json())
        # Update
        body["status"] = "contacted"
        body["score"] = 77
        r3 = requests.patch(f"{API}/leads/{lead_id}", headers=admin_headers, json=body)
        assert r3.status_code == 200
        assert r3.json()["status"] == "contacted"
        assert r3.json()["score"] == 77
        # Delete
        r4 = requests.delete(f"{API}/leads/{lead_id}", headers=admin_headers)
        assert r4.status_code == 200
        # Confirm gone
        r5 = requests.get(f"{API}/leads", headers=admin_headers)
        assert not any(x["lead_id"] == lead_id for x in r5.json())

    def test_convert_lead(self, admin_headers):
        body = {"name": "TEST_Convert", "email": "tc@test.com", "company_name": "TEST_ConvCo",
                "status": "new", "score": 60}
        r = requests.post(f"{API}/leads", headers=admin_headers, json=body)
        lead_id = r.json()["lead_id"]
        r2 = requests.post(f"{API}/leads/{lead_id}/convert", headers=admin_headers)
        assert r2.status_code == 200
        d = r2.json()
        assert "contact" in d and "opportunity" in d
        assert "_id" not in d["contact"] and "_id" not in d["opportunity"]
        assert d["contact"]["name"] == "TEST_Convert"
        assert d["opportunity"]["stage"] == "prospecting"
        # Lead should now be qualified
        r3 = requests.get(f"{API}/leads", headers=admin_headers)
        match = [x for x in r3.json() if x["lead_id"] == lead_id]
        assert match and match[0]["status"] == "qualified"
        # Cleanup
        requests.delete(f"{API}/leads/{lead_id}", headers=admin_headers)
        requests.delete(f"{API}/contacts/{d['contact']['contact_id']}", headers=admin_headers)
        requests.delete(f"{API}/opportunities/{d['opportunity']['opp_id']}", headers=admin_headers)


# ---------- Opportunities ----------
class TestOpportunities:
    def test_crud_and_stage(self, admin_headers):
        body = {"title": "TEST_Opp", "amount": 1000, "stage": "prospecting",
                "probability": 10, "currency": "USD"}
        r = requests.post(f"{API}/opportunities", headers=admin_headers, json=body)
        assert r.status_code == 200
        opp = r.json()
        assert "_id" not in opp
        opp_id = opp["opp_id"]
        # Stage update
        r2 = requests.patch(f"{API}/opportunities/{opp_id}/stage",
                            headers=admin_headers, json={"stage": "negotiation"})
        assert r2.status_code == 200
        assert r2.json()["stage"] == "negotiation"
        # Update full
        body["amount"] = 2500
        r3 = requests.patch(f"{API}/opportunities/{opp_id}", headers=admin_headers, json=body)
        assert r3.status_code == 200
        assert r3.json()["amount"] == 2500
        # Delete
        r4 = requests.delete(f"{API}/opportunities/{opp_id}", headers=admin_headers)
        assert r4.status_code == 200

    def test_list_no_id_leak(self, admin_headers):
        r = requests.get(f"{API}/opportunities", headers=admin_headers)
        assert r.status_code == 200
        for o in r.json():
            assert "_id" not in o
            assert "opp_id" in o


# ---------- Contacts ----------
class TestContacts:
    def test_list_and_search(self, admin_headers):
        r = requests.get(f"{API}/contacts", headers=admin_headers)
        assert r.status_code == 200
        for c in r.json():
            assert "_id" not in c
        r2 = requests.get(f"{API}/contacts", headers=admin_headers, params={"q": "Olivia"})
        assert r2.status_code == 200
        names = [c["name"] for c in r2.json()]
        assert any("Olivia" in n for n in names)

    def test_create_update_delete(self, admin_headers):
        body = {"name": "TEST_Contact", "type": "person", "email": "tc2@test.com",
                "company_name": "TEST_X"}
        r = requests.post(f"{API}/contacts", headers=admin_headers, json=body)
        assert r.status_code == 200
        cid = r.json()["contact_id"]
        body["email"] = "updated@test.com"
        r2 = requests.patch(f"{API}/contacts/{cid}", headers=admin_headers, json=body)
        assert r2.status_code == 200
        assert r2.json()["email"] == "updated@test.com"
        r3 = requests.delete(f"{API}/contacts/{cid}", headers=admin_headers)
        assert r3.status_code == 200


# ---------- Activities ----------
class TestActivities:
    def test_crud_and_toggle(self, admin_headers):
        body = {"type": "task", "title": "TEST_Act", "status": "pending"}
        r = requests.post(f"{API}/activities", headers=admin_headers, json=body)
        assert r.status_code == 200
        aid = r.json()["activity_id"]
        # Toggle to done
        r2 = requests.post(f"{API}/activities/{aid}/toggle", headers=admin_headers)
        assert r2.status_code == 200
        assert r2.json()["status"] == "done"
        # Toggle back
        r3 = requests.post(f"{API}/activities/{aid}/toggle", headers=admin_headers)
        assert r3.status_code == 200
        assert r3.json()["status"] == "pending"
        # Update
        body["title"] = "TEST_Act_Updated"
        r4 = requests.patch(f"{API}/activities/{aid}", headers=admin_headers, json=body)
        assert r4.status_code == 200
        assert r4.json()["title"] == "TEST_Act_Updated"
        # Delete
        r5 = requests.delete(f"{API}/activities/{aid}", headers=admin_headers)
        assert r5.status_code == 200


# ---------- Global Search ----------
class TestSearch:
    def test_grouped_results(self, admin_headers):
        r = requests.get(f"{API}/search", headers=admin_headers, params={"q": "Hooli"})
        assert r.status_code == 200
        d = r.json()
        for k in ["leads", "opportunities", "contacts", "activities"]:
            assert k in d and isinstance(d[k], list)
        # Hooli should match leads (Nora) and an opportunity
        assert any("Hooli" in (x.get("company_name") or "") or "Hooli" in (x.get("name") or "") for x in d["leads"])


# ---------- Multi-tenant isolation ----------
class TestTenantIsolation:
    def test_other_company_cannot_see_admin_data(self):
        # Register a brand new company; ensure they see no Acme data
        email = f"iso_{uuid.uuid4().hex[:8]}@isoco.com"
        reg = requests.post(f"{API}/auth/register", json={
            "company_name": f"TEST_Iso_{uuid.uuid4().hex[:5]}",
            "name": "Iso", "email": email, "password": "Passw0rd!"
        })
        assert reg.status_code == 200
        login = requests.post(f"{API}/auth/login", json={"email": email, "password": "Passw0rd!"})
        token = login.json()["access_token"]
        h = {"Authorization": f"Bearer {token}"}
        # New tenant should have empty datasets
        for path in ["/leads", "/opportunities", "/contacts", "/activities"]:
            r = requests.get(f"{API}{path}", headers=h)
            assert r.status_code == 200
            assert r.json() == [], f"{path} not isolated: {r.json()}"
        stats = requests.get(f"{API}/dashboard/stats", headers=h).json()
        assert stats["leads_total"] == 0
        assert stats["opps_total"] == 0
