"""The core engine. It knows NOTHING about individual rules: it just runs whatever it is given."""
from dataclasses import dataclass
from typing import Sequence

from ..config import Settings
from .base import Rule, RuleContext, RuleResult
from .scoring import calculate_score, risk_level


@dataclass
class Evaluation:
    risk_score: int
    risk_level: str
    results: list[RuleResult]

    @property
    def triggered(self) -> list[RuleResult]:
        return [r for r in self.results if r.triggered]


class RuleEngine:
    def __init__(self, rules: Sequence[Rule], settings: Settings):
        self.rules = list(rules)
        self.settings = settings

    def evaluate(self, transaction, history=()) -> Evaluation:
        ctx = RuleContext(transaction=transaction, history=list(history), settings=self.settings)
        results: list[RuleResult] = []
        for rule in self.rules:
            try:
                results.append(rule.evaluate(ctx))
            except Exception as exc:  # one broken rule must never break evaluation
                results.append(RuleResult(rule.name, False, "NONE", 0, f"Rule error: {exc}"))
        score = calculate_score(results)
        return Evaluation(score, risk_level(score, self.settings), results)
