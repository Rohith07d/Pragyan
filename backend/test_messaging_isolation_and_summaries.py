import pytest
from fastapi.testclient import TestClient
import sqlite3
import json

from proxy import app, DB_PATH, init_db, build_system_prompt, mock_offline_reasoning


@pytest.fixture
def client():
    init_db()
    with TestClient(app) as c:
        yield c


def test_multi_user_dm_isolation(client: TestClient):
    """
    Verifies strict isolation across all user DMs.
    Mayank sends a message to Sanjeet.
    Only Mayank and Sanjeet must see it.
    Rohith, Sambhav, Pranav, and Admin must NOT see it in their DMs.
    """
    # 1. Clear any prior test chats for these channels
    client.delete("/api/messages", params={"channel_id": "dm-mayank-sanjeet"})
    client.delete("/api/messages", params={"channel_id": "dm-mayank-rohith"})
    client.delete("/api/messages", params={"channel_id": "dm-mayank-sambhav"})
    client.delete("/api/messages", params={"channel_id": "dm-mayank-pranav"})
    client.delete("/api/messages", params={"channel_id": "dm-admin-mayank"})

    # 2. Mayank posts message to Sanjeet
    resp_post = client.post("/api/messages", json={
        "channel_id": "dm-mayank-sanjeet",
        "sender_name": "Mayank Sachdeva",
        "sender_role": "Tech Lead",
        "text": "Confidential: Presidio audit findings for Sanjeet only.",
    })
    assert resp_post.status_code == 201

    # 3. Sanjeet queries dm-sanjeet-mayank (symmetric query)
    resp_sanjeet = client.get("/api/messages", params={"channel_id": "dm-sanjeet-mayank"})
    assert resp_sanjeet.status_code == 200
    sanjeet_msgs = resp_sanjeet.json()
    assert len(sanjeet_msgs) == 1
    assert sanjeet_msgs[0]["text"] == "Confidential: Presidio audit findings for Sanjeet only."

    # 4. Mayank queries dm-mayank-sanjeet
    resp_mayank = client.get("/api/messages", params={"channel_id": "dm-mayank-sanjeet"})
    assert resp_mayank.status_code == 200
    assert len(resp_mayank.json()) == 1

    # 5. Rohith queries dm-mayank-rohith (Must NOT see Sanjeet's message)
    resp_rohith = client.get("/api/messages", params={"channel_id": "dm-mayank-rohith"})
    assert resp_rohith.status_code == 200
    rohith_texts = [m["text"] for m in resp_rohith.json()]
    assert "Confidential: Presidio audit findings for Sanjeet only." not in rohith_texts

    # 6. Sambhav queries dm-mayank-sambhav (Must NOT see Sanjeet's message)
    resp_sambhav = client.get("/api/messages", params={"channel_id": "dm-mayank-sambhav"})
    assert resp_sambhav.status_code == 200
    sambhav_texts = [m["text"] for m in resp_sambhav.json()]
    assert "Confidential: Presidio audit findings for Sanjeet only." not in sambhav_texts

    # 7. Pranav queries dm-mayank-pranav (Must NOT see Sanjeet's message)
    resp_pranav = client.get("/api/messages", params={"channel_id": "dm-mayank-pranav"})
    assert resp_pranav.status_code == 200
    pranav_texts = [m["text"] for m in resp_pranav.json()]
    assert "Confidential: Presidio audit findings for Sanjeet only." not in pranav_texts

    # 8. Admin queries dm-admin-mayank (Must NOT see Sanjeet's message)
    resp_admin = client.get("/api/messages", params={"channel_id": "dm-admin-mayank"})
    assert resp_admin.status_code == 200
    admin_texts = [m["text"] for m in resp_admin.json()]
    assert "Confidential: Presidio audit findings for Sanjeet only." not in admin_texts


def test_user_scoped_aegisbot_isolation(client: TestClient):
    """
    Verifies that AegisBot private channels are isolated per user.
    Mayank messages AegisBot in dm-aegisbot-mayank.
    Rohith (dm-aegisbot-rohith) and Sanjeet (dm-aegisbot-sanjeet) do NOT see Mayank's bot chat.
    """
    # 1. Clear test channels
    client.delete("/api/messages", params={"channel_id": "dm-aegisbot-mayank"})
    client.delete("/api/messages", params={"channel_id": "dm-aegisbot-sanjeet"})

    # 2. Mayank queries his AegisBot channel before sending any message -> gets welcome message
    resp_init = client.get("/api/messages", params={"channel_id": "dm-aegisbot-mayank"})
    assert resp_init.status_code == 200
    init_msgs = resp_init.json()
    assert len(init_msgs) == 1
    assert "Hello! I am AegisBot" in init_msgs[0]["text"]

    # 3. Mayank sends question to AegisBot
    resp_send = client.post("/api/messages", json={
        "channel_id": "dm-aegisbot-mayank",
        "sender_name": "Mayank Sachdeva",
        "sender_role": "Tech Lead",
        "text": "Mayank: Check cloud tunnel status.",
    })
    assert resp_send.status_code == 201
    assert resp_send.json()["bot_reply"] is not None

    # 4. Mayank reads dm-aegisbot-mayank -> has 2 messages (user query + bot reply)
    resp_read = client.get("/api/messages", params={"channel_id": "dm-aegisbot-mayank"})
    assert resp_read.status_code == 200
    mayank_bot_msgs = resp_read.json()
    assert len(mayank_bot_msgs) == 2
    assert mayank_bot_msgs[0]["text"] == "Mayank: Check cloud tunnel status."

    # 5. Sanjeet reads dm-aegisbot-sanjeet -> does NOT see Mayank's query
    resp_sanjeet_bot = client.get("/api/messages", params={"channel_id": "dm-aegisbot-sanjeet"})
    assert resp_sanjeet_bot.status_code == 200
    sanjeet_bot_texts = [m["text"] for m in resp_sanjeet_bot.json()]
    assert "Mayank: Check cloud tunnel status." not in sanjeet_bot_texts


def test_comprehensive_meeting_summaries_coverage(client: TestClient):
    """
    Verifies meeting summaries are rich, multi-point, and cover all aspects:
    PM View, Group View, and Absentee View.
    """
    # 1. Login as Admin to get auth token
    login_resp = client.post("/api/auth/login", json={"canonical_name": "Admin", "password": "admin123"})
    assert login_resp.status_code == 200
    headers = {"Authorization": f"Bearer {login_resp.json()['token']}"}

    # 2. Check seeded Meeting 1
    resp_m1 = client.get("/api/meetings/1", headers=headers)
    assert resp_m1.status_code == 200
    m1 = resp_m1.json()

    assert m1["pm_view"] is not None
    assert len(m1["pm_view"].split("\n")) >= 4
    assert "Executive & Technical Risk Assessment" in m1["pm_view"]

    assert m1["group_view"] is not None
    assert len(m1["group_view"].split("\n")) >= 4
    assert "Comprehensive Group Decisions" in m1["group_view"]

    assert m1["absent_view"] is not None
    assert len(m1["absent_view"].split("\n")) >= 4
    assert "Absentee Comprehensive Catch-Up" in m1["absent_view"]

    # 2. Check offline reasoning generates multi-point views
    reasoning = mock_offline_reasoning(
        "[PERSON_1] reported on security and [PERSON_2] managed task routing.",
        meeting_purpose="Quarterly Architecture Review",
        share_technical_summary=True,
    )
    assert len(reasoning["pm_view"]) > 200
    assert len(reasoning["group_view"]) > 200
    assert len(reasoning["absent_view"]) > 200
    assert "### " in reasoning["pm_view"]
    assert "• " in reasoning["group_view"]
    assert "**" in reasoning["absent_view"]
