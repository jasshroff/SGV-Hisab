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
def user_creds(admin_token):
    email = f"TEST_user_{uuid.uuid4().hex[:6]}@gopaldas.com"
    pw = "User@123"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": pw, "name": "Test User"})
    assert r.status_code == 200, r.text
    user = {"email": email, "password": pw, "token": r.json()["access_token"], "id": r.json()["user"]["id"]}
    yield user
    # Always remove the test user account after the session so the admin panel
    # is not polluted by repeated test runs.
    try:
        requests.delete(f"{API}/admin/users/{user['id']}", headers=H(admin_token), timeout=10)
    except Exception:
        pass


def H(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session", autouse=True)
def _sweep_test_users_at_session_end():
    """Final safety net: remove any 'test_user_*@gopaldas.com' accounts that
    leaked from this or a previous interrupted test run, so the live admin
    users panel stays clean."""
    yield
    try:
        r = requests.post(f"{API}/auth/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=10)
        if r.status_code != 200:
            return
        tok = r.json()["access_token"]
        users = requests.get(f"{API}/admin/users", headers=H(tok), timeout=10).json()
        for u in users:
            if u.get("email", "").startswith("test_user_"):
                requests.delete(f"{API}/admin/users/{u['id']}", headers=H(tok), timeout=10)
    except Exception:
        pass


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


# ---------- Phase 4: Month-End Closing tests ----------
# Uses period 2025-01 which has no production data → safe (created=0, skipped=0)

CLOSING_TEST_PERIOD = "2025-01"
CLOSING_EXPECTED_OPENING_DATE = "2025-02-01"


def _ensure_no_existing_closing(admin_token, period):
    requests.delete(f"{API}/closings/{period}", headers=H(admin_token))


def test_closings_list_authenticated(admin_token):
    r = requests.get(f"{API}/closings", headers=H(admin_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_closings_list_unauth():
    r = requests.get(f"{API}/closings")
    assert r.status_code == 401


def test_closings_preview_opening_date_next_month(admin_token):
    r = requests.get(f"{API}/closings/preview", params={"period": CLOSING_TEST_PERIOD}, headers=H(admin_token))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["period"] == CLOSING_TEST_PERIOD
    assert data["opening_date"] == CLOSING_EXPECTED_OPENING_DATE
    assert "already_run" in data
    assert isinstance(data["parties_with_balance"], list)
    # December rollover: 2026-12 -> 2027-01-01
    r2 = requests.get(f"{API}/closings/preview", params={"period": "2026-12"}, headers=H(admin_token))
    assert r2.status_code == 200
    assert r2.json()["opening_date"] == "2027-01-01"


def test_closings_preview_invalid_period(admin_token):
    r = requests.get(f"{API}/closings/preview", params={"period": "feb-2026"}, headers=H(admin_token))
    assert r.status_code == 400


def test_closings_run_invalid_period(admin_token):
    r = requests.post(f"{API}/closings/run", json={"period": "feb-2026"}, headers=H(admin_token))
    assert r.status_code == 400


def test_closings_run_non_admin_forbidden(user_creds):
    r = requests.post(f"{API}/closings/run", json={"period": CLOSING_TEST_PERIOD}, headers=H(user_creds["token"]))
    assert r.status_code == 403


def test_closings_run_and_undo_safe_period(admin_token):
    # Use 2025-01 which has no entries -> created=0, skipped=0
    _ensure_no_existing_closing(admin_token, CLOSING_TEST_PERIOD)

    # Preview shows already_run False
    pv = requests.get(f"{API}/closings/preview", params={"period": CLOSING_TEST_PERIOD}, headers=H(admin_token))
    assert pv.status_code == 200
    assert pv.json()["already_run"] is False

    # Run closing
    r = requests.post(f"{API}/closings/run", json={"period": CLOSING_TEST_PERIOD}, headers=H(admin_token))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["period"] == CLOSING_TEST_PERIOD
    assert data["opening_date"] == CLOSING_EXPECTED_OPENING_DATE
    assert data["created"] == 0
    assert data["skipped"] == 0

    # GET /closings now contains this period
    lst = requests.get(f"{API}/closings", headers=H(admin_token))
    assert lst.status_code == 200
    assert any(c["period"] == CLOSING_TEST_PERIOD for c in lst.json())

    # Preview now shows already_run True
    pv2 = requests.get(f"{API}/closings/preview", params={"period": CLOSING_TEST_PERIOD}, headers=H(admin_token))
    assert pv2.json()["already_run"] is True

    # Re-run blocked
    r2 = requests.post(f"{API}/closings/run", json={"period": CLOSING_TEST_PERIOD}, headers=H(admin_token))
    assert r2.status_code == 400
    detail = (r2.json().get("detail") or "").lower()
    assert "already" in detail

    # Undo
    u = requests.delete(f"{API}/closings/{CLOSING_TEST_PERIOD}", headers=H(admin_token))
    assert u.status_code == 200, u.text
    udata = u.json()
    assert udata["ok"] is True
    assert "deleted_entries" in udata

    # Undo of non-existent returns 404
    u2 = requests.delete(f"{API}/closings/{CLOSING_TEST_PERIOD}", headers=H(admin_token))
    assert u2.status_code == 404


def test_closings_run_creates_opening_entries_with_flag(admin_token):
    """Verify is_opening + closing_period tags are correctly applied for parties with balance."""
    unique = uuid.uuid4().hex[:6]
    pname = f"TEST_ClosePty_{unique}"
    # create party
    pr = requests.post(f"{API}/parties", json={"name": pname, "phone": "1", "address": "", "notes": ""}, headers=H(admin_token))
    assert pr.status_code == 200
    pid = pr.json()["id"]
    test_period = "2024-06"  # safe historical period unlikely to have data
    opening_date = "2024-07-01"
    _ensure_no_existing_closing(admin_token, test_period)

    # add a jama entry in test_period for this party
    er = requests.post(f"{API}/entries", json={
        "date": "2024-06-15", "party_id": pid, "item_name": "TEST_Bal",
        "type": "jama", "gold": 10, "fine_gold": 9, "silver": 0, "touch": 90, "amount": 1000
    }, headers=H(admin_token))
    assert er.status_code == 200, er.text
    eid = er.json()["id"]

    try:
        # Preview should now show this party
        pv = requests.get(f"{API}/closings/preview", params={"period": test_period}, headers=H(admin_token))
        assert pv.status_code == 200, pv.text
        parties = pv.json()["parties_with_balance"]
        ours = next((p for p in parties if p["party_id"] == pid), None)
        assert ours is not None, f"party not in preview: {parties}"
        assert ours["type"] == "jama"
        assert ours["balance"]["gold"] == 10

        # Run closing
        rc = requests.post(f"{API}/closings/run", json={"period": test_period}, headers=H(admin_token))
        assert rc.status_code == 200, rc.text
        assert rc.json()["created"] >= 1
        assert rc.json()["opening_date"] == opening_date

        # Verify opening entry exists for this party at opening_date with item_name='Opening Balance'
        # NOTE: serialize_entry does NOT expose is_opening/closing_period — see test_report action item
        entries = requests.get(f"{API}/entries", params={"party_id": pid}, headers=H(admin_token)).json()
        openings = [e for e in entries if e["date"] == opening_date and e["item_name"] == "Opening Balance"]
        assert len(openings) == 1, f"expected 1 opening entry on {opening_date}, got {openings}"
        op = openings[0]
        assert op["type"] == "jama"
        assert op["gold"] == 10  # positive stored, sign encoded via type
        assert "Carried forward from 2024-06" in op.get("remarks", "")

        # Undo deletes opening entries
        u = requests.delete(f"{API}/closings/{test_period}", headers=H(admin_token))
        assert u.status_code == 200
        assert u.json()["deleted_entries"] >= 1

        # After undo, no opening entry on opening_date remains
        entries2 = requests.get(f"{API}/entries", params={"party_id": pid}, headers=H(admin_token)).json()
        assert not [e for e in entries2 if e["date"] == opening_date and e["item_name"] == "Opening Balance"]
    finally:
        # cleanup
        _ensure_no_existing_closing(admin_token, test_period)
        requests.delete(f"{API}/entries/{eid}", headers=H(admin_token))
        requests.delete(f"{API}/parties/{pid}", headers=H(admin_token))


def test_cleanup(admin_token, party_id):
    # Delete entries for this party then party
    r = requests.get(f"{API}/entries", params={"party_id": party_id}, headers=H(admin_token))
    for e in r.json():
        requests.delete(f"{API}/entries/{e['id']}", headers=H(admin_token))
    r2 = requests.delete(f"{API}/parties/{party_id}", headers=H(admin_token))
    assert r2.status_code == 200
