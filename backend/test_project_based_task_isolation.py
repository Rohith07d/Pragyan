import os
import sqlite3
import pytest
from fastapi.testclient import TestClient

from proxy import app, DB_PATH, init_db, save_tasks_to_db, build_system_prompt

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    init_db()
    yield


def test_database_schema_and_seeding():
    """Verify ProjectMembers, Meetings(project_id), Tasks(project_id), and seeded Projects."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Check ProjectMembers table
    cursor.execute("PRAGMA table_info(ProjectMembers)")
    pm_cols = [r[1] for r in cursor.fetchall()]
    assert "project_id" in pm_cols
    assert "user_id" in pm_cols

    # 2. Check Meetings columns
    cursor.execute("PRAGMA table_info(Meetings)")
    m_cols = [r[1] for r in cursor.fetchall()]
    assert "project_id" in m_cols

    # 3. Check Tasks columns
    cursor.execute("PRAGMA table_info(Tasks)")
    t_cols = [r[1] for r in cursor.fetchall()]
    assert "project_id" in t_cols

    # 4. Check Projects seeded
    cursor.execute("SELECT id, name FROM Projects ORDER BY id ASC")
    projects = {r[0]: r[1] for r in cursor.fetchall()}
    assert 1 in projects
    assert 2 in projects
    assert "Project A (Main)" in projects[1]
    assert "Project B (Confidential)" in projects[2]

    # 5. Check Project A has all users
    cursor.execute("SELECT COUNT(*) FROM Users")
    total_users = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM ProjectMembers WHERE project_id = 1")
    project_a_members = cursor.fetchone()[0]
    assert project_a_members == total_users

    # 6. Check Project B has exactly 3 specific users (Admin, Rohith, Mayank)
    cursor.execute("""
        SELECT u.canonical_name 
        FROM ProjectMembers pm 
        JOIN Users u ON u.id = pm.user_id 
        WHERE pm.project_id = 2
    """)
    proj_b_users = sorted([r[0] for r in cursor.fetchall()])
    assert proj_b_users == ["Admin", "Mayank", "Rohith"]
    assert len(proj_b_users) == 3

    conn.close()


def test_create_meeting_requires_project_id():
    """POST /create_meeting fails with 400 if project_id is missing."""
    token = client.post("/login", json={"canonical_name": "Rohith", "password": "rohith123"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post(
        "/create_meeting",
        json={"purpose": "No Project Meeting", "scheduled_time": "Today"},
        headers=headers,
    )
    assert resp.status_code == 400
    assert "project_id is required" in resp.json()["detail"]


def test_create_meeting_access_control_403():
    """POST /create_meeting fails with 403 when user is not an authorized project member."""
    # Sambhav is ONLY in Project 1 (Main), NOT in Project 2 (Confidential)
    sambhav_token = client.post("/login", json={"canonical_name": "Sambhav", "password": "sambhav123"}).json()["access_token"]
    sambhav_headers = {"Authorization": f"Bearer {sambhav_token}"}

    resp = client.post(
        "/create_meeting",
        json={
            "purpose": "Unauthorized Confidential Meeting Attempt",
            "scheduled_time": "Today",
            "project_id": 2,
        },
        headers=sambhav_headers,
    )
    assert resp.status_code == 403
    assert "not an authorized member" in resp.json()["detail"]


def test_create_meeting_success_for_authorized_member():
    """POST /create_meeting succeeds with 201 for authorized members of Project 2."""
    rohith_token = client.post("/login", json={"canonical_name": "Rohith", "password": "rohith123"}).json()["access_token"]
    rohith_headers = {"Authorization": f"Bearer {rohith_token}"}

    resp = client.post(
        "/create_meeting",
        json={
            "purpose": "Confidential Security Architecture",
            "scheduled_time": "2026-10-15T14:00:00",
            "project_id": 2,
        },
        headers=rohith_headers,
    )
    assert resp.status_code == 201
    meeting_data = resp.json()["meeting"]
    assert meeting_data["project_id"] == 2
    assert meeting_data["purpose"] == "Confidential Security Architecture"


def test_get_projects_access_control():
    """GET /api/projects strictly returns only projects the user is an authorized member of."""
    # Sambhav is NOT in Project 2
    sambhav_token = client.post("/login", json={"canonical_name": "Sambhav", "password": "sambhav123"}).json()["access_token"]
    s_resp = client.get("/api/projects", headers={"Authorization": f"Bearer {sambhav_token}"})
    assert s_resp.status_code == 200
    s_projects = s_resp.json()
    assert len(s_projects) == 1
    assert s_projects[0]["id"] == 1

    # Rohith is in both Project 1 and Project 2
    rohith_token = client.post("/login", json={"canonical_name": "Rohith", "password": "rohith123"}).json()["access_token"]
    r_resp = client.get("/api/projects", headers={"Authorization": f"Bearer {rohith_token}"})
    assert r_resp.status_code == 200
    r_projects = r_resp.json()
    r_ids = [p["id"] for p in r_projects]
    assert 1 in r_ids
    assert 2 in r_ids


def test_task_isolation_between_projects():
    """
    Ensure GET /tasks strictly enforces project isolation via SQL JOIN on ProjectMembers:
    - Sambhav cannot see any task from Project 2 (Confidential).
    - Tasks are correctly categorized under their project_id.
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM Users WHERE canonical_name = 'Rohith'")
    rohith_uid = cursor.fetchone()[0]
    cursor.execute("SELECT id FROM Users WHERE canonical_name = 'Sambhav'")
    sambhav_uid = cursor.fetchone()[0]

    cursor.execute(
        "INSERT INTO Tasks (meeting_id, project_id, assignee_id, task, deadline, status) VALUES (?, ?, ?, ?, ?, ?)",
        (None, 2, rohith_uid, "Highly Confidential Task for Rohith", "tomorrow", "pending")
    )
    cursor.execute(
        "INSERT INTO Tasks (meeting_id, project_id, assignee_id, task, deadline, status) VALUES (?, ?, ?, ?, ?, ?)",
        (None, 1, sambhav_uid, "Public Main Task for Sambhav", "next week", "pending")
    )
    conn.commit()
    conn.close()

    # Sambhav logs in and calls /api/tasks
    sambhav_token = client.post("/login", json={"canonical_name": "Sambhav", "password": "sambhav123"}).json()["access_token"]
    s_tasks = client.get("/api/tasks", headers={"Authorization": f"Bearer {sambhav_token}"}).json()
    for t in s_tasks:
        assert t["project_id"] == 1
        assert "Highly Confidential" not in t["task"]

    # Rohith logs in and calls /api/tasks
    rohith_token = client.post("/login", json={"canonical_name": "Rohith", "password": "rohith123"}).json()["access_token"]
    r_tasks = client.get("/api/tasks", headers={"Authorization": f"Bearer {rohith_token}"}).json()
    r_project_ids = {t["project_id"] for t in r_tasks}
    assert 2 in r_project_ids

    # Rohith filters by project_id = 2
    r_confidential_tasks = client.get("/api/tasks?project_id=2", headers={"Authorization": f"Bearer {rohith_token}"}).json()
    for t in r_confidential_tasks:
        assert t["project_id"] == 2


def test_system_prompt_and_save_tasks_constraint():
    """Verify system prompt generation and non-member mapping to Unknown."""
    prompt = build_system_prompt(
        meeting_purpose="Stealth Launch",
        project_name="Project B (Confidential)",
        authorized_members_list="Admin, Rohith, Mayank",
        project_id=2,
    )
    exact_instruction = (
        "You are processing a meeting transcript exclusively for the project: Project B (Confidential). "
        "You must strictly assign action items ONLY to the following authorized project members: Admin, Rohith, Mayank. "
        "If a speaker assigns a task to someone not on this list, map it to 'Unknown'. "
        "Categorize all generated tasks strictly under 2."
    )
    assert exact_instruction in prompt

    # Test save_tasks_to_db enforcing Project 2 membership
    # Assigning to Sambhav (who is NOT in Project 2) should map to 'Unknown' / None
    task_ids = save_tasks_to_db([
        {
            "task": "Deploy private KMS key",
            "assignee": "Sambhav",
            "deadline": "tomorrow",
        },
        {
            "task": "Review enclave boundary",
            "assignee": "Rohith",
            "deadline": "2026-10-15",
        }
    ], project_id=2)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, assignee_id, project_id, task FROM Tasks WHERE id = ?", (task_ids[0],))
    sambhav_mapped_task = cursor.fetchone()
    assert sambhav_mapped_task[1] is None
    assert sambhav_mapped_task[2] == 2

    cursor.execute("SELECT id, assignee_id, project_id, task FROM Tasks WHERE id = ?", (task_ids[1],))
    rohith_mapped_task = cursor.fetchone()
    assert rohith_mapped_task[1] is not None
    assert rohith_mapped_task[2] == 2
    conn.close()


def test_get_tasks_zero_trust_lockdown():
    """Verify GET /tasks?project_id=2 blocks non-members with 403 and exact message."""
    sambhav_token = client.post("/login", json={"canonical_name": "Sambhav", "password": "sambhav123"}).json()["access_token"]
    resp = client.get("/api/tasks?project_id=2", headers={"Authorization": f"Bearer {sambhav_token}"})
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Unauthorized: You do not have access to this workspace."

    # Authorized user receives 200 and isolated tasks
    rohith_token = client.post("/login", json={"canonical_name": "Rohith", "password": "rohith123"}).json()["access_token"]
    resp_r = client.get("/api/tasks?project_id=2", headers={"Authorization": f"Bearer {rohith_token}"})
    assert resp_r.status_code == 200
    for t in resp_r.json():
        assert t["project_id"] == 2


def test_get_project_members_endpoint():
    """Verify GET /projects/{project_id}/members returns authorized members or 403."""
    sambhav_token = client.post("/login", json={"canonical_name": "Sambhav", "password": "sambhav123"}).json()["access_token"]
    resp = client.get("/api/projects/2/members", headers={"Authorization": f"Bearer {sambhav_token}"})
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Unauthorized: You do not have access to this workspace."

    rohith_token = client.post("/login", json={"canonical_name": "Rohith", "password": "rohith123"}).json()["access_token"]
    resp_r = client.get("/api/projects/2/members", headers={"Authorization": f"Bearer {rohith_token}"})
    assert resp_r.status_code == 200
    members = resp_r.json()
    member_names = sorted([m["canonical_name"] for m in members])
    assert member_names == ["Admin", "Mayank", "Rohith"]


def test_create_meeting_block_outsiders():
    """Verify create_meeting rejects outsider attendees with 400 Security Block."""
    rohith_token = client.post("/login", json={"canonical_name": "Rohith", "password": "rohith123"}).json()["access_token"]
    rohith_headers = {"Authorization": f"Bearer {rohith_token}"}

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM Users WHERE canonical_name = 'Sambhav'")
    sambhav_uid = cursor.fetchone()[0]
    cursor.execute("SELECT id FROM Users WHERE canonical_name = 'Mayank'")
    mayank_uid = cursor.fetchone()[0]
    conn.close()

    # Attempt to invite outsider Sambhav to Project 2 (Confidential)
    resp = client.post(
        "/create_meeting",
        json={
            "purpose": "Confidential Board Meeting",
            "scheduled_time": "Today",
            "project_id": 2,
            "attendees": [mayank_uid, sambhav_uid],
        },
        headers=rohith_headers,
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == f"Security Block: User {sambhav_uid} is not in Project 2"

    # Valid attendees only -> Success
    resp_ok = client.post(
        "/create_meeting",
        json={
            "purpose": "Confidential Board Meeting Valid",
            "scheduled_time": "Today",
            "project_id": 2,
            "attendees": [mayank_uid],
        },
        headers=rohith_headers,
    )
    assert resp_ok.status_code == 201
