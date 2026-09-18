import pytest
from fastapi.testclient import TestClient
from proxy import app, wipe_ephemeral_ram, get_ephemeral_ram

client = TestClient(app)

def setup_function():
    wipe_ephemeral_ram()

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "AegisMeet Privacy Proxy"

def test_mask_endpoint():
    payload = {"transcript": "Rohith and Mayank met with Acme Corp."}
    response = client.post("/api/mask", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "masked_text" in data
    assert data["entities_count"] >= 2
    assert len(data["token_map"]) >= 2

def test_process_pipeline_zero_leak_and_wipe():
    payload = {
        "transcript": "Mayank Sachdeva noted the API risk with Acme Corp. Sambhav agreed to build the UI by tomorrow."
    }
    response = client.post("/api/process", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    # Verify intercepted payload contains sanitized text
    sent_text = data["intercepted_cloud_payload"]["sent_sanitized_text"]
    assert "Mayank" not in sent_text
    
    # Verify rehydration worked locally
    rehydrated = data["rehydrated_result"]
    assert "pm_view" in rehydrated
    assert "tasks" in rehydrated
    
    # Verify RAM was wiped
    assert data["ram_wiped"] is True
    ram_status = client.get("/api/ram-status").json()
    assert ram_status["active_tokens_count"] == 0

def test_tasks_endpoint():
    response = client.get("/api/tasks")
    assert response.status_code == 200
    tasks = response.json()
    assert isinstance(tasks, list)

if __name__ == "__main__":
    test_health()
    test_mask_endpoint()
    test_process_pipeline_zero_leak_and_wipe()
    test_tasks_endpoint()
    print("All pipeline tests passed!")
