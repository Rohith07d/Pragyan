"""
Phase 2 Automated Test Suite: Autonomous Alias Generation
=========================================================
Tests Featherless AI phonetic alias generation, fallback resilience,
database population in UserAliases, and admin user creation integration.
"""

import os
import sys
import uuid
import sqlite3
import pytest
from fastapi.testclient import TestClient

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from proxy import (
    app,
    DB_PATH,
    init_db,
    generate_phonetic_aliases,
    generate_fallback_aliases,
    save_user_aliases_to_db,
)


@pytest.fixture(scope="module")
def client():
    init_db()
    with TestClient(app) as test_client:
        yield test_client


@pytest.mark.asyncio
async def test_generate_phonetic_aliases_returns_15_variants():
    """Verify generate_phonetic_aliases produces at least 15 phonetic misspellings."""
    test_names = ["Rohith", "Mayank Sachdeva", "Sambhav Chordia", "D Rohith"]
    for name in test_names:
        aliases = await generate_phonetic_aliases(name)
        assert isinstance(aliases, list)
        assert len(aliases) >= 15, f"Expected at least 15 aliases for {name}, got {len(aliases)}"
        # Verify no duplicate entries
        assert len(aliases) == len(set(a.lower() for a in aliases))


def test_fallback_aliases_coverage():
    """Verify the deterministic fallback generator covers syllable splits and phonetic shifts."""
    fallback = generate_fallback_aliases("Mayank Sachdeva")
    assert len(fallback) >= 15
    # Should contain syllable split or phonetic shift
    assert any(" " in a or "-" in a for a in fallback)


def test_admin_create_user_autopopulates_aliases(client):
    """
    When Admin creates a user via POST /users, UserAliases must be
    automatically populated with generated aliases + user's first name.
    """
    # 1. Login as Admin
    admin_login = client.post("/login", json={"canonical_name": "Admin", "password": "admin123"}).json()
    admin_token = admin_login["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 2. Create new user with first & last name
    unique_suffix = uuid.uuid4().hex[:6]
    test_name = f"Kavya Narang_{unique_suffix}"
    first_name = test_name.split()[0]

    resp = client.post(
        "/users",
        json={"canonical_name": test_name, "password": "kavyapassword123", "role": "user"},
        headers=admin_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "created"
    assert data["user"]["canonical_name"] == test_name
    assert "aliases" in data["user"]
    assert data["user"]["aliases_count"] >= 15

    new_user_id = data["user"]["id"]

    # 3. Query SQLite UserAliases table directly
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT alias_string FROM UserAliases WHERE user_id = ?", (new_user_id,))
    stored_aliases = [r[0] for r in cursor.fetchall()]
    conn.close()

    assert len(stored_aliases) >= 16  # Canonical + first name + 15 variants
    # User's first name and canonical name must be in the stored aliases
    assert any(a.lower() == test_name.lower() for a in stored_aliases)
    assert any(a.lower() == first_name.lower() for a in stored_aliases)


def test_alias_generation_error_resilience(client, monkeypatch):
    """
    If Featherless AI call fails, times out, or throws an exception,
    user creation must NOT break and fallback aliases must be persisted.
    """
    # Simulate AI failure by monkeypatching generate_phonetic_aliases to raise an error
    async def mock_crashing_generator(canonical_name: str):
        raise ConnectionError("Simulated Featherless AI connection timeout (504)")

    monkeypatch.setattr("proxy.generate_phonetic_aliases", mock_crashing_generator)

    admin_token = client.post("/login", json={"canonical_name": "Admin", "password": "admin123"}).json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    unique_name = f"ResilienceUser_{uuid.uuid4().hex[:6]}"
    resp = client.post(
        "/users",
        json={"canonical_name": unique_name, "password": "resiliencepass", "role": "user"},
        headers=admin_headers,
    )
    # Must succeed (201 Created) despite AI outage
    assert resp.status_code == 201
    user_data = resp.json()["user"]
    assert user_data["canonical_name"] == unique_name
    assert user_data["aliases_count"] >= 15

    # Verify fallback aliases saved in DB
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT alias_string FROM UserAliases WHERE user_id = ?", (user_data["id"],))
    db_aliases = [r[0] for r in cursor.fetchall()]
    conn.close()
    assert len(db_aliases) >= 15


def test_get_aliases_privacy_and_access(client):
    """
    GET /aliases:
    - Normal user receives only their own aliases.
    - Admin receives aliases across users.
    """
    # Normal user Rohith
    rohith_token = client.post("/login", json={"canonical_name": "Rohith", "password": "rohith123"}).json()["access_token"]
    rohith_resp = client.get("/aliases", headers={"Authorization": f"Bearer {rohith_token}"})
    assert rohith_resp.status_code == 200
    rohith_aliases = rohith_resp.json()
    for a in rohith_aliases:
        assert a["canonical_name"] == "Rohith"

    # Admin
    admin_token = client.post("/login", json={"canonical_name": "Admin", "password": "admin123"}).json()["access_token"]
    admin_resp = client.get("/aliases", headers={"Authorization": f"Bearer {admin_token}"})
    assert admin_resp.status_code == 200
    all_aliases = admin_resp.json()
    assert len(all_aliases) > len(rohith_aliases)


def test_on_demand_alias_generation_endpoint(client):
    """Verify POST /api/aliases/generate endpoint returns 15 variants."""
    user_token = client.post("/login", json={"canonical_name": "Rohith", "password": "rohith123"}).json()["access_token"]
    resp = client.post(
        "/api/aliases/generate",
        json={"canonical_name": "Sai Sanjeet"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["canonical_name"] == "Sai Sanjeet"
    assert data["count"] >= 15
    assert len(data["aliases"]) >= 15
