"""Rule interface. To add a rule: subclass Rule, decorate with @register_rule. Nothing else."""
from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass, field
from typing import Any, Sequence

from ..config import Settings


@dataclass(frozen=True)
class RuleResult:
    rule_name: str
    triggered: bool
    severity: str        # NONE | LOW | MEDIUM | HIGH
    score: int           # contribution to the total risk score (0 if not triggered)
    explanation: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class RuleContext:
    """Everything a rule may look at. `transaction` and `history` only need the
    attributes: user_id, amount, currency, timestamp, latitude, longitude."""

    transaction: Any
    history: Sequence[Any] = field(default_factory=list)  # same user's earlier transactions
    settings: Settings = None  # type: ignore[assignment]


class Rule(ABC):
    #: unique machine name, e.g. "velocity"
    name: str = ""
    #: short human title shown in the UI
    title: str = ""
    description: str = ""

    def __init__(self, settings: Settings):
        self.settings = settings

    @abstractmethod
    def evaluate(self, ctx: RuleContext) -> RuleResult:
        ...

    # helpers so rules stay tiny
    def hit(self, explanation: str, score: int, severity: str = "MEDIUM") -> RuleResult:
        return RuleResult(self.name, True, severity, score, explanation)

    def miss(self, explanation: str = "No violation") -> RuleResult:
        return RuleResult(self.name, False, "NONE", 0, explanation)
