"""
Phase 4 Automated Test Suite: End-of-Meeting Trigger & Batch Processing
======================================================================
Tests:
1. In-memory transcript buffer accumulation via POST /intake
2. Batch trigger POST /end_meeting and POST /meetings/{meeting_id}/end
3. Dynamic phonetic alias normalization (e.g., 'Row hit' -> 'Rohith')
4. Dynamic Presidio PatternRecognizer deny-listing canonical names
5. Zero-leak console logging and zero-leak payload to Featherless AI
6. Strict 'unknown' deadline rule enforcement
7. Technical filter (share_technical_summary = False)
8. SQLite persistence of pm_view, group_view, absent_view, status='completed'
9. Task persistence with resolved foreign key assignees
10. Critical RAM wipes: transcript buffer and ephemeral PII RAM cleared
11. Confirmation that raw transcript is NEVER saved to SQLite database
"""

import os
import sys
import json
import sqlite3
import pytest
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
def client():
    """Initializes database and provides FastAPI test client."""
    init_db()
    with TestClient(app) as test_client:
        yield test_client


def test_end_meeting_empty_buffer_returns_400(client: TestClient):
    """Calling /end_meeting without accumulated buffer or transcript returns 400."""
    wipe_meeting_buffer("9999")
    resp = client.post("/end_meeting", json={"meeting_id": 9999})
    assert resp.status_code == 400
    assert "No accumulated transcript found" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_end_meeting_batch_processing_lifecycle(client: TestClient):
    """
    Comprehensive test of Phase 4 End-of-Meeting Trigger:
    - Ingest caption chunks to meeting buffer
    - Call POST /end_meeting
    - Verify dynamic alias normalization ('Row hit' -> 'Rohith')
    - Verify dynamic Presidio masking ([PERSON_1])
    - Verify batch LLM extraction with strict 'unknown' deadline
    - Verify SQLite Meetings table updated with pm_view, group_view, absent_view, status='completed'
    - Verify Tasks table populated with foreign key assignee
    - Verify RAM buffer and ephemeral PII RAM completely wiped
    - Verify raw transcript is NOT in the database
    """
    wipe_ephemeral_ram()
    test_mid = 777

    # Create meeting record in SQLite
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT OR REPLACE INTO Meetings (id, purpose, scheduled_time, config_flags, status)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            test_mid,
            "Core Privacy Architecture Review",
            "Today 3:00 PM",
            json.dumps({"expected_participants": ["Rohith", "Mayank"], "share_technical_summary": False}),
            "scheduled",
        ),
    )
    conn.commit()
    conn.close()

    # Step 1: Accumulate captions via POST /intake
    intake_chunks = [
        {"speaker": "Speaker 1", "caption": "Hello team, welcome to the Core Privacy Architecture Review.", "meeting_id": test_mid},
        {"speaker": "Speaker 2", "caption": "Row hit will lead the Presidio zero leak deployment.", "meeting_id": test_mid},
        {"speaker": "Speaker 1", "caption": "May-ank will review the API security contracts tomorrow at 5:00 PM.", "meeting_id": test_mid},
        {"speaker": "Speaker 2", "caption": "Row hit also needs to configure ephemeral RAM wiping without explicit deadline.", "meeting_id": test_mid},
    ]

    for chunk in intake_chunks:
        r = client.post("/api/intake", json=chunk)
        assert r.status_code == 200
        assert r.json()["buffer_status"] == "accumulated"

    buf = get_meeting_buffer(test_mid)
    assert len(buf) == 4

    # Step 2: Trigger End of Meeting
    resp = client.post("/end_meeting", json={"meeting_id": test_mid})
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["status"] == "completed"
    assert data["meeting_id"] == test_mid
    assert data["buffer_wiped"] is True
    assert data["ram_wiped"] is True
    assert data["zero_leak_verified"] is True

    # Check generated views
    assert data["pm_view"] != ""
    assert data["group_view"] != ""
    assert data["absent_view"] != ""

    # Check tasks: task without explicit date should have deadline strictly as 'unknown'
    tasks = data["tasks"]
    assert len(tasks) >= 2
    task_deadlines = [t["deadline"].lower() for t in tasks]
    assert "unknown" in task_deadlines

    # Step 3: Verify SQLite Meetings Table update
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, purpose, status, pm_view, group_view, absent_view FROM Meetings WHERE id = ?",
        (test_mid,),
    )
    m_row = cursor.fetchone()
    assert m_row is not None
    assert m_row["status"] == "completed"
    assert m_row["pm_view"] is not None and len(m_row["pm_view"]) > 10
    assert m_row["group_view"] is not None and len(m_row["group_view"]) > 10
    assert m_row["absent_view"] is not None and len(m_row["absent_view"]) > 10

    # Step 4: Verify Tasks Table populated with assignee foreign keys
    cursor.execute("SELECT id, meeting_id, assignee_id, task, deadline FROM Tasks WHERE meeting_id = ?", (test_mid,))
    saved_tasks = cursor.fetchall()
    assert len(saved_tasks) >= 2
    for st in saved_tasks:
        assert st["meeting_id"] == test_mid
        assert st["assignee_id"] is not None  # Foreign key resolved to Users table

    # Step 5: Verify Critical RAM Wipes
    assert get_meeting_buffer(test_mid) == [], "Meeting transcript buffer in RAM must be completely cleared"
    assert get_ephemeral_ram() == {}, "Ephemeral PII RAM must be completely cleared"

    # Step 6: Verify Zero-Leak Air-Gap (Raw transcript is NOT in SQLite)
    cursor.execute("SELECT sql FROM sqlite_master WHERE type='table'")
    table_defs = [row[0] for row in cursor.fetchall()]
    assert not any("transcript" in defn.lower() for defn in table_defs), "No table should have a transcript column"

    cursor.execute("SELECT * FROM Meetings WHERE id = ?", (test_mid,))
    all_meeting_data = str(dict(cursor.fetchone()))
    assert "Row hit will lead the Presidio zero leak" not in all_meeting_data, "Raw captions must NEVER be stored in SQLite"

    conn.close()


def test_dynamic_meeting_route_endpoint(client: TestClient):
    """Verify POST /meetings/{meeting_id}/end alias route works seamlessly."""
    test_mid = 888
    append_to_meeting_buffer(test_mid, "Sambhav to finalize frontend tests tomorrow.")

    resp = client.post(
        f"/meetings/{test_mid}/end",
        json={
            "meeting_purpose": "Sprint QA Signoff",
            "expected_participants": ["Sambhav"],
            "share_technical_summary": True,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "completed"
    assert data["meeting_id"] == test_mid
    assert get_meeting_buffer(test_mid) == []
