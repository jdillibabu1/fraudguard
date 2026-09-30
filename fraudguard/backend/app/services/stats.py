from collections import Counter

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import FraudFlag, Transaction

LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]


def compute_stats(db: Session) -> dict:
    total = db.scalar(select(func.count(Transaction.id))) or 0
    flags = db.scalars(select(FraudFlag)).all()

    level_counts = Counter(f.risk_level for f in flags)
    flagged = [f for f in flags if f.is_flagged]
    rule_counts = Counter(r for f in flagged for r in f.triggered_rules)
    status_counts = Counter(f.review_status for f in flagged)

    by_day: dict[str, dict] = {}
    for ts, flg in db.execute(
        select(Transaction.timestamp, FraudFlag.is_flagged).join(FraudFlag, FraudFlag.transaction_pk == Transaction.id)
    ):
        d = by_day.setdefault(ts.strftime("%Y-%m-%d"), {"date": ts.strftime("%Y-%m-%d"), "transactions": 0, "flagged": 0})
        d["transactions"] += 1
        d["flagged"] += 1 if flg else 0

    return {
        "total_transactions": total,
        "flagged_transactions": len(flagged),
        "high_risk": level_counts["HIGH"],
        "critical_risk": level_counts["CRITICAL"],
        "pending_reviews": status_counts["PENDING"],
        "notifications_sent": sum(1 for f in flags if f.notification_sent),
        "risk_distribution": [{"level": l, "count": level_counts[l]} for l in LEVELS],
        "transactions_over_time": [by_day[k] for k in sorted(by_day)],
        "triggered_rules": [{"rule": k, "count": v} for k, v in rule_counts.most_common()],
        "review_breakdown": [{"status": s, "count": status_counts[s]} for s in ("PENDING", "REVIEWED", "CLEARED")],
    }
