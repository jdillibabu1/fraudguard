from datetime import datetime, timedelta

BASE = datetime(2026, 1, 1, 10, 0, 0)


def payload(minutes=0, **kw):
    d = {"user_id": "USR-1", "amount": 1500, "latitude": 13.0827, "longitude": 80.2707,
         "location_name": "Chennai", "timestamp": (BASE + timedelta(minutes=minutes)).isoformat()}
    d.update(kw)
    return d


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert {x["name"] for x in r.json()["rules_loaded"]} >= {"velocity", "unusual_amount", "impossible_location"}


def test_create_transaction_persists_and_evaluates(client):
    r = client.post("/transactions", json=payload(amount=600_000))
    assert r.status_code == 201
    body = r.json()
    assert body["transaction_id"].startswith("TXN-")
    assert body["flag"]["is_flagged"] and body["flag"]["risk_level"] == "MEDIUM"
    assert client.get(f"/transactions/{body['id']}").status_code == 200
    assert client.get("/transactions").json()["total"] == 1


def test_fraud_flag_retrieval(client):
    client.post("/transactions", json=payload(0))                                  # normal
    client.post("/transactions", json=payload(10, amount=600_000))                 # flagged
    flags = client.get("/fraud/flags").json()
    assert flags["total"] == 1
    fid = flags["items"][0]["id"]
    detail = client.get(f"/fraud/flags/{fid}").json()
    assert "unusual_amount" in detail["triggered_rules"]
    assert len(detail["rule_results"]) >= 3
    assert client.get("/fraud/flags?flagged_only=false").json()["total"] == 2


def test_impossible_travel_via_api_sends_notification(client, notifier):
    client.post("/transactions", json=payload(0))
    r = client.post("/transactions", json=payload(15, latitude=40.7128, longitude=-74.006,
                                                   amount=650_000, location_name="New York"))
    flag = r.json()["flag"]
    assert flag["risk_level"] == "CRITICAL" and flag["notification_sent"]
    assert len(notifier.sent) == 1


def test_low_risk_transaction_does_not_send_notification(client, notifier):
    response = client.post("/transactions", json=payload())
    flag = response.json()["flag"]
    assert response.status_code == 201
    assert flag["risk_score"] < 60
    assert flag["notification_sent"] is False
    assert notifier.sent == []


def test_review_status_update(client):
    tx = client.post("/transactions", json=payload(amount=600_000)).json()
    fid = tx["flag"]["id"]
    r = client.patch(f"/fraud/flags/{fid}/review",
                     json={"status": "CLEARED", "reviewed_by": "asha", "comment": "Customer confirmed"})
    assert r.status_code == 200
    body = r.json()
    assert body["review_status"] == "CLEARED" and body["reviewed_by"] == "asha"
    assert body["review_comment"] == "Customer confirmed" and len(body["reviews"]) == 1
    assert client.get(f"/fraud/flags/{fid}").json()["review_status"] == "CLEARED"
    assert client.get("/dashboard/stats").json()["pending_reviews"] == 0


def test_mark_transaction_as_reviewed(client):
    tx = client.post("/transactions", json=payload(amount=600_000)).json()
    fid = tx["flag"]["id"]
    response = client.patch(
        f"/fraud/flags/{fid}/review",
        json={"status": "REVIEWED", "reviewed_by": "reviewer.test", "comment": "Verified"},
    )
    assert response.status_code == 200
    assert response.json()["review_status"] == "REVIEWED"
    assert response.json()["review_comment"] == "Verified"
    assert client.get(f"/fraud/flags/{fid}").json()["review_status"] == "REVIEWED"


def test_filters(client):
    client.post("/transactions", json=payload(amount=600_000, user_id="ALICE"))
    assert client.get("/fraud/flags?search=alice").json()["total"] == 1
    assert client.get("/fraud/flags?risk_level=CRITICAL").json()["total"] == 0
    assert client.get("/fraud/flags?risk_level=BOGUS").status_code == 422


def test_validation_errors(client):
    for bad in ({"amount": -5}, {"amount": 0}, {"latitude": 123}, {"longitude": -500},
                {"timestamp": "not-a-date"}, {"currency": "RUPEES"}):
        r = client.post("/transactions", json=payload(**bad))
        assert r.status_code == 422, bad
        assert "detail" in r.json()
    r = client.post("/transactions", json={"user_id": "x"})   # missing fields
    assert r.status_code == 422


def test_not_found_and_duplicates(client):
    assert client.get("/transactions/999").status_code == 404
    assert client.get("/fraud/flags/999").status_code == 404
    assert client.patch("/fraud/flags/999/review", json={"status": "CLEARED"}).status_code == 404
    client.post("/transactions", json=payload(transaction_id="DUP-1"))
    assert client.post("/transactions", json=payload(transaction_id="DUP-1")).status_code == 409


def test_re_evaluate_endpoint_and_stats(client):
    tx = client.post("/transactions", json=payload(amount=600_000)).json()
    r = client.post(f"/transactions/{tx['id']}/evaluate")
    assert r.status_code == 200 and r.json()["risk_score"] == 35
    s = client.get("/dashboard/stats").json()
    assert s["total_transactions"] == 1 and s["flagged_transactions"] == 1
