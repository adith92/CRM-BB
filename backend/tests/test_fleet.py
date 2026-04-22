"""Backend tests for Fleet Management (Phase 2).

Covers: fleet stats, vehicles CRUD + position, drivers CRUD,
trips CRUD + assign + status + simulate, tenant isolation.
"""
import os
import uuid
import requests
import pytest
from pathlib import Path

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
assert BASE_URL
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@acme.com"
ADMIN_PASSWORD = "admin123"

JAK_LAT_MIN, JAK_LAT_MAX = -6.32, -6.08
JAK_LNG_MIN, JAK_LNG_MAX = 106.70, 106.98


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_headers():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token")
    assert tok
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="session")
def other_tenant_headers():
    """Register a second tenant for isolation test."""
    suffix = uuid.uuid4().hex[:8]
    email = f"TEST_iso_{suffix}@example.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "isotest123", "name": "Iso Tester", "company_name": f"TEST_IsoCo_{suffix}"
    })
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": "isotest123"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# ---------- Fleet stats ----------
class TestFleetStats:
    def test_stats_shape_and_values(self, admin_headers):
        r = requests.get(f"{API}/fleet/stats", headers=admin_headers)
        assert r.status_code == 200
        s = r.json()
        for k in ("vehicles", "drivers", "trips", "revenue_today", "trips_per_hour", "revenue_7d"):
            assert k in s, f"missing key {k}"
        for k in ("total", "available", "on_trip", "offline", "maintenance"):
            assert k in s["vehicles"]
            assert isinstance(s["vehicles"][k], int)
        for k in ("total", "on_duty"):
            assert k in s["drivers"]
        for k in ("today", "active", "completed_today"):
            assert k in s["trips"]
        assert isinstance(s["trips_per_hour"], list) and len(s["trips_per_hour"]) == 24
        for bucket in s["trips_per_hour"]:
            assert "hour" in bucket and "trips" in bucket and "revenue" in bucket
        assert isinstance(s["revenue_7d"], list) and len(s["revenue_7d"]) == 7
        for d in s["revenue_7d"]:
            assert "day" in d and "revenue" in d and "trips" in d
        assert isinstance(s["revenue_today"], (int, float))


# ---------- Vehicles ----------
class TestVehicles:
    def test_list_vehicles_seeded(self, admin_headers):
        r = requests.get(f"{API}/fleet/vehicles", headers=admin_headers)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 100, f"expected >=100 seeded vehicles, got {len(items)}"
        # Jakarta bounds check
        inside = 0
        for v in items:
            assert "vehicle_id" in v and "plate" in v and "status" in v and "lat" in v and "lng" in v
            if JAK_LAT_MIN <= v["lat"] <= JAK_LAT_MAX and JAK_LNG_MIN <= v["lng"] <= JAK_LNG_MAX:
                inside += 1
            # no mongo _id leakage
            assert "_id" not in v
        # at least 95% inside Jakarta bounds
        assert inside / len(items) >= 0.95, f"only {inside}/{len(items)} vehicles inside Jakarta bounds"

    def test_create_patch_position_delete(self, admin_headers):
        # create
        payload = {"plate": f"TEST {uuid.uuid4().hex[:4].upper()}", "model": "Toyota Vios",
                   "type": "Sedan", "status": "available"}
        r = requests.post(f"{API}/fleet/vehicles", headers=admin_headers, json=payload)
        assert r.status_code == 200, r.text
        vehicle = r.json()
        assert vehicle["plate"] == payload["plate"]
        assert "vehicle_id" in vehicle
        assert "lat" in vehicle and "lng" in vehicle
        vid = vehicle["vehicle_id"]

        # verify persistence via list
        r = requests.get(f"{API}/fleet/vehicles", headers=admin_headers)
        assert any(v["vehicle_id"] == vid for v in r.json())

        # patch (update)
        upd = {"plate": payload["plate"], "model": "Honda City", "type": "Sedan", "status": "maintenance",
               "maintenance_note": "Brake check"}
        r = requests.patch(f"{API}/fleet/vehicles/{vid}", headers=admin_headers, json=upd)
        assert r.status_code == 200, r.text
        assert r.json()["model"] == "Honda City"
        assert r.json()["status"] == "maintenance"

        # position update
        r = requests.patch(f"{API}/fleet/vehicles/{vid}/position", headers=admin_headers,
                           json={"lat": -6.2000, "lng": 106.8200})
        assert r.status_code == 200
        assert r.json().get("ok") is True
        # verify
        r = requests.get(f"{API}/fleet/vehicles", headers=admin_headers)
        found = next(v for v in r.json() if v["vehicle_id"] == vid)
        assert abs(found["lat"] - (-6.2)) < 1e-6
        assert abs(found["lng"] - 106.82) < 1e-6

        # delete
        r = requests.delete(f"{API}/fleet/vehicles/{vid}", headers=admin_headers)
        assert r.status_code == 200
        # verify deletion
        r = requests.get(f"{API}/fleet/vehicles", headers=admin_headers)
        assert not any(v["vehicle_id"] == vid for v in r.json())


# ---------- Drivers ----------
class TestDrivers:
    def test_list_drivers_seeded(self, admin_headers):
        r = requests.get(f"{API}/fleet/drivers", headers=admin_headers)
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 100
        for d in items[:5]:
            assert "driver_id" in d and "name" in d
            assert "_id" not in d

    def test_crud(self, admin_headers):
        payload = {"name": f"TEST_Driver_{uuid.uuid4().hex[:6]}", "phone": "+62 812 1111 2222",
                   "status": "on_duty", "rating": 4.9, "license_no": "SIM-99999999"}
        r = requests.post(f"{API}/fleet/drivers", headers=admin_headers, json=payload)
        assert r.status_code == 200
        drv = r.json()
        did = drv["driver_id"]
        assert drv["name"] == payload["name"]
        assert drv["total_trips"] == 0

        # patch
        upd = {**payload, "status": "off_duty", "rating": 4.5}
        r = requests.patch(f"{API}/fleet/drivers/{did}", headers=admin_headers, json=upd)
        assert r.status_code == 200
        assert r.json()["status"] == "off_duty"

        # delete
        r = requests.delete(f"{API}/fleet/drivers/{did}", headers=admin_headers)
        assert r.status_code == 200


# ---------- Trips ----------
class TestTrips:
    def test_list_trips(self, admin_headers):
        r = requests.get(f"{API}/fleet/trips", headers=admin_headers)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        if items:
            assert "_id" not in items[0]
            assert "trip_id" in items[0]

    def test_status_filter(self, admin_headers):
        r = requests.get(f"{API}/fleet/trips?status=completed", headers=admin_headers)
        assert r.status_code == 200
        for t in r.json():
            assert t["status"] == "completed"

    def test_simulate_incoming_trip_assigns_nearest(self, admin_headers):
        r = requests.post(f"{API}/fleet/simulate/incoming-trip", headers=admin_headers)
        assert r.status_code == 200, r.text
        trip = r.json()
        # could be pending (no available) or assigned
        assert trip["status"] in ("pending", "assigned")
        if trip["status"] == "assigned":
            assert trip["vehicle_id"] is not None
            assert trip.get("vehicle_plate")
            # vehicle should now be on_trip
            r = requests.get(f"{API}/fleet/vehicles", headers=admin_headers)
            v = next((x for x in r.json() if x["vehicle_id"] == trip["vehicle_id"]), None)
            assert v is not None
            assert v["status"] == "on_trip"
        # pickup is Jakarta place
        assert JAK_LAT_MIN <= trip["pickup_lat"] <= JAK_LAT_MAX
        assert JAK_LNG_MIN <= trip["pickup_lng"] <= JAK_LNG_MAX
        assert isinstance(trip["pickup_name"], str) and len(trip["pickup_name"]) > 0

    def test_complete_trip_frees_vehicle_and_increments_driver(self, admin_headers):
        # simulate a trip and get assignment
        r = requests.post(f"{API}/fleet/simulate/incoming-trip", headers=admin_headers)
        trip = r.json()
        if trip["status"] != "assigned":
            pytest.skip("no available vehicle to assign in this run")
        tid = trip["trip_id"]
        vid = trip["vehicle_id"]
        did = trip.get("driver_id")

        # get driver's current total_trips
        initial_total = None
        if did:
            r = requests.get(f"{API}/fleet/drivers", headers=admin_headers)
            drv = next((x for x in r.json() if x["driver_id"] == did), None)
            if drv:
                initial_total = drv.get("total_trips", 0)

        # complete
        r = requests.patch(f"{API}/fleet/trips/{tid}/status", headers=admin_headers, json={"status": "completed"})
        assert r.status_code == 200
        done = r.json()
        assert done["status"] == "completed"
        assert done.get("completed_at")

        # vehicle released
        r = requests.get(f"{API}/fleet/vehicles", headers=admin_headers)
        v = next((x for x in r.json() if x["vehicle_id"] == vid), None)
        assert v and v["status"] == "available"

        # driver's total_trips incremented
        if did and initial_total is not None:
            r = requests.get(f"{API}/fleet/drivers", headers=admin_headers)
            drv = next((x for x in r.json() if x["driver_id"] == did), None)
            assert drv["total_trips"] == initial_total + 1

        # cleanup
        requests.delete(f"{API}/fleet/trips/{tid}", headers=admin_headers)

    def test_cancel_trip_frees_vehicle(self, admin_headers):
        r = requests.post(f"{API}/fleet/simulate/incoming-trip", headers=admin_headers)
        trip = r.json()
        if trip["status"] != "assigned":
            pytest.skip("no available vehicle")
        tid = trip["trip_id"]
        vid = trip["vehicle_id"]
        r = requests.patch(f"{API}/fleet/trips/{tid}/status", headers=admin_headers, json={"status": "cancelled"})
        assert r.status_code == 200
        r = requests.get(f"{API}/fleet/vehicles", headers=admin_headers)
        v = next((x for x in r.json() if x["vehicle_id"] == vid), None)
        assert v and v["status"] == "available"
        requests.delete(f"{API}/fleet/trips/{tid}", headers=admin_headers)

    def test_assign_409_when_no_available(self, admin_headers):
        """Mark all vehicles offline → new pending trip's assign must return 409."""
        # list vehicles
        r = requests.get(f"{API}/fleet/vehicles", headers=admin_headers)
        vehicles = r.json()
        available = [v for v in vehicles if v["status"] == "available"]
        # flip all available to offline
        for v in available:
            requests.patch(f"{API}/fleet/vehicles/{v['vehicle_id']}", headers=admin_headers, json={
                "plate": v["plate"], "model": v.get("model"), "type": v.get("type", "Sedan"),
                "status": "offline", "driver_id": v.get("driver_id"),
                "maintenance_note": v.get("maintenance_note"),
            })
        try:
            # create a pending trip
            payload = {"pickup_name": "Sudirman", "pickup_lat": -6.2088, "pickup_lng": 106.8224,
                       "dropoff_name": "SCBD", "dropoff_lat": -6.2268, "dropoff_lng": 106.8085,
                       "rider_name": "TEST_Rider", "fare": 50000}
            r = requests.post(f"{API}/fleet/trips", headers=admin_headers, json=payload)
            assert r.status_code == 200
            tid = r.json()["trip_id"]

            r = requests.post(f"{API}/fleet/trips/{tid}/assign", headers=admin_headers)
            assert r.status_code == 409, f"expected 409 got {r.status_code}: {r.text}"

            # cleanup test trip
            requests.delete(f"{API}/fleet/trips/{tid}", headers=admin_headers)
        finally:
            # restore vehicles to available
            for v in available:
                requests.patch(f"{API}/fleet/vehicles/{v['vehicle_id']}", headers=admin_headers, json={
                    "plate": v["plate"], "model": v.get("model"), "type": v.get("type", "Sedan"),
                    "status": "available", "driver_id": v.get("driver_id"),
                    "maintenance_note": v.get("maintenance_note"),
                })


# ---------- Tenant isolation ----------
class TestTenantIsolation:
    def test_other_tenant_cannot_see_acme_fleet(self, other_tenant_headers):
        # vehicles list for second tenant should be empty (seed_fleet only runs for admin)
        r = requests.get(f"{API}/fleet/vehicles", headers=other_tenant_headers)
        assert r.status_code == 200
        assert r.json() == []

        r = requests.get(f"{API}/fleet/drivers", headers=other_tenant_headers)
        assert r.status_code == 200
        assert r.json() == []

        r = requests.get(f"{API}/fleet/trips", headers=other_tenant_headers)
        assert r.status_code == 200
        assert r.json() == []
