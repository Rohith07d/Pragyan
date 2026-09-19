"""
Phase 1 Automated Test Suite: Relational Database & Authentication
===================================================================
Tests SQLite relational tables, JWT token generation, admin user creation,
and strict user ID privacy filtering on /tasks and /meetings.
"""

import os
import sys
import sqlite3
import pytest
from fastapi.testclient import TestClient

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from proxy import app, DB_PATH, init_db


@pytest.fixture(scope="module")
def client():
    init_db()
    with TestClient(app) as test_client:
        yield test_client


def test_relational_database_schema():
    """Verify all 5 relational tables and columns required by Phase 1."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Users (id, canonical_name, password_hash, role)
    cursor.execute("PRAGMA table_info(Users)")
    user_cols = {row[1]: row[2] for row in cursor.fetchall()}
    assert "id" in user_cols
    assert "canonical_name" in user_cols
    assert "password_hash" in user_cols
    assert "role" in user_cols

    # 2. Projects (id, name)
    cursor.execute("PRAGMA table_info(Projects)")
    proj_cols = {row[1]: row[2] for row in cursor.fetchall()}
    assert "id" in proj_cols
    assert "name" in proj_cols

    # 3. Meetings (id, purpose, scheduled_time, config_flags, pm_view, group_view, absent_view, status)
    cursor.execute("PRAGMA table_info(Meetings)")
    meet_cols = {row[1]: row[2] for row in cursor.fetchall()}
    assert "id" in meet_cols
    assert "purpose" in meet_cols
    assert "scheduled_time" in meet_cols
    assert "config_flags" in meet_cols
    assert "pm_view" in meet_cols
    assert "group_view" in meet_cols
    assert "absent_view" in meet_cols
    assert "status" in meet_cols

    # 4. Tasks (id, meeting_id, assignee_id, task, deadline)
    cursor.execute("PRAGMA table_info(Tasks)")
    task_cols = {row[1]: row[2] for row in cursor.fetchall()}
    assert "id" in task_cols
    assert "meeting_id" in task_cols
    assert "assignee_id" in task_cols
    assert "task" in task_cols
    assert "deadline" in task_cols

    # 5. UserAliases (id, user_id, alias_string)
    cursor.execute("PRAGMA table_info(UserAliases)")
    alias_cols = {row[1]: row[2] for row in cursor.fetchall()}
    assert "id" in alias_cols
    assert "user_id" in alias_cols
    assert "alias_string" in alias_cols

    conn.close()


def test_auth_login_admin(client):
    """Test successful login for Admin user."""
    resp = client.post("/login", json={"canonical_name": "Admin", "password": "admin123"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["canonical_name"] == "Admin"
    assert data["user"]["role"] == "admin"


def test_auth_login_user(client):
    """Test successful login for standard user (Rohith)."""
    resp = client.post("/api/login", json={"canonical_name": "Rohith", "password": "rohith123"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["canonical_name"] == "Rohith"
    assert data["user"]["role"] == "user"


def test_auth_login_invalid_credentials(client):
    """Test rejected login with incorrect password."""
    resp = client.post("/login", json={"canonical_name": "Rohith", "password": "wrongpassword"})
    assert resp.status_code == 401
    assert "detail" in resp.json()


def test_unauthenticated_request_blocked(client):
    """Endpoints requiring authentication must reject unauthenticated requests."""
    resp = client.get("/tasks")
    assert resp.status_code == 401

    resp = client.get("/meetings")
    assert resp.status_code == 401

    resp = client.get("/me")
    assert resp.status_code == 401


def test_admin_create_user(client):
    """Admin must be able to securely create new user profiles via POST /users."""
    # 1. Login as Admin
    admin_login = client.post("/login", json={"canonical_name": "Admin", "password": "admin123"}).json()
    admin_token = admin_login["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Login as regular user
    user_login = client.post("/login", json={"canonical_name": "Rohith", "password": "rohith123"}).json()
    user_token = user_login["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # 3. Non-admin should be forbidden from creating users
    forbidden_resp = client.post(
        "/users",
        json={"canonical_name": "TestHacker", "password": "password123", "role": "user"},
        headers=user_headers,
    )
    assert forbidden_resp.status_code == 403

    # 4. Admin creates a new user
    import uuid
    new_user_name = f"Engineer_{uuid.uuid4().hex[:6]}"
    create_resp = client.post(
        "/users",
        json={"canonical_name": new_user_name, "password": "securepassword123", "role": "user"},
        headers=admin_headers,
    )
    assert create_resp.status_code == 201
    created_data = create_resp.json()
    assert created_data["status"] == "created"
    assert created_data["user"]["canonical_name"] == new_user_name
    assert created_data["user"]["role"] == "user"
    new_user_id = created_data["user"]["id"]

    # 5. Verify user can immediately log in
    new_user_login = client.post(
        "/login",
        json={"canonical_name": new_user_name, "password": "securepassword123"},
    )
    assert new_user_login.status_code == 200
    assert new_user_login.json()["user"]["id"] == new_user_id

    # 6. Verify duplicate user creation is rejected with 400 Bad Request
    duplicate_resp = client.post(
        "/users",
        json={"canonical_name": new_user_name, "password": "securepassword123", "role": "user"},
        headers=admin_headers,
    )
    assert duplicate_resp.status_code == 400

    # 7. Verify UserAliases table has the new user's initial alias
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT alias_string FROM UserAliases WHERE user_id = ?", (new_user_id,))
    aliases = [r[0] for r in cursor.fetchall()]
    conn.close()
    assert new_user_name in aliases


def test_strict_privacy_filtering_tasks(client):
    """
    GET /tasks must strictly filter by the authenticated user's ID.
    Rohith must NOT see Mayank's or Sambhav's tasks.
    Admin can see all tasks.
    """
    # Login as Rohith
    rohith_token = client.post("/login", json={"canonical_name": "Rohith", "password": "rohith123"}).json()["access_token"]
    rohith_resp = client.get("/tasks", headers={"Authorization": f"Bearer {rohith_token}"})
    assert rohith_resp.status_code == 200
    rohith_tasks = rohith_resp.json()
    assert len(rohith_tasks) > 0
    for t in rohith_tasks:
        assert t["assignee"] == "Rohith"

    # Verify that even if Rohith attempts to supply a different user_id query, it is strictly ignored
    tampered_resp = client.get("/tasks?user_id=3", headers={"Authorization": f"Bearer {rohith_token}"})
    assert tampered_resp.status_code == 200
    for t in tampered_resp.json():
        assert t["assignee"] == "Rohith"

    # Login as Mayank
    mayank_token = client.post("/login", json={"canonical_name": "Mayank", "password": "mayank123"}).json()["access_token"]
    mayank_resp = client.get("/tasks", headers={"Authorization": f"Bearer {mayank_token}"})
    assert mayank_resp.status_code == 200
    mayank_tasks = mayank_resp.json()
    assert len(mayank_tasks) > 0
    for t in mayank_tasks:
        assert t["assignee"] == "Mayank"

    # Admin should see all tasks
    admin_token = client.post("/login", json={"canonical_name": "Admin", "password": "admin123"}).json()["access_token"]
    admin_resp = client.get("/tasks", headers={"Authorization": f"Bearer {admin_token}"})
    assert admin_resp.status_code == 200
    admin_tasks = admin_resp.json()
    assert len(admin_tasks) >= len(rohith_tasks) + len(mayank_tasks)


def test_strict_privacy_filtering_meetings(client):
    """
    GET /meetings strictly filters by authenticated user's participation or assigned tasks.
    Admin can see all meetings.
    """
    admin_token = client.post("/login", json={"canonical_name": "Admin", "password": "admin123"}).json()["access_token"]
    admin_resp = client.get("/meetings", headers={"Authorization": f"Bearer {admin_token}"})
    assert admin_resp.status_code == 200
    all_meetings = admin_resp.json()
    assert len(all_meetings) >= 2

    # Standard user receives their relevant meetings
    rohith_token = client.post("/login", json={"canonical_name": "Rohith", "password": "rohith123"}).json()["access_token"]
    rohith_resp = client.get("/meetings", headers={"Authorization": f"Bearer {rohith_token}"})
    assert rohith_resp.status_code == 200
    rohith_meetings = rohith_resp.json()
    assert len(rohith_meetings) >= 1


def test_single_meeting_privacy_and_access(client):
    """
    GET /meetings/{meeting_id}:
    - Admin can view any meeting and all its tasks.
    - Participant can view meeting and their assigned tasks.
    - Non-participant gets 403 Forbidden.
    """
    admin_token = client.post("/login", json={"canonical_name": "Admin", "password": "admin123"}).json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Create a private meeting only for Sambhav
    sambhav_token = client.post("/login", json={"canonical_name": "Sambhav", "password": "sambhav123"}).json()["access_token"]
    sambhav_headers = {"Authorization": f"Bearer {sambhav_token}"}

    create_resp = client.post(
        "/meetings",
        json={
            "purpose": "Sambhav Private Architecture Review",
            "scheduled_time": "2026-10-01T10:00:00",
            "config_flags": {"expected_participants": ["Sambhav"]},
            "project_id": 1,
        },
        headers=sambhav_headers,
    )
    assert create_resp.status_code == 201
    private_mid = create_resp.json()["meeting"]["id"]

    # Sambhav (participant) can access
    s_resp = client.get(f"/meetings/{private_mid}", headers=sambhav_headers)
    assert s_resp.status_code == 200
    assert s_resp.json()["id"] == private_mid
    assert "pm_view" in s_resp.json()
    assert "status" in s_resp.json()

    # Rohith (non-participant) gets 403 Forbidden
    rohith_token = client.post("/login", json={"canonical_name": "Rohith", "password": "rohith123"}).json()["access_token"]
    rohith_headers = {"Authorization": f"Bearer {rohith_token}"}
    r_resp = client.get(f"/meetings/{private_mid}", headers=rohith_headers)
    assert r_resp.status_code == 403

    # Admin can access any meeting
    a_resp = client.get(f"/meetings/{private_mid}", headers=admin_headers)
    assert a_resp.status_code == 200
    assert a_resp.json()["id"] == private_mid
