"""Explainable scoring: total = sum of triggered rule scores, capped at 100."""
from typing import Iterable

from ..config import Settings
from .base import RuleResult


def calculate_score(results: Iterable[RuleResult]) -> int:
    return min(100, sum(r.score for r in results if r.triggered))


def risk_level(score: int, settings: Settings) -> str:
    if score >= settings.critical_threshold:
        return "CRITICAL"
    if score >= settings.high_threshold:
        return "HIGH"
    if score >= settings.medium_threshold:
        return "MEDIUM"
    return "LOW"
