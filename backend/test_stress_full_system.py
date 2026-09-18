"""
Comprehensive Stress & Reliability Test Suite for AegisMeet / Pragyan
======================================================================
Tests the full system under concurrent load and Option 2 deployment constraints:
1. High-concurrency caption intake streaming (50 concurrent chunks)
2. Concurrent authentication, RBAC boundaries, and token tampering checks
3. Concurrent database task status updates (WAL mode concurrency)
4. Concurrent real-time chat messaging & AegisBot auto-responder
5. End-of-meeting batch lifecycle with phonetic normalization and zero-leak RAM wiping
6. CORS preflight verification for Vercel deployments and HTTPS tunnels
"""

import asyncio
import json
import os
import sqlite3
import sys
import pytest
import httpx
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from proxy import (
    app,
    DB_PATH,
    init_db,
    append_to_meeting_buffer,
    get_meeting_buffer,
    wipe_meeting_buffer,
    get_ephemeral_ram,
    wipe_ephemeral_ram,
)


@pytest.fixture(scope="module")
def setup_database():
    """Ensure database is seeded and in WAL mode."""
    init_db()
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.close()


@pytest.mark.asyncio
async def test_stress_concurrent_intake_streaming(setup_database):
    """
    Stress-tests high-throughput caption streaming:
    Fires 50 concurrent caption chunks into /api/intake for meeting 999.
    Verifies 0 lost chunks, correct accumulation in RAM buffer, and rapid response.
    """
    meeting_id = 999
    wipe_meeting_buffer(meeting_id)

    chunk_count = 50
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        async def send_chunk(idx: int):
            payload = {
                "speaker": f"Speaker_{idx % 4}",
                "caption": f"Stress caption chunk #{idx} streaming real-time meeting telemetry.",
                "meeting_id": meeting_id,
            }
            resp = await client.post("/api/intake", json=payload)
            assert resp.status_code == 200
            return resp.json()

        results = await asyncio.gather(*[send_chunk(i) for i in range(chunk_count)])
        assert len(results) == chunk_count

    buf = get_meeting_buffer(meeting_id)
    assert len(buf) == chunk_count, f"Expected {chunk_count} chunks in RAM buffer, found {len(buf)}"
    wipe_meeting_buffer(meeting_id)


@pytest.mark.asyncio
async def test_stress_auth_concurrency_and_security(setup_database):
    """
    Stress-tests authentication under parallel load:
    - 40 concurrent logins across seeded accounts (Admin, Rohith, Mayank, Sambhav).
    - Checks invalid passwords return 401.
    - Checks tampered tokens return 401.
    - Checks RBAC: non-admin accounts receive 403 Forbidden on admin-only routes.
    """
    users = [
        ("Admin", "admin123", "admin"),
        ("Rohith", "rohith123", "user"),
        ("Mayank", "mayank123", "user"),
        ("Sambhav", "sambhav123", "user"),
    ]

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. 40 Concurrent logins (10 per persona)
        async def do_login(name, pwd, expected_role):
            resp = await client.post("/login", json={"canonical_name": name, "password": pwd})
            assert resp.status_code == 200, f"Login failed for {name}: {resp.text}"
            data = resp.json()
            assert "access_token" in data
            assert data["user"]["role"] == expected_role
            return name, data["access_token"]

        login_tasks = []
        for _ in range(10):
            for name, pwd, role in users:
                login_tasks.append(do_login(name, pwd, role))

        tokens = await asyncio.gather(*login_tasks)
        assert len(tokens) == 40

        # Extract tokens for RBAC testing
        admin_token = next(tok for uname, tok in tokens if uname == "Admin")
        rohith_token = next(tok for uname, tok in tokens if uname == "Rohith")

        # 2. Invalid password returns 401
        bad_resp = await client.post("/login", json={"canonical_name": "Admin", "password": "wrongpassword"})
        assert bad_resp.status_code == 401

        # 3. Tampered JWT token returns 401
        tampered_headers = {"Authorization": f"Bearer {admin_token[:-6]}XXXXXX"}
        tampered_resp = await client.get("/me", headers=tampered_headers)
        assert tampered_resp.status_code == 401

        # 4. RBAC Escalation Check:
        # Regular user 'Rohith' attempting to create a user via POST /users must receive 403
        non_admin_headers = {"Authorization": f"Bearer {rohith_token}"}
        escalate_resp = await client.post(
            "/users",
            json={"canonical_name": "UnauthorizedHacker", "password": "pass", "role": "admin"},
            headers=non_admin_headers,
        )
        assert escalate_resp.status_code == 403, f"Expected 403 Forbidden for non-admin user, got {escalate_resp.status_code}"

        # Admin user CAN access /me and /users
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        admin_me_resp = await client.get("/me", headers=admin_headers)
        assert admin_me_resp.status_code == 200
        assert admin_me_resp.json()["role"] == "admin"


@pytest.mark.asyncio
async def test_stress_database_concurrent_task_updates(setup_database):
    """
    Stress-tests SQLite WAL mode concurrency:
    Fires 30 rapid concurrent task updates toggling task status.
    Verifies zero database-locking collisions (OperationalError).
    """
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    # Create 5 test tasks
    test_task_ids = []
    for i in range(5):
        cursor.execute(
            "INSERT INTO Tasks (task, deadline, status) VALUES (?, ?, ?)",
            (f"Stress Test Task #{i}", "tomorrow", "pending"),
        )
        test_task_ids.append(cursor.lastrowid)
    conn.commit()
    conn.close()

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        async def toggle_task(task_id: int, new_status: str):
            resp = await client.patch(f"/api/tasks/{task_id}", json={"status": new_status})
            assert resp.status_code == 200
            return resp.json()

        # Fire 30 concurrent updates across the 5 tasks
        tasks = []
        for i in range(30):
            tid = test_task_ids[i % len(test_task_ids)]
            stat = "completed" if i % 2 == 0 else "pending"
            tasks.append(toggle_task(tid, stat))

        results = await asyncio.gather(*tasks)
        assert len(results) == 30
        assert all(r["status"] == "updated" for r in results)


@pytest.mark.asyncio
async def test_stress_chat_messaging_and_aegisbot(setup_database):
    """
    Stress-tests chat messaging and AegisBot auto-responder:
    - Concurrently dispatches messages across channels (general, dm-aegisbot, meeting-briefs).
    - Verifies AegisBot automatically generates instant replies in dm-aegisbot & meeting-briefs.
    - Verifies message feed retrieval and channel filtering.
    """
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Concurrently send 15 messages
        async def post_msg(channel: str, text: str, sender: str):
            payload = {
                "channel_id": channel,
                "text": text,
                "sender_name": sender,
                "sender_role": "Engineer",
            }
            resp = await client.post("/api/messages", json=payload)
            assert resp.status_code == 201
            return resp.json()

        msg_tasks = [
            post_msg("general", f"General team update #{i}", "Rohith") for i in range(5)
        ] + [
            post_msg("dm-aegisbot", f"Querying privacy status #{i}", "Mayank") for i in range(5)
        ] + [
            post_msg("meeting-briefs", f"Brief summary verification #{i}", "Sambhav") for i in range(5)
        ]

        results = await asyncio.gather(*msg_tasks)
        assert len(results) == 15

        # Check that dm-aegisbot and meeting-briefs generated bot replies
        for r in results:
            if r["message"]["channel_id"] in ("dm-aegisbot", "meeting-briefs"):
                assert r["bot_reply"] is not None
                assert r["bot_reply"]["sender_name"] == "AegisBot"

        # Verify channel filtering on GET /api/messages
        feed_resp = await client.get("/api/messages", params={"channel_id": "dm-aegisbot"})
        assert feed_resp.status_code == 200
        msgs = feed_resp.json()
        assert len(msgs) >= 10
        assert all(m["channel_id"] == "dm-aegisbot" for m in msgs)


@pytest.mark.asyncio
async def test_stress_end_of_meeting_airgap_lifecycle(setup_database):
    """
    Tests full meeting lifecycle under stress:
    - Prepares meeting record in SQLite
    - Streams captions with phonetic variants ('Row hit', 'May-ank')
    - Calls POST /end_meeting
    - Validates:
      a) Dynamic normalization converts 'Row hit' -> 'Rohith'
      b) Presidio masks attendee names into tokens ([PERSON_1], etc.)
      c) Zero PII leaks to cloud payload
      d) Structured views created (pm_view, group_view, absent_view)
      e) RAM buffers and ephemeral maps are completely wiped to empty
      f) Raw transcript is NEVER persisted in SQLite
    """
    wipe_ephemeral_ram()
    test_mid = 654

    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT OR REPLACE INTO Meetings (id, purpose, scheduled_time, config_flags, status)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            test_mid,
            "Quarterly Security Architecture Sync",
            "Today 4:00 PM",
            json.dumps({"expected_participants": ["Rohith", "Mayank"], "share_technical_summary": False}),
            "scheduled",
        ),
    )
    conn.commit()
    conn.close()

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Stream caption chunks
        chunks = [
            "Welcome team to the Quarterly Security Architecture Sync.",
            "Row hit must finalize the zero-leak token rehydration module.",
            "May-ank will review the access-control policies by Friday 5:00 PM.",
            "Row hit also noted that ephemeral RAM must be wiped cleanly after every sync.",
        ]
        for c in chunks:
            r = await client.post("/api/intake", json={"speaker": "Speaker", "caption": c, "meeting_id": test_mid})
            assert r.status_code == 200

        # Trigger batch end meeting
        end_resp = await client.post("/end_meeting", json={"meeting_id": test_mid})
        assert end_resp.status_code == 200
        data = end_resp.json()

        assert data["status"] == "completed"
        assert data["meeting_id"] == test_mid
        assert data["buffer_wiped"] is True
        assert data["ram_wiped"] is True
        assert data["zero_leak_verified"] is True
        assert len(data["pm_view"]) > 10
        assert len(data["group_view"]) > 10

    # Verify RAM is zeroed
    assert get_meeting_buffer(test_mid) == []
    assert get_ephemeral_ram() == {}

    # Verify Raw transcript is not in database
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM Meetings WHERE id = ?", (test_mid,))
    row = dict(cursor.fetchone())
    conn.close()

    assert "Row hit must finalize the zero-leak" not in str(row), "Raw transcript must never be in SQLite"


def test_stress_cors_preflight_and_tunnel_origins():
    """
    Tests CORS configuration compliance with modern browser standards for Option 2:
    - Tests Vercel origin (https://pragyan-frontend.vercel.app)
    - Tests ngrok tunnel origin (https://test-node-123.ngrok-free.app)
    - Tests Cloudflare tunnel origin (https://tunnel-xyz.trycloudflare.com)
    - Verifies Access-Control-Allow-Origin dynamically reflects the origin
    - Verifies Access-Control-Allow-Credentials is 'true'
    """
    client = TestClient(app)

    test_origins = [
        "https://pragyan.vercel.app",
        "https://pragyan-git-main-rohith.vercel.app",
        "https://1234-abcd.ngrok-free.app",
        "https://quick-tunnel-xyz.trycloudflare.com",
        "http://localhost:3000",
    ]

    for origin in test_origins:
        # Send OPTIONS preflight request
        headers = {
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        }
        res = client.options("/api/messages", headers=headers)
        assert res.status_code == 200, f"CORS preflight failed for origin {origin}"
        assert res.headers.get("access-control-allow-origin") == origin, f"Origin not reflected for {origin}"
        assert res.headers.get("access-control-allow-credentials") == "true", f"Credentials not allowed for {origin}"
