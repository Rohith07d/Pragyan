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

def test_audit_logs_and_webhook_feed():
    audit_resp = client.get("/api/audit-logs")
    assert audit_resp.status_code == 200
    audit_data = audit_resp.json()
    assert isinstance(audit_data, list)
    assert len(audit_data) > 0
    assert audit_data[0]["zero_leak_verified"] is True
    assert audit_data[0]["ram_wipe_status"] == "CONFIRMED_CLEARED"

    webhook_resp = client.get("/api/webhooks/feed")
    assert webhook_resp.status_code == 200
    webhook_data = webhook_resp.json()
    assert isinstance(webhook_data, list)
    assert len(webhook_data) > 0

def test_schedule_and_join_endpoints():
    # Test instant join endpoint
    join_resp = client.post("/join", json={"meet_url": "simulate"})
    assert join_resp.status_code == 200
    assert join_resp.json()["status"] == "launched"

    # Test future schedule endpoint
    schedule_resp = client.post("/schedule", json={
        "meet_url": "https://meet.google.com/xyz-abcd-efg",
        "join_time": "2026-09-18T22:00:00"
    })
    assert schedule_resp.status_code == 200
    assert schedule_resp.json()["status"] == "scheduled"
    assert "job_id" in schedule_resp.json()

    # Test intake endpoint
    intake_resp = client.post("/intake", json={
        "speaker": "Rohith",
        "caption": "Testing intake caption stream"
    })
    assert intake_resp.status_code == 200
    assert intake_resp.json()["status"] == "received"

if __name__ == "__main__":
    test_health()
    test_mask_endpoint()
    test_process_pipeline_zero_leak_and_wipe()
    test_tasks_endpoint()
    test_audit_logs_and_webhook_feed()
    test_schedule_and_join_endpoints()
    print("All pipeline, scheduling, and telemetry tests passed!")

