from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt
import httpx
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, Query
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ------------------------ Setup ------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("crm")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

app = FastAPI(title="CRM SaaS API")
api = APIRouter(prefix="/api")


# ------------------------ Models ------------------------
class Company(BaseModel):
    company_id: str
    name: str
    created_at: datetime

class RegisterIn(BaseModel):
    company_name: str
    name: str
    email: EmailStr
    password: str

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    role: str
    company_id: str
    company_name: Optional[str] = None
    picture: Optional[str] = None

class ContactIn(BaseModel):
    name: str
    type: Literal["person", "company"] = "person"
    email: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    title: Optional[str] = None
    tags: List[str] = []
    notes: Optional[str] = None

class LeadIn(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    source: Optional[str] = None
    status: Literal["new", "contacted", "qualified", "unqualified"] = "new"
    score: int = 0
    notes: Optional[str] = None
    tags: List[str] = []

STAGES = ["prospecting", "qualification", "proposal", "negotiation", "won", "lost"]

class OpportunityIn(BaseModel):
    title: str
    contact_id: Optional[str] = None
    contact_name: Optional[str] = None
    amount: float = 0
    currency: str = "USD"
    stage: Literal["prospecting", "qualification", "proposal", "negotiation", "won", "lost"] = "prospecting"
    probability: int = 10
    expected_close: Optional[str] = None
    notes: Optional[str] = None

class StageUpdate(BaseModel):
    stage: Literal["prospecting", "qualification", "proposal", "negotiation", "won", "lost"]

class ActivityIn(BaseModel):
    type: Literal["task", "call", "meeting", "email"] = "task"
    title: str
    description: Optional[str] = None
    related_to_type: Optional[Literal["lead", "opportunity", "contact"]] = None
    related_to_id: Optional[str] = None
    related_to_name: Optional[str] = None
    due_date: Optional[str] = None
    status: Literal["pending", "done"] = "pending"

class GoogleSessionIn(BaseModel):
    session_id: str


# ------------------------ Helpers ------------------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(hours=12)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "type": "refresh",
               "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=12 * 3600, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True,
                        samesite="none", max_age=7 * 24 * 3600, path="/")

def set_session_cookie(response: Response, token: str):
    response.set_cookie("session_token", token, httponly=True, secure=True,
                        samesite="none", max_age=7 * 24 * 3600, path="/")

def clear_auth_cookies(response: Response):
    for k in ("access_token", "refresh_token", "session_token"):
        response.delete_cookie(k, path="/")

async def _user_from_doc(user_doc) -> UserOut:
    company = await db.companies.find_one({"company_id": user_doc["company_id"]}, {"_id": 0})
    return UserOut(
        user_id=user_doc["user_id"],
        email=user_doc["email"],
        name=user_doc["name"],
        role=user_doc.get("role", "staff"),
        company_id=user_doc["company_id"],
        company_name=company["name"] if company else None,
        picture=user_doc.get("picture"),
    )

async def get_current_user(request: Request) -> UserOut:
    # Extract token from cookie or Authorization header
    access = request.cookies.get("access_token")
    bearer = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        bearer = auth_header[7:]

    # Try JWT (cookie or bearer)
    for token in (access, bearer):
        if not token:
            continue
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
            if payload.get("type") == "access":
                user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0})
                if user:
                    return await _user_from_doc(user)
        except jwt.PyJWTError:
            pass

    # Try session_token (Emergent OAuth) from cookie or bearer
    sess_token = request.cookies.get("session_token") or bearer
    if sess_token:
        sess = await db.user_sessions.find_one({"session_token": sess_token}, {"_id": 0})
        if sess:
            expires_at = sess["expires_at"]
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at >= datetime.now(timezone.utc):
                user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
                if user:
                    return await _user_from_doc(user)

    raise HTTPException(status_code=401, detail="Not authenticated")


def scope(user: UserOut) -> dict:
    return {"company_id": user.company_id}


# ------------------------ Auth Routes ------------------------
@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    company_id = f"co_{uuid.uuid4().hex[:12]}"
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    await db.companies.insert_one({
        "company_id": company_id, "name": body.company_name, "created_at": now.isoformat()
    })
    await db.users.insert_one({
        "user_id": user_id, "email": email, "name": body.name,
        "password_hash": hash_password(body.password),
        "role": "admin", "company_id": company_id,
        "created_at": now.isoformat()
    })
    access = create_access_token(user_id, email)
    refresh = create_refresh_token(user_id)
    set_auth_cookies(response, access, refresh)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return (await _user_from_doc(user)).model_dump()


@api.post("/auth/login")
async def login(body: LoginIn, response: Response, request: Request):
    email = body.email.lower()
    xff = request.headers.get("x-forwarded-for", "")
    ip = xff.split(",")[0].strip() if xff else (request.client.host if request.client else "unknown")
    identifier = f"{ip}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    now = datetime.now(timezone.utc)
    if attempt and attempt.get("locked_until"):
        lu = attempt["locked_until"]
        if isinstance(lu, str):
            lu = datetime.fromisoformat(lu)
        if lu.tzinfo is None:
            lu = lu.replace(tzinfo=timezone.utc)
        if lu > now:
            raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")

    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        count = (attempt or {}).get("count", 0) + 1
        update = {"identifier": identifier, "count": count, "updated_at": now.isoformat()}
        if count >= 5:
            update["locked_until"] = (now + timedelta(minutes=15)).isoformat()
        await db.login_attempts.update_one({"identifier": identifier}, {"$set": update}, upsert=True)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    await db.login_attempts.delete_one({"identifier": identifier})
    access = create_access_token(user["user_id"], email)
    refresh = create_refresh_token(user["user_id"])
    set_auth_cookies(response, access, refresh)
    user.pop("_id", None)
    out = (await _user_from_doc(user)).model_dump()
    out["access_token"] = access
    out["refresh_token"] = refresh
    return out


@api.post("/auth/logout")
async def logout(response: Response, request: Request):
    sess = request.cookies.get("session_token")
    if sess:
        await db.user_sessions.delete_one({"session_token": sess})
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(user: UserOut = Depends(get_current_user)):
    return user.model_dump()


@api.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    rt = request.cookies.get("refresh_token")
    if not rt:
        raise HTTPException(status_code=401, detail="Missing refresh token")
    try:
        payload = jwt.decode(rt, JWT_SECRET, algorithms=[JWT_ALG])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    access = create_access_token(user["user_id"], user["email"])
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=12 * 3600, path="/")
    return {"ok": True}


@api.post("/auth/google/session")
async def google_session(body: GoogleSessionIn, response: Response):
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": body.session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Google session exchange failed")
    data = r.json()
    email = (data.get("email") or "").lower()
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture")
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(status_code=400, detail="Invalid session data")

    user = await db.users.find_one({"email": email}, {"_id": 0})
    now = datetime.now(timezone.utc)
    if not user:
        company_id = f"co_{uuid.uuid4().hex[:12]}"
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        company_name = email.split("@")[-1].split(".")[0].title() + " Workspace"
        await db.companies.insert_one({
            "company_id": company_id, "name": company_name, "created_at": now.isoformat()
        })
        await db.users.insert_one({
            "user_id": user_id, "email": email, "name": name,
            "role": "admin", "company_id": company_id, "picture": picture,
            "created_at": now.isoformat(), "auth_provider": "google"
        })
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    else:
        await db.users.update_one({"user_id": user["user_id"]},
                                  {"$set": {"picture": picture, "name": user.get("name") or name}})
        user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})

    await db.user_sessions.insert_one({
        "user_id": user["user_id"],
        "session_token": session_token,
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(days=7)).isoformat(),
    })
    set_session_cookie(response, session_token)
    out = (await _user_from_doc(user)).model_dump()
    out["session_token"] = session_token
    return out


# ------------------------ Dashboard ------------------------
@api.get("/dashboard/stats")
async def dashboard_stats(user: UserOut = Depends(get_current_user)):
    q = scope(user)
    leads_total = await db.leads.count_documents(q)
    opps_total = await db.opportunities.count_documents(q)
    won = await db.opportunities.count_documents({**q, "stage": "won"})
    lost = await db.opportunities.count_documents({**q, "stage": "lost"})
    activities_pending = await db.activities.count_documents({**q, "status": "pending"})

    # Pipeline by stage
    pipeline = []
    for s in STAGES:
        cur = db.opportunities.find({**q, "stage": s}, {"_id": 0})
        total = 0.0
        count = 0
        async for o in cur:
            total += float(o.get("amount", 0))
            count += 1
        pipeline.append({"stage": s, "count": count, "total": total})

    # Revenue last 6 months (closed won)
    revenue = []
    now = datetime.now(timezone.utc)
    for i in range(5, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=30 * i)).replace(day=1)
        label = month_start.strftime("%b")
        # Simple approximation: sum of won opps updated in that month
        next_month = (month_start + timedelta(days=32)).replace(day=1)
        cur = db.opportunities.find({
            **q, "stage": "won",
            "updated_at": {"$gte": month_start.isoformat(), "$lt": next_month.isoformat()}
        }, {"_id": 0, "amount": 1})
        total = 0.0
        async for o in cur:
            total += float(o.get("amount", 0))
        revenue.append({"month": label, "revenue": total})

    conversion = (won / opps_total * 100) if opps_total else 0

    recent_activities = await db.activities.find(q, {"_id": 0}).sort("created_at", -1).limit(6).to_list(6)

    return {
        "leads_total": leads_total,
        "opps_total": opps_total,
        "won": won,
        "lost": lost,
        "activities_pending": activities_pending,
        "conversion_rate": round(conversion, 1),
        "pipeline": pipeline,
        "revenue": revenue,
        "recent_activities": recent_activities,
    }


# ------------------------ Leads CRUD ------------------------
@api.get("/leads")
async def list_leads(user: UserOut = Depends(get_current_user), q: Optional[str] = None, status: Optional[str] = None):
    query = scope(user)
    if status:
        query["status"] = status
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"company_name": {"$regex": q, "$options": "i"}},
        ]
    items = await db.leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

@api.post("/leads")
async def create_lead(body: LeadIn, user: UserOut = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "lead_id": f"ld_{uuid.uuid4().hex[:12]}",
        **body.model_dump(),
        "company_id": user.company_id,
        "owner_id": user.user_id,
        "owner_name": user.name,
        "created_at": now,
        "updated_at": now,
    }
    await db.leads.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc

@api.patch("/leads/{lead_id}")
async def update_lead(lead_id: str, body: LeadIn, user: UserOut = Depends(get_current_user)):
    updates = {**body.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}
    r = await db.leads.update_one({"lead_id": lead_id, "company_id": user.company_id}, {"$set": updates})
    if r.matched_count == 0:
        raise HTTPException(404, "Lead not found")
    doc = await db.leads.find_one({"lead_id": lead_id}, {"_id": 0})
    return doc

@api.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, user: UserOut = Depends(get_current_user)):
    await db.leads.delete_one({"lead_id": lead_id, "company_id": user.company_id})
    return {"ok": True}

@api.post("/leads/{lead_id}/convert")
async def convert_lead(lead_id: str, user: UserOut = Depends(get_current_user)):
    lead = await db.leads.find_one({"lead_id": lead_id, "company_id": user.company_id}, {"_id": 0})
    if not lead:
        raise HTTPException(404, "Lead not found")
    now = datetime.now(timezone.utc).isoformat()
    contact = {
        "contact_id": f"ct_{uuid.uuid4().hex[:12]}",
        "name": lead["name"], "type": "person",
        "email": lead.get("email"), "phone": lead.get("phone"),
        "company_name": lead.get("company_name"),
        "tags": lead.get("tags", []),
        "company_id": user.company_id, "created_at": now, "updated_at": now,
    }
    await db.contacts.insert_one(contact.copy())
    opp = {
        "opp_id": f"op_{uuid.uuid4().hex[:12]}",
        "title": f"{lead.get('company_name') or lead['name']} — Opportunity",
        "contact_id": contact["contact_id"], "contact_name": contact["name"],
        "amount": 0, "currency": "USD", "stage": "prospecting", "probability": 10,
        "company_id": user.company_id, "owner_id": user.user_id, "owner_name": user.name,
        "created_at": now, "updated_at": now,
    }
    await db.opportunities.insert_one(opp.copy())
    await db.leads.update_one({"lead_id": lead_id}, {"$set": {"status": "qualified", "updated_at": now}})
    contact.pop("_id", None); opp.pop("_id", None)
    return {"contact": contact, "opportunity": opp}


# ------------------------ Opportunities CRUD ------------------------
@api.get("/opportunities")
async def list_opps(user: UserOut = Depends(get_current_user)):
    items = await db.opportunities.find(scope(user), {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

@api.post("/opportunities")
async def create_opp(body: OpportunityIn, user: UserOut = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "opp_id": f"op_{uuid.uuid4().hex[:12]}",
        **body.model_dump(),
        "company_id": user.company_id,
        "owner_id": user.user_id,
        "owner_name": user.name,
        "created_at": now, "updated_at": now,
    }
    await db.opportunities.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc

@api.patch("/opportunities/{opp_id}")
async def update_opp(opp_id: str, body: OpportunityIn, user: UserOut = Depends(get_current_user)):
    updates = {**body.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}
    r = await db.opportunities.update_one({"opp_id": opp_id, "company_id": user.company_id}, {"$set": updates})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return await db.opportunities.find_one({"opp_id": opp_id}, {"_id": 0})

@api.patch("/opportunities/{opp_id}/stage")
async def update_stage(opp_id: str, body: StageUpdate, user: UserOut = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    r = await db.opportunities.update_one(
        {"opp_id": opp_id, "company_id": user.company_id},
        {"$set": {"stage": body.stage, "updated_at": now}}
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return await db.opportunities.find_one({"opp_id": opp_id}, {"_id": 0})

@api.delete("/opportunities/{opp_id}")
async def delete_opp(opp_id: str, user: UserOut = Depends(get_current_user)):
    await db.opportunities.delete_one({"opp_id": opp_id, "company_id": user.company_id})
    return {"ok": True}


# ------------------------ Contacts CRUD ------------------------
@api.get("/contacts")
async def list_contacts(user: UserOut = Depends(get_current_user), q: Optional[str] = None):
    query = scope(user)
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"company_name": {"$regex": q, "$options": "i"}},
        ]
    items = await db.contacts.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

@api.post("/contacts")
async def create_contact(body: ContactIn, user: UserOut = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "contact_id": f"ct_{uuid.uuid4().hex[:12]}",
        **body.model_dump(),
        "company_id": user.company_id,
        "created_at": now, "updated_at": now,
    }
    await db.contacts.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc

@api.patch("/contacts/{contact_id}")
async def update_contact(contact_id: str, body: ContactIn, user: UserOut = Depends(get_current_user)):
    updates = {**body.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}
    r = await db.contacts.update_one({"contact_id": contact_id, "company_id": user.company_id}, {"$set": updates})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return await db.contacts.find_one({"contact_id": contact_id}, {"_id": 0})

@api.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str, user: UserOut = Depends(get_current_user)):
    await db.contacts.delete_one({"contact_id": contact_id, "company_id": user.company_id})
    return {"ok": True}


# ------------------------ Activities CRUD ------------------------
@api.get("/activities")
async def list_activities(user: UserOut = Depends(get_current_user), status: Optional[str] = None):
    query = scope(user)
    if status:
        query["status"] = status
    items = await db.activities.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

@api.post("/activities")
async def create_activity(body: ActivityIn, user: UserOut = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "activity_id": f"ac_{uuid.uuid4().hex[:12]}",
        **body.model_dump(),
        "company_id": user.company_id,
        "owner_id": user.user_id,
        "owner_name": user.name,
        "created_at": now, "updated_at": now,
    }
    await db.activities.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc

@api.patch("/activities/{activity_id}")
async def update_activity(activity_id: str, body: ActivityIn, user: UserOut = Depends(get_current_user)):
    updates = {**body.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}
    r = await db.activities.update_one({"activity_id": activity_id, "company_id": user.company_id}, {"$set": updates})
    if r.matched_count == 0:
        raise HTTPException(404, "Not found")
    return await db.activities.find_one({"activity_id": activity_id}, {"_id": 0})

@api.post("/activities/{activity_id}/toggle")
async def toggle_activity(activity_id: str, user: UserOut = Depends(get_current_user)):
    a = await db.activities.find_one({"activity_id": activity_id, "company_id": user.company_id}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Not found")
    new_status = "done" if a.get("status") == "pending" else "pending"
    await db.activities.update_one({"activity_id": activity_id},
                                   {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return await db.activities.find_one({"activity_id": activity_id}, {"_id": 0})

@api.delete("/activities/{activity_id}")
async def delete_activity(activity_id: str, user: UserOut = Depends(get_current_user)):
    await db.activities.delete_one({"activity_id": activity_id, "company_id": user.company_id})
    return {"ok": True}


# ------------------------ Global Search ------------------------
@api.get("/search")
async def global_search(q: str = Query(..., min_length=1), user: UserOut = Depends(get_current_user)):
    scope_q = scope(user)
    rgx = {"$regex": q, "$options": "i"}
    results = {"leads": [], "opportunities": [], "contacts": [], "activities": []}
    results["leads"] = await db.leads.find(
        {**scope_q, "$or": [{"name": rgx}, {"email": rgx}, {"company_name": rgx}]},
        {"_id": 0}).limit(5).to_list(5)
    results["opportunities"] = await db.opportunities.find(
        {**scope_q, "$or": [{"title": rgx}, {"contact_name": rgx}]},
        {"_id": 0}).limit(5).to_list(5)
    results["contacts"] = await db.contacts.find(
        {**scope_q, "$or": [{"name": rgx}, {"email": rgx}, {"company_name": rgx}]},
        {"_id": 0}).limit(5).to_list(5)
    results["activities"] = await db.activities.find(
        {**scope_q, "$or": [{"title": rgx}, {"description": rgx}]},
        {"_id": 0}).limit(5).to_list(5)
    return results


# ------------------------ Health ------------------------
@api.get("/")
async def root():
    return {"status": "ok", "service": "crm"}


# ------------------------ Seed ------------------------
async def seed_demo():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@acme.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")

    existing = await db.users.find_one({"email": admin_email})
    if existing:
        # Ensure password is current
        if not verify_password(admin_password, existing.get("password_hash", "")):
            await db.users.update_one({"email": admin_email},
                                      {"$set": {"password_hash": hash_password(admin_password)}})
        return

    now = datetime.now(timezone.utc)
    company_id = f"co_{uuid.uuid4().hex[:12]}"
    await db.companies.insert_one({
        "company_id": company_id, "name": "Acme Inc", "created_at": now.isoformat()
    })

    admin_id = f"user_{uuid.uuid4().hex[:12]}"
    manager_id = f"user_{uuid.uuid4().hex[:12]}"
    staff_id = f"user_{uuid.uuid4().hex[:12]}"
    await db.users.insert_many([
        {"user_id": admin_id, "email": admin_email, "name": "Ava Admin",
         "password_hash": hash_password(admin_password), "role": "admin",
         "company_id": company_id, "created_at": now.isoformat()},
        {"user_id": manager_id, "email": "manager@acme.com", "name": "Marcus Manager",
         "password_hash": hash_password("manager123"), "role": "manager",
         "company_id": company_id, "created_at": now.isoformat()},
        {"user_id": staff_id, "email": "staff@acme.com", "name": "Sam Staff",
         "password_hash": hash_password("staff123"), "role": "staff",
         "company_id": company_id, "created_at": now.isoformat()},
    ])

    # Seed contacts
    contacts_seed = [
        {"name": "Olivia Park", "type": "person", "email": "olivia@globex.com", "phone": "+1 415 555 0111",
         "company_name": "Globex", "title": "VP Sales", "tags": ["enterprise", "warm"]},
        {"name": "Rahul Mehta", "type": "person", "email": "rahul@soylent.co", "phone": "+1 415 555 0112",
         "company_name": "Soylent", "title": "CTO", "tags": ["tech"]},
        {"name": "Initech", "type": "company", "email": "contact@initech.com",
         "company_name": "Initech", "tags": ["smb"]},
    ]
    contact_docs = []
    for c in contacts_seed:
        d = {"contact_id": f"ct_{uuid.uuid4().hex[:12]}", **c,
             "company_id": company_id, "created_at": now.isoformat(), "updated_at": now.isoformat()}
        contact_docs.append(d)
    await db.contacts.insert_many([d.copy() for d in contact_docs])

    # Seed leads
    leads_seed = [
        {"name": "Nora Chen", "email": "nora@hooli.com", "phone": "+1 415 555 0133",
         "company_name": "Hooli", "source": "Website", "status": "new", "score": 62, "tags": ["inbound"]},
        {"name": "Dmitri Volkov", "email": "dmitri@pied.io", "phone": "+1 415 555 0134",
         "company_name": "Piedpiper", "source": "Referral", "status": "contacted", "score": 78, "tags": ["warm"]},
        {"name": "Aisha Patel", "email": "aisha@umbrella.co", "phone": "+1 415 555 0135",
         "company_name": "Umbrella", "source": "Event", "status": "qualified", "score": 91, "tags": ["hot"]},
        {"name": "Ben Turner", "email": "ben@stark.io", "phone": "+1 415 555 0136",
         "company_name": "Stark", "source": "Cold", "status": "new", "score": 44, "tags": []},
    ]
    for ld in leads_seed:
        await db.leads.insert_one({
            "lead_id": f"ld_{uuid.uuid4().hex[:12]}", **ld,
            "notes": None, "company_id": company_id,
            "owner_id": admin_id, "owner_name": "Ava Admin",
            "created_at": now.isoformat(), "updated_at": now.isoformat(),
        })

    # Seed opportunities across stages
    opps_seed = [
        {"title": "Globex Q2 Platform Deal", "contact_name": "Olivia Park", "amount": 42000, "stage": "prospecting", "probability": 20},
        {"title": "Soylent API License", "contact_name": "Rahul Mehta", "amount": 18000, "stage": "qualification", "probability": 40},
        {"title": "Hooli Enterprise Rollout", "contact_name": "Nora Chen", "amount": 125000, "stage": "proposal", "probability": 60},
        {"title": "Piedpiper Expansion", "contact_name": "Dmitri Volkov", "amount": 75000, "stage": "negotiation", "probability": 80},
        {"title": "Umbrella Annual", "contact_name": "Aisha Patel", "amount": 56000, "stage": "won", "probability": 100},
        {"title": "Initech Renewal", "contact_name": "Initech", "amount": 12000, "stage": "won", "probability": 100},
        {"title": "Stark POC", "contact_name": "Ben Turner", "amount": 9000, "stage": "lost", "probability": 0},
    ]
    for op in opps_seed:
        await db.opportunities.insert_one({
            "opp_id": f"op_{uuid.uuid4().hex[:12]}", **op, "currency": "USD",
            "contact_id": None, "notes": None, "expected_close": None,
            "company_id": company_id, "owner_id": admin_id, "owner_name": "Ava Admin",
            "created_at": now.isoformat(), "updated_at": now.isoformat(),
        })

    # Seed activities
    acts_seed = [
        {"type": "call", "title": "Discovery call with Nora", "description": "Hooli platform overview",
         "related_to_type": "lead", "related_to_name": "Nora Chen", "status": "pending"},
        {"type": "meeting", "title": "Demo for Globex", "description": "Walkthrough pricing tiers",
         "related_to_type": "opportunity", "related_to_name": "Globex Q2 Platform Deal", "status": "pending"},
        {"type": "email", "title": "Send proposal to Hooli",
         "related_to_type": "opportunity", "related_to_name": "Hooli Enterprise Rollout", "status": "done"},
        {"type": "task", "title": "Prep Umbrella onboarding",
         "related_to_type": "opportunity", "related_to_name": "Umbrella Annual", "status": "pending"},
    ]
    for a in acts_seed:
        await db.activities.insert_one({
            "activity_id": f"ac_{uuid.uuid4().hex[:12]}", **a,
            "due_date": None, "related_to_id": None,
            "company_id": company_id, "owner_id": admin_id, "owner_name": "Ava Admin",
            "created_at": now.isoformat(), "updated_at": now.isoformat(),
        })

    logger.info("Seeded demo data for company Acme Inc")


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.companies.create_index("company_id", unique=True)
    await db.leads.create_index([("company_id", 1), ("created_at", -1)])
    await db.opportunities.create_index([("company_id", 1), ("stage", 1)])
    await db.contacts.create_index([("company_id", 1), ("created_at", -1)])
    await db.activities.create_index([("company_id", 1), ("created_at", -1)])
    await db.user_sessions.create_index("session_token", unique=True)
    await db.login_attempts.create_index("identifier")
    await seed_demo()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


app.include_router(api)

# CORS: must be exact origin + credentials (no wildcard with credentials)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)
