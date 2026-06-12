from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import io
import logging
import uuid
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Annotated

import bcrypt
import jwt
import csv
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, BeforeValidator, ConfigDict
from openpyxl import Workbook

# ---------- DB ----------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ---------- Auth utils ----------
JWT_ALGORITHM = "HS256"

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(hours=12), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id,
               "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=43200, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if not user.get("active", True):
            raise HTTPException(status_code=403, detail="User disabled")
        user["id"] = str(user["_id"])
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ---------- Pydantic models ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class PartyIn(BaseModel):
    name: str = Field(min_length=1)
    phone: Optional[str] = ""
    address: Optional[str] = ""
    notes: Optional[str] = ""

class EntryIn(BaseModel):
    date: str  # ISO date YYYY-MM-DD
    party_id: str
    item_name: str
    type: str  # 'jama' or 'naame'
    gold: float = 0
    fine_gold: float = 0
    silver: float = 0
    touch: float = 0
    amount: float = 0
    remarks: Optional[str] = ""

class UserUpdate(BaseModel):
    active: Optional[bool] = None
    role: Optional[str] = None

# ---------- App ----------
app = FastAPI(title="Shree Gopaldas Vallabhdas Jewellers - Hisab")
api = APIRouter(prefix="/api")

frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
cors_origins_str = os.environ.get("CORS_ORIGINS", "*").strip()
if cors_origins_str == "*":
    allow_origins = ["*"]
else:
    allow_origins = [o.strip() for o in cors_origins_str.split(",") if o.strip()]
    # Always include the configured frontend URL and local dev
    for extra in (frontend_url, "http://localhost:3000"):
        if extra and extra not in allow_origins:
            allow_origins.append(extra)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ---------- Helpers ----------
def serialize_user(u: dict) -> dict:
    return {
        "id": str(u["_id"]) if "_id" in u else u.get("id"),
        "email": u["email"],
        "name": u.get("name", ""),
        "role": u.get("role", "user"),
        "active": u.get("active", True),
        "created_at": u.get("created_at"),
    }

def serialize_party(p: dict) -> dict:
    return {
        "id": str(p["_id"]),
        "name": p.get("name", ""),
        "phone": p.get("phone", ""),
        "address": p.get("address", ""),
        "notes": p.get("notes", ""),
        "created_at": p.get("created_at"),
    }

def serialize_entry(e: dict) -> dict:
    return {
        "id": str(e["_id"]),
        "date": e.get("date"),
        "party_id": e.get("party_id"),
        "party_name": e.get("party_name"),
        "item_name": e.get("item_name"),
        "type": e.get("type"),
        "gold": e.get("gold", 0),
        "fine_gold": e.get("fine_gold", 0),
        "silver": e.get("silver", 0),
        "touch": e.get("touch", 0),
        "amount": e.get("amount", 0),
        "remarks": e.get("remarks", ""),
        "created_by": e.get("created_by"),
        "created_by_name": e.get("created_by_name"),
        "created_at": e.get("created_at"),
        "is_opening": e.get("is_opening", False),
        "closing_period": e.get("closing_period"),
    }

# ---------- Auth endpoints ----------
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name.strip(),
        "role": "user",
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    access = create_access_token(uid, email)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    doc["_id"] = res.inserted_id
    return {"user": serialize_user(doc), "access_token": access}

@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Account disabled. Contact admin.")
    uid = str(user["_id"])
    access = create_access_token(uid, email)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return {"user": serialize_user(user), "access_token": access}

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

# ---------- Parties ----------
@api.get("/parties")
async def list_parties(user: dict = Depends(get_current_user)):
    cursor = db.parties.find(
        {},
        {"name": 1, "phone": 1, "address": 1, "notes": 1, "created_at": 1},
    ).sort("name", 1).limit(10000)
    parties = [serialize_party(p) async for p in cursor]
    return parties

@api.post("/parties")
async def create_party(payload: PartyIn, user: dict = Depends(get_current_user)):
    doc = {
        "name": payload.name.strip(),
        "phone": payload.phone or "",
        "address": payload.address or "",
        "notes": payload.notes or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"],
    }
    res = await db.parties.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize_party(doc)

@api.put("/parties/{party_id}")
async def update_party(party_id: str, payload: PartyIn, user: dict = Depends(get_current_user)):
    res = await db.parties.update_one(
        {"_id": ObjectId(party_id)},
        {"$set": {"name": payload.name.strip(), "phone": payload.phone or "",
                  "address": payload.address or "", "notes": payload.notes or ""}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Party not found")
    p = await db.parties.find_one({"_id": ObjectId(party_id)})
    return serialize_party(p)

@api.delete("/parties/{party_id}")
async def delete_party(party_id: str, user: dict = Depends(require_admin)):
    cnt = await db.entries.count_documents({"party_id": party_id})
    if cnt > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete: {cnt} entries linked")
    await db.parties.delete_one({"_id": ObjectId(party_id)})
    return {"ok": True}

# ---------- Entries ----------
@api.get("/entries")
async def list_entries(
    user: dict = Depends(get_current_user),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    party_id: Optional[str] = None,
    type: Optional[str] = None,
    created_by: Optional[str] = None,
    limit: int = 500,
):
    q: dict = {}
    if start_date or end_date:
        q["date"] = {}
        if start_date:
            q["date"]["$gte"] = start_date
        if end_date:
            q["date"]["$lte"] = end_date
    if party_id:
        q["party_id"] = party_id
    if type:
        q["type"] = type
    if created_by:
        q["created_by"] = created_by
    cursor = db.entries.find(q).sort([("date", -1), ("created_at", -1)]).limit(limit)
    return [serialize_entry(e) async for e in cursor]

@api.post("/entries")
async def create_entry(payload: EntryIn, user: dict = Depends(get_current_user)):
    if payload.type not in ("jama", "naame"):
        raise HTTPException(status_code=400, detail="type must be 'jama' or 'naame'")
    party = await db.parties.find_one({"_id": ObjectId(payload.party_id)})
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")
    doc = {
        "date": payload.date,
        "party_id": payload.party_id,
        "party_name": party["name"],
        "item_name": payload.item_name.strip(),
        "type": payload.type,
        "gold": float(payload.gold or 0),
        "fine_gold": float(payload.fine_gold or 0),
        "silver": float(payload.silver or 0),
        "touch": float(payload.touch or 0),
        "amount": float(payload.amount or 0),
        "remarks": payload.remarks or "",
        "created_by": user["id"],
        "created_by_name": user.get("name", user.get("email", "")),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.entries.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize_entry(doc)

@api.put("/entries/{entry_id}")
async def update_entry(entry_id: str, payload: EntryIn, user: dict = Depends(get_current_user)):
    existing = await db.entries.find_one({"_id": ObjectId(entry_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Entry not found")
    if user.get("role") != "admin" and existing.get("created_by") != user["id"]:
        raise HTTPException(status_code=403, detail="Cannot edit another user's entry")
    party = await db.parties.find_one({"_id": ObjectId(payload.party_id)})
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")
    upd = {
        "date": payload.date,
        "party_id": payload.party_id,
        "party_name": party["name"],
        "item_name": payload.item_name.strip(),
        "type": payload.type,
        "gold": float(payload.gold or 0),
        "fine_gold": float(payload.fine_gold or 0),
        "silver": float(payload.silver or 0),
        "touch": float(payload.touch or 0),
        "amount": float(payload.amount or 0),
        "remarks": payload.remarks or "",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.entries.update_one({"_id": ObjectId(entry_id)}, {"$set": upd})
    e = await db.entries.find_one({"_id": ObjectId(entry_id)})
    return serialize_entry(e)

@api.delete("/entries/{entry_id}")
async def delete_entry(entry_id: str, user: dict = Depends(get_current_user)):
    existing = await db.entries.find_one({"_id": ObjectId(entry_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Entry not found")
    if user.get("role") != "admin" and existing.get("created_by") != user["id"]:
        raise HTTPException(status_code=403, detail="Cannot delete another user's entry")
    await db.entries.delete_one({"_id": ObjectId(entry_id)})
    return {"ok": True}

# ---------- Reports ----------
def _compute_totals(entries):
    totals = {
        "jama": {"gold": 0, "fine_gold": 0, "silver": 0, "amount": 0, "count": 0},
        "naame": {"gold": 0, "fine_gold": 0, "silver": 0, "amount": 0, "count": 0},
    }
    for e in entries:
        t = e.get("type", "jama")
        if t not in totals:
            continue
        totals[t]["gold"] += float(e.get("gold", 0))
        totals[t]["fine_gold"] += float(e.get("fine_gold", 0))
        totals[t]["silver"] += float(e.get("silver", 0))
        totals[t]["amount"] += float(e.get("amount", 0))
        totals[t]["count"] += 1
    bal = {
        "gold": totals["jama"]["gold"] - totals["naame"]["gold"],
        "fine_gold": totals["jama"]["fine_gold"] - totals["naame"]["fine_gold"],
        "silver": totals["jama"]["silver"] - totals["naame"]["silver"],
        "amount": totals["jama"]["amount"] - totals["naame"]["amount"],
    }
    return {"jama": totals["jama"], "naame": totals["naame"], "balance": bal}

@api.get("/reports/daily")
async def report_daily(date: Optional[str] = None, user: dict = Depends(get_current_user)):
    d = date or datetime.now(timezone.utc).date().isoformat()
    cursor = db.entries.find({"date": d}).sort("created_at", 1)
    entries = [serialize_entry(e) async for e in cursor]
    # Group by user
    users_map: dict = {}
    for e in entries:
        uid = e.get("created_by") or "unknown"
        users_map.setdefault(uid, {"user_name": e.get("created_by_name", ""), "entries": []})
        users_map[uid]["entries"].append(e)
    by_user = []
    for uid, v in users_map.items():
        by_user.append({"user_id": uid, "user_name": v["user_name"],
                        "entries": v["entries"], "totals": _compute_totals(v["entries"])})
    return {"date": d, "totals": _compute_totals(entries),
            "by_user": by_user, "entries": entries}

@api.get("/reports/party/{party_id}")
async def report_party(party_id: str, start_date: Optional[str] = None,
                       end_date: Optional[str] = None,
                       user: dict = Depends(get_current_user)):
    party = await db.parties.find_one({"_id": ObjectId(party_id)})
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")
    q: dict = {"party_id": party_id}
    if start_date or end_date:
        q["date"] = {}
        if start_date:
            q["date"]["$gte"] = start_date
        if end_date:
            q["date"]["$lte"] = end_date
    cursor = db.entries.find(q).sort([("date", 1), ("created_at", 1)])
    entries = [serialize_entry(e) async for e in cursor]
    # Running balance
    running = {"gold": 0, "fine_gold": 0, "silver": 0, "amount": 0}
    for e in entries:
        sign = 1 if e["type"] == "jama" else -1
        running["gold"] += sign * float(e.get("gold", 0))
        running["fine_gold"] += sign * float(e.get("fine_gold", 0))
        running["silver"] += sign * float(e.get("silver", 0))
        running["amount"] += sign * float(e.get("amount", 0))
        e["running_balance"] = dict(running)
    return {"party": serialize_party(party), "entries": entries,
            "totals": _compute_totals(entries)}

@api.get("/reports/party-balances")
async def report_party_balances(user: dict = Depends(get_current_user)):
    pipeline = [
        {"$group": {
            "_id": {"party_id": "$party_id", "type": "$type"},
            "party_name": {"$first": "$party_name"},
            "gold": {"$sum": "$gold"},
            "fine_gold": {"$sum": "$fine_gold"},
            "silver": {"$sum": "$silver"},
            "amount": {"$sum": "$amount"},
            "count": {"$sum": 1},
        }}
    ]
    agg = await db.entries.aggregate(pipeline).to_list(length=100000)
    parties: dict = {}
    for row in agg:
        pid = row["_id"]["party_id"]
        t = row["_id"]["type"]
        parties.setdefault(pid, {"party_id": pid, "party_name": row.get("party_name", ""),
                                 "jama": {"gold": 0, "fine_gold": 0, "silver": 0, "amount": 0, "count": 0},
                                 "naame": {"gold": 0, "fine_gold": 0, "silver": 0, "amount": 0, "count": 0}})
        if t in ("jama", "naame"):
            parties[pid][t] = {"gold": row.get("gold", 0), "fine_gold": row.get("fine_gold", 0),
                               "silver": row.get("silver", 0), "amount": row.get("amount", 0),
                               "count": row.get("count", 0)}
    result = []
    for v in parties.values():
        v["balance"] = {
            "gold": v["jama"]["gold"] - v["naame"]["gold"],
            "fine_gold": v["jama"]["fine_gold"] - v["naame"]["fine_gold"],
            "silver": v["jama"]["silver"] - v["naame"]["silver"],
            "amount": v["jama"]["amount"] - v["naame"]["amount"],
        }
        result.append(v)
    result.sort(key=lambda x: x["party_name"].lower())
    return result

@api.get("/reports/export")
async def export_entries(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    party_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    q: dict = {}
    if start_date or end_date:
        q["date"] = {}
        if start_date:
            q["date"]["$gte"] = start_date
        if end_date:
            q["date"]["$lte"] = end_date
    if party_id:
        q["party_id"] = party_id
    cursor = db.entries.find(q).sort([("date", 1), ("created_at", 1)]).limit(50000)
    entries = [serialize_entry(e) async for e in cursor]

    wb = Workbook()
    ws = wb.active
    ws.title = "Hisab"
    headers = ["Date", "Party", "Item", "Type", "Gold (g)", "Fine Gold (g)",
               "Silver (g)", "Touch %", "Amount (Rs.)", "Remarks", "Entered By"]
    ws.append(headers)
    for e in entries:
        ws.append([e["date"], e["party_name"], e["item_name"], e["type"].upper(),
                   e["gold"], e["fine_gold"], e["silver"], e["touch"],
                   e["amount"], e["remarks"], e["created_by_name"]])
    # Totals
    totals = _compute_totals(entries)
    ws.append([])
    ws.append(["TOTAL JAMA", "", "", "", totals["jama"]["gold"], totals["jama"]["fine_gold"],
               totals["jama"]["silver"], "", totals["jama"]["amount"], "", ""])
    ws.append(["TOTAL NAAME", "", "", "", totals["naame"]["gold"], totals["naame"]["fine_gold"],
               totals["naame"]["silver"], "", totals["naame"]["amount"], "", ""])
    ws.append(["BALANCE", "", "", "", totals["balance"]["gold"], totals["balance"]["fine_gold"],
               totals["balance"]["silver"], "", totals["balance"]["amount"], "", ""])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    fname = f"hisab_{start_date or 'all'}_{end_date or 'all'}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={fname}"},
    )

# ---------- Monthly Closing / Carry-forward ----------
def _parse_period(period: str) -> tuple[int, int]:
    """Parse 'YYYY-MM' into (year, month). Raises HTTPException 400 on bad input."""
    try:
        y_str, m_str = period.split("-")
        return int(y_str), int(m_str)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="period must be YYYY-MM")

def _next_month_first_day(period: str) -> str:
    y, m = _parse_period(period)
    if m == 12:
        return f"{y+1:04d}-01-01"
    return f"{y:04d}-{m+1:02d}-01"

def _last_day_of_period(period: str) -> str:
    y, m = _parse_period(period)
    nxt = datetime(y + 1, 1, 1) if m == 12 else datetime(y, m + 1, 1)
    return (nxt - timedelta(days=1)).date().isoformat()

class ClosingRunIn(BaseModel):
    period: str  # YYYY-MM

@api.get("/closings")
async def list_closings(user: dict = Depends(get_current_user)):
    cursor = db.closings.find({}).sort("period", -1)
    out = []
    async for c in cursor:
        out.append({
            "id": str(c["_id"]),
            "period": c.get("period"),
            "run_at": c.get("run_at"),
            "run_by_name": c.get("run_by_name"),
            "entries_count": c.get("entries_count", 0),
            "skipped": c.get("skipped", 0),
            "opening_date": c.get("opening_date"),
        })
    return out

@api.get("/closings/preview")
async def preview_closing(period: str, user: dict = Depends(get_current_user)):
    last_day = _last_day_of_period(period)
    opening_date = _next_month_first_day(period)
    pipeline = [
        {"$match": {"date": {"$lte": last_day}}},
        {"$group": {
            "_id": {"party_id": "$party_id", "type": "$type"},
            "party_name": {"$first": "$party_name"},
            "gold": {"$sum": "$gold"},
            "fine_gold": {"$sum": "$fine_gold"},
            "silver": {"$sum": "$silver"},
            "amount": {"$sum": "$amount"},
        }}
    ]
    agg = await db.entries.aggregate(pipeline).to_list(length=100000)
    parties_map: dict = {}
    for row in agg:
        pid = row["_id"]["party_id"]
        t = row["_id"]["type"]
        parties_map.setdefault(pid, {"party_id": pid, "party_name": row.get("party_name", ""),
                                     "jama": {"gold": 0, "fine_gold": 0, "silver": 0, "amount": 0},
                                     "naame": {"gold": 0, "fine_gold": 0, "silver": 0, "amount": 0}})
        if t in ("jama", "naame"):
            parties_map[pid][t] = {"gold": row.get("gold", 0), "fine_gold": row.get("fine_gold", 0),
                                   "silver": row.get("silver", 0), "amount": row.get("amount", 0)}
    result = []
    for v in parties_map.values():
        bal = {
            "gold": v["jama"]["gold"] - v["naame"]["gold"],
            "fine_gold": v["jama"]["fine_gold"] - v["naame"]["fine_gold"],
            "silver": v["jama"]["silver"] - v["naame"]["silver"],
            "amount": v["jama"]["amount"] - v["naame"]["amount"],
        }
        if all(abs(x) < 0.0001 for x in bal.values()):
            continue
        signal = bal["amount"] if abs(bal["amount"]) >= 0.0001 else (
            bal["gold"] if abs(bal["gold"]) >= 0.0001 else (
                bal["fine_gold"] if abs(bal["fine_gold"]) >= 0.0001 else bal["silver"]
            )
        )
        result.append({
            "party_id": v["party_id"],
            "party_name": v["party_name"],
            "balance": bal,
            "type": "jama" if signal >= 0 else "naame",
        })
    result.sort(key=lambda x: x["party_name"].lower())
    already = await db.closings.find_one({"period": period}) is not None
    return {
        "period": period,
        "opening_date": opening_date,
        "already_run": already,
        "parties_with_balance": result,
        "skipped_count": 0,
    }

@api.post("/closings/run")
async def run_closing(payload: ClosingRunIn, user: dict = Depends(require_admin)):
    period = payload.period.strip()
    if await db.closings.find_one({"period": period}):
        raise HTTPException(status_code=400, detail=f"Closing for {period} already exists. Undo it first to re-run.")
    last_day = _last_day_of_period(period)
    opening_date = _next_month_first_day(period)

    pipeline = [
        {"$match": {"date": {"$lte": last_day}}},
        {"$group": {
            "_id": {"party_id": "$party_id", "type": "$type"},
            "party_name": {"$first": "$party_name"},
            "gold": {"$sum": "$gold"},
            "fine_gold": {"$sum": "$fine_gold"},
            "silver": {"$sum": "$silver"},
            "amount": {"$sum": "$amount"},
        }}
    ]
    agg = await db.entries.aggregate(pipeline).to_list(length=100000)
    parties_map: dict = {}
    for row in agg:
        pid = row["_id"]["party_id"]
        t = row["_id"]["type"]
        parties_map.setdefault(pid, {"party_name": row.get("party_name", ""),
                                     "jama": {"gold": 0, "fine_gold": 0, "silver": 0, "amount": 0},
                                     "naame": {"gold": 0, "fine_gold": 0, "silver": 0, "amount": 0}})
        if t in ("jama", "naame"):
            parties_map[pid][t] = {"gold": row.get("gold", 0), "fine_gold": row.get("fine_gold", 0),
                                   "silver": row.get("silver", 0), "amount": row.get("amount", 0)}

    created_entry_ids: list = []
    skipped = 0
    for pid, v in parties_map.items():
        bal = {
            "gold": v["jama"]["gold"] - v["naame"]["gold"],
            "fine_gold": v["jama"]["fine_gold"] - v["naame"]["fine_gold"],
            "silver": v["jama"]["silver"] - v["naame"]["silver"],
            "amount": v["jama"]["amount"] - v["naame"]["amount"],
        }
        if all(abs(x) < 0.0001 for x in bal.values()):
            skipped += 1
            continue
        signal = bal["amount"] if abs(bal["amount"]) >= 0.0001 else (
            bal["gold"] if abs(bal["gold"]) >= 0.0001 else (
                bal["fine_gold"] if abs(bal["fine_gold"]) >= 0.0001 else bal["silver"]
            )
        )
        etype = "jama" if signal >= 0 else "naame"
        # Store absolute values; sign encoded by type. Mixed signs across asset classes
        # are collapsed (rare case) — operator can edit the opening entry afterwards.
        doc = {
            "date": opening_date,
            "party_id": pid,
            "party_name": v["party_name"],
            "item_name": "Opening Balance",
            "type": etype,
            "gold": abs(bal["gold"]),
            "fine_gold": abs(bal["fine_gold"]),
            "silver": abs(bal["silver"]),
            "touch": 0,
            "amount": abs(bal["amount"]),
            "remarks": f"Carried forward from {period}",
            "is_opening": True,
            "closing_period": period,
            "created_by": user["id"],
            "created_by_name": user.get("name", user.get("email", "")),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        res = await db.entries.insert_one(doc)
        created_entry_ids.append(str(res.inserted_id))

    closing_doc = {
        "period": period,
        "opening_date": opening_date,
        "last_day": last_day,
        "run_at": datetime.now(timezone.utc).isoformat(),
        "run_by": user["id"],
        "run_by_name": user.get("name", user.get("email", "")),
        "entries_count": len(created_entry_ids),
        "skipped": skipped,
        "entry_ids": created_entry_ids,
    }
    await db.closings.insert_one(closing_doc)
    return {
        "period": period,
        "opening_date": opening_date,
        "created": len(created_entry_ids),
        "skipped": skipped,
    }

@api.delete("/closings/{period}")
async def undo_closing(period: str, user: dict = Depends(require_admin)):
    closing = await db.closings.find_one({"period": period})
    if not closing:
        raise HTTPException(status_code=404, detail="Closing not found")
    ids = [ObjectId(x) for x in closing.get("entry_ids", [])]
    if ids:
        await db.entries.delete_many({"_id": {"$in": ids}})
    await db.closings.delete_one({"_id": closing["_id"]})
    return {"ok": True, "deleted_entries": len(ids)}

# ---------- Backup / CSV ----------
@api.get("/backup/entries.csv")
async def backup_entries_csv(user: dict = Depends(get_current_user)):
    cursor = db.entries.find({}).sort([("date", 1), ("created_at", 1)]).limit(100000)
    rows = [serialize_entry(e) async for e in cursor]
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["date", "party_name", "item_name", "type", "gold", "fine_gold",
                "silver", "touch", "amount", "remarks", "created_by_name"])
    for e in rows:
        w.writerow([e["date"], e["party_name"], e["item_name"], e["type"],
                    e["gold"], e["fine_gold"], e["silver"], e["touch"],
                    e["amount"], e["remarks"], e["created_by_name"]])
    out = io.BytesIO(buf.getvalue().encode("utf-8"))
    return StreamingResponse(
        out, media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=hisab_backup.csv"},
    )

@api.get("/backup/parties.csv")
async def backup_parties_csv(user: dict = Depends(get_current_user)):
    cursor = db.parties.find(
        {},
        {"name": 1, "phone": 1, "address": 1, "notes": 1, "created_at": 1},
    ).sort("name", 1).limit(50000)
    rows = [serialize_party(p) async for p in cursor]
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["name", "phone", "address", "notes"])
    for p in rows:
        w.writerow([p["name"], p["phone"], p["address"], p["notes"]])
    out = io.BytesIO(buf.getvalue().encode("utf-8"))
    return StreamingResponse(
        out, media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=parties_backup.csv"},
    )

@api.post("/restore/parties.csv")
async def restore_parties_csv(file: UploadFile = File(...), user: dict = Depends(require_admin)):
    content = (await file.read()).decode("utf-8", errors="ignore")
    reader = csv.DictReader(io.StringIO(content))
    created = 0
    skipped = 0
    for row in reader:
        name = (row.get("name") or "").strip()
        if not name:
            skipped += 1
            continue
        existing = await db.parties.find_one({"name": name})
        if existing:
            skipped += 1
            continue
        await db.parties.insert_one({
            "name": name,
            "phone": (row.get("phone") or "").strip(),
            "address": (row.get("address") or "").strip(),
            "notes": (row.get("notes") or "").strip(),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": user["id"],
        })
        created += 1
    return {"created": created, "skipped": skipped}

@api.post("/restore/entries.csv")
async def restore_entries_csv(file: UploadFile = File(...), user: dict = Depends(require_admin)):
    """CSV columns required: date (YYYY-MM-DD), party_name, item_name, type (jama|naame),
    gold, fine_gold, silver, touch, amount, remarks
    Parties are auto-created if they don't exist."""
    content = (await file.read()).decode("utf-8", errors="ignore")
    reader = csv.DictReader(io.StringIO(content))
    created = 0
    errors: list = []
    for idx, row in enumerate(reader, start=2):  # header is row 1
        try:
            date = (row.get("date") or "").strip()
            party_name = (row.get("party_name") or "").strip()
            item_name = (row.get("item_name") or "").strip()
            etype = (row.get("type") or "").strip().lower()
            if not date or not party_name or not item_name or etype not in ("jama", "naame"):
                errors.append(f"Row {idx}: missing/invalid required fields")
                continue
            # auto-create party
            party = await db.parties.find_one({"name": party_name})
            if not party:
                res = await db.parties.insert_one({
                    "name": party_name, "phone": "", "address": "", "notes": "",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": user["id"],
                })
                pid = str(res.inserted_id)
            else:
                pid = str(party["_id"])

            def num(k):
                v = row.get(k)
                try:
                    return float(v) if v not in (None, "") else 0.0
                except (TypeError, ValueError):
                    return 0.0

            await db.entries.insert_one({
                "date": date,
                "party_id": pid,
                "party_name": party_name,
                "item_name": item_name,
                "type": etype,
                "gold": num("gold"),
                "fine_gold": num("fine_gold"),
                "silver": num("silver"),
                "touch": num("touch"),
                "amount": num("amount"),
                "remarks": (row.get("remarks") or "").strip(),
                "created_by": user["id"],
                "created_by_name": user.get("name", user.get("email", "")),
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            created += 1
        except Exception as e:
            errors.append(f"Row {idx}: {str(e)}")
    return {"created": created, "errors": errors}

# ---------- Admin: Users management ----------
@api.get("/admin/users")
async def list_users(user: dict = Depends(require_admin)):
    cursor = db.users.find({}, {"password_hash": 0}).sort("created_at", -1).limit(10000)
    return [serialize_user(u) async for u in cursor]

@api.put("/admin/users/{user_id}")
async def update_user(user_id: str, payload: UserUpdate, user: dict = Depends(require_admin)):
    upd = {}
    if payload.active is not None:
        upd["active"] = payload.active
    if payload.role is not None:
        if payload.role not in ("admin", "user"):
            raise HTTPException(status_code=400, detail="role must be 'admin' or 'user'")
        upd["role"] = payload.role
    if not upd:
        raise HTTPException(status_code=400, detail="Nothing to update")
    res = await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    u = await db.users.find_one({"_id": ObjectId(user_id)})
    return serialize_user(u)

@api.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(require_admin)):
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    await db.users.delete_one({"_id": ObjectId(user_id)})
    return {"ok": True}

# ---------- Health ----------
@api.get("/")
async def root():
    return {"app": "Shree Gopaldas Vallabhdas Jewellers - Hisab", "status": "ok"}

app.include_router(api)

# ---------- Startup ----------
@app.on_event("startup")
async def on_start():
    await db.users.create_index("email", unique=True)
    await db.parties.create_index("name")
    await db.entries.create_index([("date", -1)])
    await db.entries.create_index("party_id")
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@gopaldas.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Seeded admin user: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_password),
                                            "role": "admin", "active": True}})

@app.on_event("shutdown")
async def on_shutdown():
    client.close()
