import pytest
import asyncio
from unittest.mock import patch, AsyncMock
from bot import AegisMeetBot, SIMULATION_SCRIPT

@pytest.mark.asyncio
async def test_bot_simulation_mode():
    bot = AegisMeetBot(proxy_url="http://localhost:8000")
    
    # Mock httpx post calls
    with patch("httpx.AsyncClient.post") as mock_post:
        # Configure mock return
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = lambda: None
        mock_response.json = lambda: {
            "status": "success",
            "rehydrated_result": {"pm_view": "ok", "tasks": []}
        }
        mock_post.return_value = mock_response
        
        result = await bot.run_simulation(delay=0.01)
        
        assert len(bot.collected_chunks) == len(SIMULATION_SCRIPT)
        assert result is not None
        assert result["status"] == "success"
        print("Bot simulation test passed!")


def test_bot_endpoints_and_lifecycle():
    from fastapi.testclient import TestClient
    from proxy import app, _LIVE_INTAKE_FEED
    client = TestClient(app)

    # 1. Status when idle
    res = client.get("/api/bot/status")
    assert res.status_code == 200
    data = res.json()
    assert data["active"] is False

    # 2. Intake post & feed
    res = client.post("/api/intake", json={"speaker": "Rohith", "caption": "Testing live caption intake feed."})
    assert res.status_code == 200
    
    res = client.get("/api/intake/feed")
    assert res.status_code == 200
    feed = res.json()
    assert len(feed) > 0
    assert feed[-1]["speaker"] == "Rohith"
    assert "Testing live caption intake feed" in feed[-1]["caption"]

    # 3. Stop when idle
    res = client.post("/api/bot/stop")
    assert res.status_code == 200
    assert res.json()["status"] == "not_running"

    # 4. Stop when bot is simulated active
    class FakeBot:
        _is_running = True
        meeting_url = "https://meet.google.com/xyz"
        bot_name = "AegisMeet Notetaker"
        is_admitted = True
        admitted_time = None
        collected_chunks = ["chunk1"]
        def stop(self):
            self._is_running = False

    import proxy
    fake_bot = FakeBot()
    proxy._ACTIVE_BOT_INSTANCE = fake_bot

    res = client.get("/api/bot/status")
    assert res.status_code == 200
    assert res.json()["active"] is True
    assert res.json()["captions_captured"] == 1

    res = client.post("/api/bot/stop")
    assert res.status_code == 200
    assert res.json()["status"] == "stopping"
    assert fake_bot._is_running is False

    proxy._ACTIVE_BOT_INSTANCE = None


if __name__ == "__main__":
    asyncio.run(test_bot_simulation_mode())
    test_bot_endpoints_and_lifecycle()
