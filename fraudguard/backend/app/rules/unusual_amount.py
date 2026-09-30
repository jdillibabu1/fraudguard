from .base import Rule, RuleContext, RuleResult
from .registry import register_rule

SYMBOLS = {"INR": "₹", "USD": "$", "EUR": "€", "GBP": "£"}


def money(amount: float, currency: str) -> str:
    return f"{SYMBOLS.get(currency, currency + ' ')}{amount:,.0f}"


@register_rule
class UnusualAmountRule(Rule):
    """Hybrid: (1) absolute high-value threshold, or (2) many times the user's own average."""

    name = "unusual_amount"
    title = "Unusual Amount"
    description = "Amount is very high in absolute terms or far above the user's normal spend."

    def evaluate(self, ctx: RuleContext) -> RuleResult:
        s, tx = ctx.settings, ctx.transaction
        amt = money(tx.amount, tx.currency)

        if tx.amount >= s.high_amount_threshold:
            return self.hit(
                f"Transaction amount {amt} exceeds configured high-value threshold "
                f"of {money(s.high_amount_threshold, tx.currency)}",
                s.unusual_amount_score,
                "HIGH",
            )

        past = [h.amount for h in ctx.history]
        if len(past) >= s.amount_history_min_txns:
            avg = sum(past) / len(past)
            if tx.amount >= s.amount_history_floor and tx.amount > avg * s.amount_history_multiplier:
                return self.hit(
                    f"Transaction amount {amt} is {tx.amount / avg:.1f}x this user's average "
                    f"of {money(avg, tx.currency)} (limit {s.amount_history_multiplier:g}x)",
                    s.unusual_amount_score,
                    "MEDIUM",
                )
        return self.miss(f"Amount {amt} is within normal range")
