"""
Phase 3 Automated Test Suite: Intake Engine & Lifespan Scheduler
================================================================
Tests Playwright browser stealth flags, aria-live captions observer,
FastAPI lifespan scheduler lifecycle, and POST /schedule persistence in SQLite.
"""

import os
import sys
import json
import sqlite3
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from proxy import app, DB_PATH, init_db, scheduler
import bot


@pytest.fixture(scope="module")
def client():
    """Initializes database and runs FastAPI within lifespan context."""
    init_db()
    with TestClient(app) as test_client:
        yield test_client


def test_browser_stealth_and_audio_flags():
    """
    Verify Playwright bot configuration includes required flags:
    --use-fake-ui-for-media-stream, --use-fake-device-for-media-stream,
    and --disable-blink-features=AutomationControlled.
    """
    # Read bot.py directly to verify args in launch configurations
    bot_code_path = os.path.abspath(bot.__file__)
    with open(bot_code_path, "r", encoding="utf-8") as f:
        code = f.read()

    assert "--use-fake-ui-for-media-stream" in code, "Missing --use-fake-ui-for-media-stream in bot.py"
    assert "--use-fake-device-for-media-stream" in code, "Missing --use-fake-device-for-media-stream in bot.py"
    assert "--disable-blink-features=AutomationControlled" in code, "Missing --disable-blink-features=AutomationControlled in bot.py"


def test_turn_on_captions_selectors():
    """Verify turn_on_selectors in bot.py contains [aria-label="Turn on captions"]."""
    bot_code_path = os.path.abspath(bot.__file__)
    with open(bot_code_path, "r", encoding="utf-8") as f:
        code = f.read()

    assert 'button[aria-label="Turn on captions"]' in code or '[aria-label="Turn on captions"]' in code, (
        "Missing [aria-label='Turn on captions'] in bot turn-on selectors"
    )


def test_aria_live_mutation_observer():
    """Verify bot client-side scraper implements MutationObserver targeting aria-live nodes."""
    bot_code_path = os.path.abspath(bot.__file__)
    with open(bot_code_path, "r", encoding="utf-8") as f:
        code = f.read()

    assert 'ariaLiveObserver' in code or '[aria-live="polite"]' in code, (
        "Missing aria-live MutationObserver in bot.py"
    )
    assert 'MutationObserver' in code, "Missing MutationObserver in bot.py"


def test_scheduler_running_in_lifespan(client: TestClient):
    """Verify APScheduler is running within the FastAPI lifespan context."""
    assert scheduler.running is True, "APScheduler AsyncIOScheduler should be running during lifespan"

    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("scheduler_running") is True, "Expected scheduler_running=True in /health"


def test_schedule_meeting_endpoint_success(client: TestClient):
    """
    Test POST /schedule endpoint:
    - Accepts meet_url, join_time, expected_participants, share_technical_summary, meeting_purpose
    - Persists meeting into SQLite Meetings table
    - Adds scheduled job to APScheduler
    """
    future_time = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    payload = {
        "meet_url": "https://meet.google.com/abc-defg-hij",
        "join_time": future_time,
        "expected_participants": ["Rohith", "Mayank"],
        "share_technical_summary": False,
        "meeting_purpose": "Sprint Architecture Alignment",
        "bot_name": "AegisBot",
        "duration_sec": 1800,
    }

    resp = client.post("/schedule", json=payload)
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["status"] == "scheduled"
    assert "job_id" in data
    assert "meeting_id" in data
    assert data["meeting_purpose"] == "Sprint Architecture Alignment"
    assert data["share_technical_summary"] is False

    job_id = data["job_id"]
    meeting_id = data["meeting_id"]

    # Verify job is scheduled in APScheduler
    job = scheduler.get_job(job_id)
    assert job is not None, f"Expected job {job_id} to be registered in APScheduler"
    assert job.name == "_execute_bot_session" or "_execute_bot_session" in str(job.func)

    # Verify meeting persisted in SQLite Meetings table
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT id, purpose, scheduled_time, config_flags FROM Meetings WHERE id = ?", (meeting_id,))
    row = cursor.fetchone()
    conn.close()

    assert row is not None, f"Meeting {meeting_id} was not found in SQLite Meetings table"
    assert row["purpose"] == "Sprint Architecture Alignment"
    assert row["scheduled_time"] == future_time

    flags = json.loads(row["config_flags"])
    assert flags["share_technical_summary"] is False
    assert "expected_participants" in flags
    # Rohith and Mayank IDs should have been resolved
    assert len(flags["expected_participants"]) >= 1


def test_schedule_meeting_invalid_time_format(client: TestClient):
    """Test POST /schedule with invalid join_time returns 400 Bad Request."""
    payload = {
        "meet_url": "https://meet.google.com/xyz-uvwx-rst",
        "join_time": "invalid-non-iso-timestamp",
        "meeting_purpose": "Test Meeting",
    }
    resp = client.post("/schedule", json=payload)
    assert resp.status_code == 400
    assert "Invalid join_time format" in resp.json()["detail"]


def test_intake_caption_streaming_endpoint(client: TestClient):
    """
    Test POST /intake and POST /api/intake caption streaming:
    - Ingests raw caption chunks
    - Previews privacy masking
    - Feeds into live intake buffer
    """
    payload = {
        "speaker": "Rohith",
        "caption": "Please email the quarterly cloud migration budget to rohith@company.com by 5 PM.",
    }

    # Test /intake route
    resp = client.post("/intake", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "received"
    assert data["length"] == len(payload["caption"])

    # Test /api/intake route
    resp2 = client.post("/api/intake", json=payload)
    assert resp2.status_code == 200

    # Test /api/intake/feed returns recent entries
    feed_resp = client.get("/api/intake/feed?limit=5")
    assert feed_resp.status_code == 200
    feed = feed_resp.json()
    assert isinstance(feed, list)
    assert len(feed) > 0
    latest = feed[-1]
    assert latest["speaker"] == "Rohith"
    assert payload["caption"] in latest["caption"]
    assert "masked_preview" in latest
