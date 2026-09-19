"""
Phase 4 Automated Test Suite: Dynamic Privacy Masking & Context-Aware Prompts
=============================================================================
Tests dynamic alias normalization, dynamic Presidio PatternRecognizer deny-list,
meeting configs on /join and /schedule, LLM prompt generation, and strict
'unknown' deadline rule enforcement.
"""

import os
import sys
import json
import sqlite3
import pytest
from fastapi.testclient import TestClient

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from proxy import (
    app,
    DB_PATH,
    init_db,
    normalize_transcript_aliases,
    get_canonical_names_for_participants,
    mask_transcript,
    build_system_prompt,
    mock_offline_reasoning,
    get_ephemeral_ram,
    wipe_ephemeral_ram,
)


@pytest.fixture(scope="module")
def client():
    """Initializes database and provides FastAPI test client."""
    init_db()
    with TestClient(app) as test_client:
        yield test_client


def test_dynamic_alias_normalization():
    """
    Verify normalize_transcript_aliases queries UserAliases and rewrites
    phonetic misspellings/separated syllables to canonical names before Presidio.
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Find Rohith user id
    cursor.execute("SELECT id FROM Users WHERE LOWER(canonical_name) = 'rohith'")
    row = cursor.fetchone()
    assert row is not None, "User 'Rohith' should exist in database"
    rohith_id = row[0]

    # Insert test aliases for Rohith
    cursor.execute(
        "INSERT OR IGNORE INTO UserAliases (user_id, alias_string) VALUES (?, ?)",
        (rohith_id, "Row hit"),
    )
    cursor.execute(
        "INSERT OR IGNORE INTO UserAliases (user_id, alias_string) VALUES (?, ?)",
        (rohith_id, "Ro-hith"),
    )
    conn.commit()
    conn.close()

    raw_text = "Row hit mentioned that Ro-hith will deploy the database proxy."
    normalized = normalize_transcript_aliases(raw_text, expected_participants=[rohith_id])

    assert "Row hit" not in normalized
    assert "Ro-hith" not in normalized
    assert "Rohith" in normalized
    assert normalized == "Rohith mentioned that Rohith will deploy the database proxy."


def test_normalize_api_endpoint(client: TestClient):
    """Test POST /api/normalize inspection endpoint."""
    payload = {
        "transcript": "Row hit will lead the standup today.",
        "expected_participants": ["Rohith"],
    }
    resp = client.post("/api/normalize", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["rewritten"] is True
    assert "Rohith will lead the standup today." in data["normalized_transcript"]


def test_dynamic_presidio_recognizer_targets_expected_participants():
    """
    Verify get_canonical_names_for_participants and dynamic PatternRecognizer
    strictly target canonical names of the expected participants.
    """
    wipe_ephemeral_ram()
    # When expected_participants is specifically Rohith
    target_names = get_canonical_names_for_participants(["Rohith"])
    assert "Rohith" in target_names

    # Mask with expected_participants=["Rohith"]
    text = "Rohith and John Doe will review the specifications."
    mask_res = mask_transcript(text, expected_participants=["Rohith"])

    # Rohith should be masked as [PERSON_X]
    assert "Rohith" not in mask_res["masked_text"]
    assert "[PERSON_" in mask_res["masked_text"]

    token_map = mask_res["token_map"]
    assert any(val == "Rohith" for val in token_map.values())
    wipe_ephemeral_ram()


def test_join_meeting_endpoint_persists_meeting_configs(client: TestClient):
    """
    Verify POST /join accepts expected_participants, share_technical_summary,
    and meeting_purpose, persisting them in SQLite Meetings table.
    """
    payload = {
        "meet_url": "https://meet.google.com/abc-join-test",
        "expected_participants": ["Rohith", "Mayank"],
        "share_technical_summary": False,
        "meeting_purpose": "Executive Leadership Review",
        "bot_name": "AegisBot Live",
    }
    resp = client.post("/join", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["status"] == "launched"
    assert "meeting_id" in data
    assert data["meeting_purpose"] == "Executive Leadership Review"
    assert data["share_technical_summary"] is False

    meeting_id = data["meeting_id"]

    # Verify meeting persisted in SQLite
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT purpose, config_flags FROM Meetings WHERE id = ?", (meeting_id,))
    row = cursor.fetchone()
    conn.close()

    assert row is not None
    assert row["purpose"] == "Executive Leadership Review"
    flags = json.loads(row["config_flags"])
    assert flags["share_technical_summary"] is False
    assert len(flags["expected_participants"]) >= 1


def test_build_system_prompt_rules():
    """
    Verify build_system_prompt injects meeting_purpose, strict unknown deadline rule,
    and technical detail filter based on share_technical_summary.
    """
    # 1. With share_technical_summary = True
    prompt_tech = build_system_prompt(
        meeting_purpose="Zero-Leak Cryptographic Architecture",
        share_technical_summary=True,
    )
    assert "Zero-Leak Cryptographic Architecture" in prompt_tech
    assert "DEADLINE ENFORCEMENT" in prompt_tech
    assert "unknown" in prompt_tech
    assert "Include technical architecture details" in prompt_tech

    # 2. With share_technical_summary = False
    prompt_exec = build_system_prompt(
        meeting_purpose="Board of Directors Sync",
        share_technical_summary=False,
    )
    assert "Board of Directors Sync" in prompt_exec
    assert "OMIT deeply technical architecture details" in prompt_exec
    assert "Provide concise, high-level operational and business-friendly summaries only" in prompt_exec


def test_mock_offline_reasoning_strict_deadlines_and_technical_filter():
    """
    Verify mock_offline_reasoning enforces 'unknown' when no date/time is in transcript,
    and captures explicit dates when present. Also checks technical filter.
    """
    # Case A: Transcript with NO explicit deadline mentioned
    no_deadline_transcript = "[PERSON_1] will write the API tests and [PERSON_2] will deploy."
    res_a = mock_offline_reasoning(
        no_deadline_transcript,
        meeting_purpose="Sprint Sync",
        share_technical_summary=False,
    )
    assert res_a["tasks"][0]["deadline"] == "unknown"
    assert res_a["tasks"][1]["deadline"] == "unknown"
    # Verify non-technical summary
    assert "Executive overview" in res_a["pm_view"]
    assert "Sprint Sync" in res_a["pm_view"]

    # Case B: Transcript with explicit deadline ("tomorrow at 5:00 PM")
    with_deadline_transcript = "[PERSON_1] must deploy tomorrow at 5:00 PM."
    res_b = mock_offline_reasoning(
        with_deadline_transcript,
        meeting_purpose="Infra Sync",
        share_technical_summary=True,
    )
    assert "tomorrow at 5:00 pm" in res_b["tasks"][0]["deadline"].lower()
    # Verify technical summary present
    assert "Technical review" in res_b["pm_view"]


def test_full_pipeline_phase4_end_to_end(client: TestClient):
    """
    Verify full end-to-end pipeline on POST /api/process:
    1. Dynamic Normalization rewrites ASR misspelling ("Row hit" -> "Rohith")
    2. Dynamic Presidio masks Rohith & Sambhav
    3. LLM contextualized with meeting_purpose & share_technical_summary
    4. Rehydration maps back identities
    5. Tasks persisted in SQLite with deadline='unknown' and meeting_id
    6. Ephemeral RAM wiped
    """
    wipe_ephemeral_ram()
    import proxy
    proxy._ACTIVE_MEETING_CONFIG = {}

    # Raw transcript with ASR misspellings and NO deadlines mentioned
    raw_transcript = (
        "Row hit said he will build the authentication flow and Sambhav will verify the user portal."
    )

    payload = {
        "transcript": raw_transcript,
        "meeting_purpose": "Security Hardening Milestone",
        "share_technical_summary": False,
        "expected_participants": ["Rohith", "Sambhav"],
    }

    resp = client.post("/api/process", json=payload)
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert data["status"] == "success"
    assert data["meeting_purpose"] == "Security Hardening Milestone"
    assert data["share_technical_summary"] is False

    # Check normalized transcript
    assert "Rohith" in data["normalized_transcript"]
    assert "Row hit" not in data["normalized_transcript"]

    # Check intercepted cloud payload only contains masked text
    cloud_payload = data["intercepted_cloud_payload"]
    sent_text = cloud_payload["sent_sanitized_text"]
    assert "Rohith" not in sent_text
    assert "Row hit" not in sent_text
    assert "Sambhav" not in sent_text
    assert "[PERSON_" in sent_text

    # Check rehydrated result restored real names
    rehydrated = data["rehydrated_result"]
    assert len(rehydrated["tasks"]) >= 1

    # Check that deadlines are 'unknown' since no date was mentioned
    for task in rehydrated["tasks"]:
        assert task["deadline"] == "unknown", f"Expected deadline to be 'unknown', got: {task['deadline']}"

    # Check tasks persisted in SQLite
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    saved_ids = data["saved_task_ids"]
    assert len(saved_ids) > 0

    cursor.execute("SELECT id, assignee_id, task, deadline FROM Tasks WHERE id = ?", (saved_ids[0],))
    task_row = cursor.fetchone()
    conn.close()

    assert task_row is not None
    assert task_row["deadline"] == "unknown"
    assert task_row["assignee_id"] is not None

    # Verify ephemeral RAM wiped
    assert get_ephemeral_ram() == {}, "Ephemeral RAM should be completely cleared"
