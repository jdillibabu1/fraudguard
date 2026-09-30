"""Glue: load history -> run rule engine -> persist FraudFlag -> maybe notify."""
from functools import lru_cache

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..models import FraudFlag, Transaction, utcnow
from ..rules import RuleEngine, discover_rules
from .notifications import NotificationService, get_notifier


@lru_cache
def _default_engine() -> RuleEngine:
    s = get_settings()
    return RuleEngine(discover_rules(s), s)


@lru_cache
def _default_notifier() -> NotificationService:
    return get_notifier(get_settings())


def get_engine() -> RuleEngine:
    return _default_engine()


def get_notification_service() -> NotificationService:
    return _default_notifier()


def evaluate_transaction(
    db: Session,
    txn: Transaction,
    engine: RuleEngine,
    notifier: NotificationService,
    settings: Settings,
) -> FraudFlag:
    history = db.scalars(
        select(Transaction)
        .where(Transaction.user_id == txn.user_id, Transaction.id != txn.id,
               Transaction.timestamp <= txn.timestamp)
        .order_by(Transaction.timestamp)
    ).all()

    ev = engine.evaluate(txn, history)

    flag = txn.flag or FraudFlag(transaction=txn)
    flag.risk_score = ev.risk_score
    flag.risk_level = ev.risk_level
    flag.is_flagged = ev.risk_score >= settings.flag_threshold
    flag.triggered_rules = [r.rule_name for r in ev.triggered]
    flag.explanations = [r.explanation for r in ev.triggered]
    flag.rule_results = [r.to_dict() for r in ev.results]
    flag.evaluated_at = utcnow()
    db.add(flag)

    # notify once when the high-risk threshold is crossed
    if ev.risk_score >= settings.notify_threshold and not flag.notification_sent:
        result = notifier.send_high_risk_alert(txn, flag)
        flag.notification_sent = result.success
        flag.notification_channel = result.channel
        flag.notification_detail = result.detail
        flag.notified_at = utcnow()

    db.commit()
    db.refresh(flag)
    return flag
