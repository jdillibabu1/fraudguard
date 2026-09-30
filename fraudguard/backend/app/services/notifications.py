"""Notification abstraction. Console (local/mock) and AWS (SNS and/or SES) implementations."""
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass

from ..config import Settings

logger = logging.getLogger("fraudguard.notifications")
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    logger.addHandler(_h)
    logger.setLevel(logging.INFO)


@dataclass
class NotificationResult:
    channel: str      # console | sns | ses | sns+ses
    success: bool
    detail: str


def build_message(txn, flag) -> tuple[str, str]:
    subject = f"[FraudGuard] {flag.risk_level} risk transaction {txn.transaction_id}"
    lines = [
        f"Risk level : {flag.risk_level} (score {flag.risk_score}/100)",
        f"Transaction: {txn.transaction_id}",
        f"User       : {txn.user_id}",
        f"Amount     : {txn.currency} {txn.amount:,.2f}",
        f"Location   : {txn.location_name or f'{txn.latitude}, {txn.longitude}'}",
        f"Time (UTC) : {txn.timestamp:%Y-%m-%d %H:%M:%S}",
        "Triggered rules:",
        *[f"  - {e}" for e in flag.explanations],
    ]
    return subject, "\n".join(lines)


class NotificationService(ABC):
    @abstractmethod
    def send_high_risk_alert(self, txn, flag) -> NotificationResult:
        ...


class ConsoleNotificationService(NotificationService):
    """Safe local fallback: logs the alert clearly. Used when AWS is not configured."""

    def send_high_risk_alert(self, txn, flag) -> NotificationResult:
        subject, body = build_message(txn, flag)
        logger.warning("HIGH-RISK NOTIFICATION TRIGGERED (console mode)\n%s\n%s", subject, body)
        return NotificationResult("console", True, "Logged to console (AWS not configured)")


class AWSNotificationService(NotificationService):
    """Publishes to SNS and/or sends an SES email, depending on which env vars are set."""

    def __init__(self, settings: Settings):
        import boto3

        self.settings = settings
        kwargs = {"region_name": settings.aws_region}
        if settings.aws_access_key_id and settings.aws_secret_access_key:
            kwargs.update(
                aws_access_key_id=settings.aws_access_key_id,
                aws_secret_access_key=settings.aws_secret_access_key,
            )
        self.sns = boto3.client("sns", **kwargs) if settings.sns_topic_arn else None
        self.ses = boto3.client("ses", **kwargs) if settings.ses_from_email and settings.ses_to_email else None

    def send_high_risk_alert(self, txn, flag) -> NotificationResult:
        subject, body = build_message(txn, flag)
        channels, errors = [], []
        if self.sns:
            try:
                self.sns.publish(TopicArn=self.settings.sns_topic_arn, Subject=subject[:100], Message=body)
                channels.append("sns")
            except Exception as exc:
                errors.append(f"SNS failed: {exc}")
        if self.ses:
            try:
                self.ses.send_email(
                    Source=self.settings.ses_from_email,
                    Destination={"ToAddresses": [self.settings.ses_to_email]},
                    Message={"Subject": {"Data": subject}, "Body": {"Text": {"Data": body}}},
                )
                channels.append("ses")
            except Exception as exc:
                errors.append(f"SES failed: {exc}")

        if channels:
            logger.warning("HIGH-RISK NOTIFICATION SENT via %s for %s", "+".join(channels), txn.transaction_id)
            return NotificationResult("+".join(channels), True, "; ".join(errors) or "Delivered")

        # AWS failed: never crash the app, fall back to console so the alert is not lost
        logger.error("AWS notification failed (%s); falling back to console", "; ".join(errors))
        fallback = ConsoleNotificationService().send_high_risk_alert(txn, flag)
        return NotificationResult("console", True, f"AWS failed, logged locally: {'; '.join(errors)}"[:500])


def get_notifier(settings: Settings) -> NotificationService:
    aws_ready = bool(settings.sns_topic_arn or (settings.ses_from_email and settings.ses_to_email))
    has_creds = bool(settings.aws_access_key_id and settings.aws_secret_access_key)
    mode = settings.notification_backend.lower()
    if mode == "aws" or (mode == "auto" and aws_ready and has_creds):
        try:
            return AWSNotificationService(settings)
        except Exception as exc:  # e.g. boto3 missing
            logger.error("Could not start AWS notifications: %s", exc)
    return ConsoleNotificationService()
