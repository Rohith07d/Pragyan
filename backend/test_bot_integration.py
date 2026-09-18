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

if __name__ == "__main__":
    asyncio.run(test_bot_simulation_mode())
