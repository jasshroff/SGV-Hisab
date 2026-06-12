import os
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://gopaldas-accounts.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

ADMIN_EMAIL = "admin@gopaldas.com"
ADMIN_PASSWORD = "Admin@123"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def user_creds():
    email = f"TEST_user_{uuid.uuid4().hex[:6]}@gopaldas.com"
    pw = "User@123"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": pw, "name": "Test User"})
    assert r.status_code == 200, r.text
    return {"email": email, "password": pw, "token": r.json()["access_token"], "id": r.json()["user"]["id"]}


def H(token):
    return {"Authorization": f"Bearer {token}"}


def test_root():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_admin_login_returns_token_and_role(admin_token):
    assert isinstance(admin_token, str) and len(admin_token) > 20


def test_auth_me_bearer(admin_token):
    r = requests.get(f"{API}/auth/me", headers=H(admin_token))
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == ADMIN_EMAIL
    assert data["role"] == "admin"


def test_auth_me_unauthorized():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401


def test_login_invalid():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
    assert r.status_code == 401


def test_register_duplicate(user_creds):
    r = requests.post(f"{API}/auth/register", json={"email": user_creds["email"], "password": "x" * 6, "name": "Dup"})
    assert r.status_code == 400


def test_new_user_is_not_admin(user_creds):
    r = requests.get(f"{API}/auth/me", headers=H(user_creds["token"]))
    assert r.status_code == 200
    assert r.json()["role"] == "user"


def test_non_admin_blocked_from_admin_users(user_creds):
    r = requests.get(f"{API}/admin/users", headers=H(user_creds["token"]))
    assert r.status_code == 403


def test_admin_can_list_users(admin_token):
    r = requests.get(f"{API}/admin/users", headers=H(admin_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.fixture(scope="session")
def party_id(admin_token):
    pname = f"TEST_Party_{uuid.uuid4().hex[:6]}"
    r = requests.post(f"{API}/parties", json={"name": pname, "phone": "9999", "address": "A", "notes": "n"}, headers=H(admin_token))
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    # verify list
    r2 = requests.get(f"{API}/parties", headers=H(admin_token))
    assert r2.status_code == 200
    assert any(p["id"] == pid for p in r2.json())
    return pid


def test_party_update(admin_token, party_id):
    new_name = f"TEST_Updated_{uuid.uuid4().hex[:4]}"
    r = requests.put(f"{API}/parties/{party_id}", json={"name": new_name, "phone": "1", "address": "B", "notes": ""}, headers=H(admin_token))
    assert r.status_code == 200
    assert r.json()["name"] == new_name


def test_entry_invalid_type(admin_token, party_id):
    payload = {"date": "2026-01-15", "party_id": party_id, "item_name": "Ring", "type": "bad", "gold": 10, "amount": 5000}
    r = requests.post(f"{API}/entries", json=payload, headers=H(admin_token))
    assert r.status_code == 400


@pytest.fixture(scope="session")
def admin_entry_id(admin_token, party_id):
    payload = {"date": "2026-01-15", "party_id": party_id, "item_name": "TEST_Ring",
               "type": "jama", "gold": 10.5, "fine_gold": 9.5, "silver": 0,
               "touch": 91.5, "amount": 50000, "remarks": "x"}
    r = requests.post(f"{API}/entries", json=payload, headers=H(admin_token))
    assert r.status_code == 200, r.text
    eid = r.json()["id"]
    # verify persisted via GET filter
    r2 = requests.get(f"{API}/entries", params={"party_id": party_id}, headers=H(admin_token))
    assert r2.status_code == 200
    assert any(e["id"] == eid and e["gold"] == 10.5 for e in r2.json())
    return eid


def test_user_cannot_edit_admin_entry(user_creds, admin_entry_id, party_id):
    payload = {"date": "2026-01-15", "party_id": party_id, "item_name": "Hacked",
               "type": "jama", "gold": 1, "amount": 1}
    r = requests.put(f"{API}/entries/{admin_entry_id}", json=payload, headers=H(user_creds["token"]))
    assert r.status_code == 403


def test_user_cannot_delete_admin_entry(user_creds, admin_entry_id):
    r = requests.delete(f"{API}/entries/{admin_entry_id}", headers=H(user_creds["token"]))
    assert r.status_code == 403


def test_user_can_create_entry_and_admin_can_edit(user_creds, party_id, admin_token):
    payload = {"date": "2026-01-15", "party_id": party_id, "item_name": "TEST_Chain",
               "type": "naame", "gold": 5, "fine_gold": 4.5, "silver": 0, "touch": 90, "amount": 25000}
    r = requests.post(f"{API}/entries", json=payload, headers=H(user_creds["token"]))
    assert r.status_code == 200
    eid = r.json()["id"]
    # Admin edits it
    payload2 = {**payload, "amount": 26000}
    r2 = requests.put(f"{API}/entries/{eid}", json=payload2, headers=H(admin_token))
    assert r2.status_code == 200
    assert r2.json()["amount"] == 26000


def test_daily_report(admin_token):
    r = requests.get(f"{API}/reports/daily", params={"date": "2026-01-15"}, headers=H(admin_token))
    assert r.status_code == 200
    data = r.json()
    assert "totals" in data and "by_user" in data and "entries" in data
    assert "jama" in data["totals"] and "naame" in data["totals"] and "balance" in data["totals"]


def test_party_report_running_balance(admin_token, party_id):
    r = requests.get(f"{API}/reports/party/{party_id}", headers=H(admin_token))
    assert r.status_code == 200
    data = r.json()
    for e in data["entries"]:
        assert "running_balance" in e


def test_party_balances(admin_token):
    r = requests.get(f"{API}/reports/party-balances", headers=H(admin_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_export_xlsx(admin_token):
    r = requests.get(f"{API}/reports/export", headers=H(admin_token))
    assert r.status_code == 200
    assert "spreadsheet" in r.headers.get("Content-Type", "")
    assert len(r.content) > 100


def test_delete_party_blocked_when_entries_linked(admin_token, party_id):
    r = requests.delete(f"{API}/parties/{party_id}", headers=H(admin_token))
    assert r.status_code == 400


def test_non_admin_cannot_delete_party(user_creds, party_id):
    r = requests.delete(f"{API}/parties/{party_id}", headers=H(user_creds["token"]))
    assert r.status_code == 403


def test_admin_can_toggle_user(admin_token, user_creds):
    r = requests.put(f"{API}/admin/users/{user_creds['id']}", json={"active": False}, headers=H(admin_token))
    assert r.status_code == 200
    assert r.json()["active"] is False
    # Re-enable
    r = requests.put(f"{API}/admin/users/{user_creds['id']}", json={"active": True, "role": "user"}, headers=H(admin_token))
    assert r.status_code == 200


# ---------- Backup / Restore CSV tests ----------
def test_backup_entries_csv(admin_token):
    r = requests.get(f"{API}/backup/entries.csv", headers=H(admin_token))
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("Content-Type", "")
    text = r.content.decode("utf-8")
    first_line = text.splitlines()[0]
    expected = "date,party_name,item_name,type,gold,fine_gold,silver,touch,amount,remarks,created_by_name"
    assert first_line.strip() == expected, f"Unexpected header: {first_line}"


def test_backup_parties_csv(admin_token):
    r = requests.get(f"{API}/backup/parties.csv", headers=H(admin_token))
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("Content-Type", "")
    first_line = r.content.decode("utf-8").splitlines()[0]
    assert first_line.strip() == "name,phone,address,notes"


def test_backup_entries_csv_user_allowed(user_creds):
    # Any authenticated user can download backup
    r = requests.get(f"{API}/backup/entries.csv", headers=H(user_creds["token"]))
    assert r.status_code == 200


def test_backup_entries_csv_unauth():
    r = requests.get(f"{API}/backup/entries.csv")
    assert r.status_code == 401


def test_restore_parties_csv_non_admin_forbidden(user_creds):
    csv_content = "name,phone,address,notes\nTEST_RestPartyX,1,addr,note\n"
    files = {"file": ("parties.csv", csv_content, "text/csv")}
    r = requests.post(f"{API}/restore/parties.csv", files=files, headers=H(user_creds["token"]))
    assert r.status_code == 403


def test_restore_parties_csv_admin(admin_token):
    unique = uuid.uuid4().hex[:6]
    p1 = f"TEST_RestParty_{unique}_A"
    p2 = f"TEST_RestParty_{unique}_B"
    csv_content = f"name,phone,address,notes\n{p1},111,addr1,note1\n{p2},222,addr2,note2\n,,,\n"
    files = {"file": ("parties.csv", csv_content, "text/csv")}
    r = requests.post(f"{API}/restore/parties.csv", files=files, headers=H(admin_token))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["created"] == 2
    assert data["skipped"] >= 1  # the empty row

    # Re-upload same -> all skipped (duplicates by name)
    files2 = {"file": ("parties.csv", csv_content, "text/csv")}
    r2 = requests.post(f"{API}/restore/parties.csv", files=files2, headers=H(admin_token))
    assert r2.status_code == 200
    data2 = r2.json()
    assert data2["created"] == 0
    assert data2["skipped"] >= 2

    # verify persisted
    r3 = requests.get(f"{API}/parties", headers=H(admin_token))
    names = {p["name"] for p in r3.json()}
    assert p1 in names and p2 in names

    # cleanup
    for p in r3.json():
        if p["name"] in (p1, p2):
            requests.delete(f"{API}/parties/{p['id']}", headers=H(admin_token))


def test_restore_entries_csv_non_admin_forbidden(user_creds):
    csv_content = "date,party_name,item_name,type,gold,fine_gold,silver,touch,amount,remarks\n2026-01-15,TEST_X,Ring,jama,1,1,0,90,100,r\n"
    files = {"file": ("entries.csv", csv_content, "text/csv")}
    r = requests.post(f"{API}/restore/entries.csv", files=files, headers=H(user_creds["token"]))
    assert r.status_code == 403


def test_restore_entries_csv_admin_with_errors(admin_token):
    unique = uuid.uuid4().hex[:6]
    auto_party = f"TEST_AutoParty_{unique}"
    csv_content = (
        "date,party_name,item_name,type,gold,fine_gold,silver,touch,amount,remarks\n"
        f"2026-01-16,{auto_party},Ring,jama,10,9.15,0,91.5,50000,ok\n"   # valid (auto-create party)
        f"2026-01-16,{auto_party},Chain,naame,5,4.5,0,90,25000,ok\n"      # valid (existing party)
        f"2026-01-16,{auto_party},BadType,xyz,1,1,0,90,100,bad\n"         # invalid type
        f",{auto_party},Ring,jama,1,1,0,90,100,missingdate\n"             # missing date
        f"2026-01-16,,Ring,jama,1,1,0,90,100,missingparty\n"              # missing party
    )
    files = {"file": ("entries.csv", csv_content, "text/csv")}
    r = requests.post(f"{API}/restore/entries.csv", files=files, headers=H(admin_token))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["created"] == 2, f"expected 2 created, got {data}"
    assert len(data["errors"]) == 3, f"expected 3 errors, got {data}"

    # Verify party auto-created
    r2 = requests.get(f"{API}/parties", headers=H(admin_token))
    party = next((p for p in r2.json() if p["name"] == auto_party), None)
    assert party is not None, "auto-create party failed"
    pid = party["id"]

    # Verify entries persisted (2)
    r3 = requests.get(f"{API}/entries", params={"party_id": pid}, headers=H(admin_token))
    assert r3.status_code == 200
    entries = r3.json()
    assert len(entries) == 2
    # verify auto fine_gold value carried through
    rings = [e for e in entries if e["item_name"] == "Ring"]
    assert rings and rings[0]["fine_gold"] == 9.15

    # cleanup
    for e in entries:
        requests.delete(f"{API}/entries/{e['id']}", headers=H(admin_token))
    requests.delete(f"{API}/parties/{pid}", headers=H(admin_token))


def test_cleanup(admin_token, party_id):
    # Delete entries for this party then party
    r = requests.get(f"{API}/entries", params={"party_id": party_id}, headers=H(admin_token))
    for e in r.json():
        requests.delete(f"{API}/entries/{e['id']}", headers=H(admin_token))
    r2 = requests.delete(f"{API}/parties/{party_id}", headers=H(admin_token))
    assert r2.status_code == 200
