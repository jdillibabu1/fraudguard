from datetime import datetime, timedelta
from types import SimpleNamespace

from app.rules import Rule, RuleEngine, RuleResult, discover_rules, register_rule
from app.rules.impossible_location import ImpossibleLocationRule, haversine_km
from app.rules.scoring import calculate_score, risk_level
from app.rules.unusual_amount import UnusualAmountRule
from app.rules.velocity import VelocityRule

T0 = datetime(2026, 1, 1, 10, 0, 0)
CHENNAI = (13.0827, 80.2707)
NEW_YORK = (40.7128, -74.0060)
BENGALURU = (12.9716, 77.5946)


def tx(minutes=0, amount=1000, loc=CHENNAI, user="u1"):
    return SimpleNamespace(user_id=user, amount=amount, currency="INR",
                           timestamp=T0 + timedelta(minutes=minutes),
                           latitude=loc[0], longitude=loc[1])


def ctx(settings, txn, history=()):
    from app.rules import RuleContext
    return RuleContext(transaction=txn, history=list(history), settings=settings)


# ---- velocity
def test_velocity_triggers(settings):
    history = [tx(m) for m in range(5)]                    # 5 earlier in 5 min
    res = VelocityRule(settings).evaluate(ctx(settings, tx(4.5), history))
    assert res.triggered and res.score == settings.velocity_score
    assert "6 transactions" in res.explanation


def test_velocity_does_not_trigger_for_normal_activity(settings):
    history = [tx(0), tx(60), tx(120)]
    assert not VelocityRule(settings).evaluate(ctx(settings, tx(180), history)).triggered


def test_velocity_limit_is_configurable(settings):
    settings.velocity_transaction_limit = 2
    history = [tx(0), tx(1)]
    assert VelocityRule(settings).evaluate(ctx(settings, tx(2), history)).triggered


# ---- amount
def test_unusual_amount_absolute_threshold(settings):
    res = UnusualAmountRule(settings).evaluate(ctx(settings, tx(amount=500_000)))
    assert res.triggered and "₹500,000" in res.explanation


def test_unusual_amount_relative_to_history(settings):
    history = [tx(i * 60, amount=2000) for i in range(4)]
    res = UnusualAmountRule(settings).evaluate(ctx(settings, tx(300, amount=50_000), history))
    assert res.triggered and "average" in res.explanation


def test_normal_amount_not_flagged(settings):
    assert not UnusualAmountRule(settings).evaluate(ctx(settings, tx(amount=1500))).triggered


# ---- location
def test_haversine_chennai_new_york():
    assert 13_000 < haversine_km(*CHENNAI, *NEW_YORK) < 14_000


def test_impossible_location_triggers(settings):
    res = ImpossibleLocationRule(settings).evaluate(ctx(settings, tx(15, loc=NEW_YORK), [tx(0)]))
    assert res.triggered and res.score == settings.impossible_location_score


def test_reasonable_travel_does_not_trigger(settings):
    # Chennai -> Bengaluru (~290 km) in 6 hours
    res = ImpossibleLocationRule(settings).evaluate(ctx(settings, tx(360, loc=BENGALURU), [tx(0)]))
    assert not res.triggered


def test_first_transaction_has_no_location_violation(settings):
    assert not ImpossibleLocationRule(settings).evaluate(ctx(settings, tx())).triggered


# ---- engine + scoring
def test_engine_combines_multiple_rules(settings):
    engine = RuleEngine(discover_rules(settings), settings)
    history = [tx(m) for m in range(5)]
    ev = engine.evaluate(tx(5, amount=500_000, loc=NEW_YORK), history)
    triggered = {r.rule_name for r in ev.triggered}
    assert triggered == {"velocity", "unusual_amount", "impossible_location"}
    assert ev.risk_score == 100 and ev.risk_level == "CRITICAL"  # 30+35+45 capped


def test_risk_score_and_levels(settings):
    mk = lambda s: RuleResult("x", True, "LOW", s, "")
    assert calculate_score([mk(30), mk(35)]) == 65
    assert calculate_score([mk(80), mk(80)]) == 100
    assert calculate_score([RuleResult("y", False, "NONE", 0, "")]) == 0
    assert [risk_level(s, settings) for s in (0, 29, 30, 59, 60, 79, 80, 100)] == \
        ["LOW", "LOW", "MEDIUM", "MEDIUM", "HIGH", "HIGH", "CRITICAL", "CRITICAL"]


def test_new_rule_added_without_touching_engine(settings):
    """Extensibility proof: define a rule in a test file, register it, engine uses it unchanged."""
    @register_rule
    class NightOwlRule(Rule):
        name = "night_owl_test"
        def evaluate(self, c):
            return self.hit("Night-time transaction", 10, "LOW") if c.transaction.timestamp.hour < 5 else self.miss()

    rules = discover_rules(settings)
    assert "night_owl_test" in [r.name for r in rules]
    ev = RuleEngine(rules, settings).evaluate(SimpleNamespace(
        user_id="u", amount=10, currency="INR", timestamp=datetime(2026, 1, 1, 3, 0),
        latitude=0, longitude=0))
    assert "night_owl_test" in [r.rule_name for r in ev.triggered]
    from app.rules.registry import _REGISTRY
    _REGISTRY.pop("night_owl_test")


def test_broken_rule_does_not_crash_engine(settings):
    class Boom(Rule):
        name = "boom"
        def evaluate(self, c):
            raise RuntimeError("kaput")
    ev = RuleEngine([Boom(settings)], settings).evaluate(tx())
    assert ev.risk_score == 0 and "kaput" in ev.results[0].explanation
