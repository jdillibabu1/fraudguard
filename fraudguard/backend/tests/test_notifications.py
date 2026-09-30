from datetime import datetime
from types import SimpleNamespace

import boto3

from app.config import Settings
from app.services.notifications import AWSNotificationService


def _transaction_and_flag():
    txn = SimpleNamespace(
        transaction_id="TXN-TEST-1",
        user_id="USR-TEST-1",
        amount=500_000,
        currency="INR",
        location_name="Chennai",
        latitude=13.0827,
        longitude=80.2707,
        timestamp=datetime(2026, 1, 1, 10, 0),
    )
    flag = SimpleNamespace(
        risk_level="CRITICAL",
        risk_score=100,
        explanations=["Velocity triggered", "Unusual amount triggered"],
    )
    return txn, flag


def test_sns_notification_uses_configured_topic_and_region(monkeypatch):
    calls = []

    class FakeSNS:
        def publish(self, **kwargs):
            calls.append(kwargs)

    def fake_client(service, **kwargs):
        assert service == "sns"
        assert kwargs["region_name"] == "ap-south-1"
        return FakeSNS()

    monkeypatch.setattr(boto3, "client", fake_client)
    settings = Settings(_env_file=None, notification_backend="aws", aws_region="ap-south-1",
                        aws_access_key_id="", aws_secret_access_key="",
                        sns_topic_arn="arn:aws:sns:ap-south-1:000000000000:fraudguard-test",
                        ses_from_email="", ses_to_email="")
    service = AWSNotificationService(settings)
    txn, flag = _transaction_and_flag()

    result = service.send_high_risk_alert(txn, flag)

    assert result.success and result.channel == "sns"
    assert calls[0]["TopicArn"] == settings.sns_topic_arn
    assert "TXN-TEST-1" in calls[0]["Message"]
    assert "CRITICAL (score 100/100)" in calls[0]["Message"]
    assert "Velocity triggered" in calls[0]["Message"]


def test_ses_notification_uses_configured_addresses_and_region(monkeypatch):
    calls = []

    class FakeSES:
        def send_email(self, **kwargs):
            calls.append(kwargs)

    def fake_client(service, **kwargs):
        assert service == "ses"
        assert kwargs["region_name"] == "eu-west-1"
        return FakeSES()

    monkeypatch.setattr(boto3, "client", fake_client)
    settings = Settings(_env_file=None, notification_backend="aws", aws_region="eu-west-1",
                        aws_access_key_id="", aws_secret_access_key="", sns_topic_arn="",
                        ses_from_email="sender@example.invalid", ses_to_email="recipient@example.invalid")
    service = AWSNotificationService(settings)
    txn, flag = _transaction_and_flag()

    result = service.send_high_risk_alert(txn, flag)

    assert result.success and result.channel == "ses"
    assert calls[0]["Source"] == settings.ses_from_email
    assert calls[0]["Destination"]["ToAddresses"] == [settings.ses_to_email]
    assert "TXN-TEST-1" in calls[0]["Message"]["Body"]["Text"]["Data"]


def test_aws_send_failure_uses_truthful_console_fallback(monkeypatch):
    class FailedSNS:
        def publish(self, **_kwargs):
            raise RuntimeError("test publish failure")

    monkeypatch.setattr(boto3, "client", lambda _service, **_kwargs: FailedSNS())
    settings = Settings(_env_file=None, notification_backend="aws", aws_access_key_id="",
                        aws_secret_access_key="", sns_topic_arn="arn:aws:sns:test",
                        ses_from_email="", ses_to_email="")
    service = AWSNotificationService(settings)
    txn, flag = _transaction_and_flag()

    result = service.send_high_risk_alert(txn, flag)

    assert result.success
    assert result.channel == "console"
    assert "AWS failed" in result.detail
    assert "test publish failure" in result.detail