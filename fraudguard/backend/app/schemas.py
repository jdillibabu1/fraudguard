from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ReviewStatus(str, Enum):
    PENDING = "PENDING"
    REVIEWED = "REVIEWED"
    CLEARED = "CLEARED"


class TransactionCreate(BaseModel):
    transaction_id: Optional[str] = Field(None, min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_\-]+$")
    user_id: str = Field(..., min_length=1, max_length=64)
    amount: float = Field(..., gt=0, lt=1e12, description="Must be greater than 0")
    currency: str = Field("INR", min_length=3, max_length=3)
    timestamp: Optional[datetime] = None
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    location_name: Optional[str] = Field(None, max_length=120)
    merchant: Optional[str] = Field(None, max_length=120)

    @field_validator("currency")
    @classmethod
    def _upper(cls, v: str) -> str:
        return v.upper()

    @field_validator("user_id")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("user_id cannot be blank")
        return v

    @field_validator("timestamp")
    @classmethod
    def _to_naive_utc(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is not None and v.tzinfo is not None:
            v = v.astimezone(timezone.utc).replace(tzinfo=None)
        return v


class ReviewRequest(BaseModel):
    status: ReviewStatus
    reviewed_by: str = Field("reviewer", min_length=1, max_length=120)
    comment: Optional[str] = Field(None, max_length=1000)


class RuleResultOut(BaseModel):
    rule_name: str
    triggered: bool
    severity: str
    score: int
    explanation: str


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    transaction_id: str
    user_id: str
    amount: float
    currency: str
    timestamp: datetime
    latitude: float
    longitude: float
    location_name: Optional[str]
    merchant: Optional[str]
    created_at: datetime


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    reviewed_by: str
    comment: Optional[str]
    reviewed_at: datetime


class FraudFlagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    transaction_pk: int
    risk_score: int
    risk_level: str
    is_flagged: bool
    triggered_rules: list[str]
    explanations: list[str]
    rule_results: list[RuleResultOut]
    evaluated_at: datetime
    review_status: str
    reviewed_by: Optional[str]
    reviewed_at: Optional[datetime]
    review_comment: Optional[str]
    notification_sent: bool
    notification_channel: Optional[str]
    notification_detail: Optional[str]
    notified_at: Optional[datetime]
    transaction: TransactionOut
    reviews: list[ReviewOut] = []


class TransactionDetail(TransactionOut):
    flag: Optional[FraudFlagOut] = None


class FlagPage(BaseModel):
    total: int
    items: list[FraudFlagOut]


class TransactionPage(BaseModel):
    total: int
    items: list[TransactionDetail]


class DashboardStats(BaseModel):
    total_transactions: int
    flagged_transactions: int
    high_risk: int
    critical_risk: int
    pending_reviews: int
    notifications_sent: int
    risk_distribution: list[dict[str, Any]]
    transactions_over_time: list[dict[str, Any]]
    triggered_rules: list[dict[str, Any]]
    review_breakdown: list[dict[str, Any]]
