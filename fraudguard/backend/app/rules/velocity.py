from datetime import timedelta

from .base import Rule, RuleContext, RuleResult
from .registry import register_rule


@register_rule
class VelocityRule(Rule):
    name = "velocity"
    title = "Transaction Velocity"
    description = "Too many transactions by one user inside a short time window."

    def evaluate(self, ctx: RuleContext) -> RuleResult:
        s, tx = ctx.settings, ctx.transaction
        window = timedelta(minutes=s.velocity_window_minutes)
        start = tx.timestamp - window
        # history excludes the current transaction, so +1 counts it
        count = 1 + sum(1 for h in ctx.history if start <= h.timestamp <= tx.timestamp)
        if count > s.velocity_transaction_limit:
            return self.hit(
                f"{count} transactions within {s.velocity_window_minutes} minutes "
                f"(limit is {s.velocity_transaction_limit})",
                s.velocity_score,
                "MEDIUM",
            )
        return self.miss(f"{count} transaction(s) in the last {s.velocity_window_minutes} minutes; within limit")
