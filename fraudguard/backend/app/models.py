from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    """Naive UTC datetime (SQLite does not store tz info)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transaction_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.user_id"), index=True)
    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    timestamp: Mapped[datetime] = mapped_column(DateTime, index=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    location_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    merchant: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    user: Mapped[User] = relationship(lazy="joined")
    flag: Mapped["FraudFlag | None"] = relationship(
        back_populates="transaction", uselist=False, cascade="all, delete-orphan"
    )


class FraudFlag(Base):
    """Result of evaluating one transaction + the reviewer's decision about it."""

    __tablename__ = "fraud_flags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transaction_pk: Mapped[int] = mapped_column(ForeignKey("transactions.id"), unique=True, index=True)

    # evaluation
    risk_score: Mapped[int] = mapped_column(Integer, default=0)
    risk_level: Mapped[str] = mapped_column(String(16), default="LOW", index=True)
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    triggered_rules: Mapped[list] = mapped_column(JSON, default=list)   # ["velocity", ...]
    explanations: Mapped[list] = mapped_column(JSON, default=list)      # human text, triggered only
    rule_results: Mapped[list] = mapped_column(JSON, default=list)      # every rule's full result
    evaluated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    # review
    review_status: Mapped[str] = mapped_column(String(16), default="PENDING", index=True)
    reviewed_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    review_comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    # notification
    notification_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    notification_channel: Mapped[str | None] = mapped_column(String(32), nullable=True)
    notification_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    notified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    transaction: Mapped[Transaction] = relationship(back_populates="flag", lazy="joined")
    reviews: Mapped[list["Review"]] = relationship(
        back_populates="flag", cascade="all, delete-orphan", order_by="Review.id"
    )


class Review(Base):
    """Audit trail: one row per reviewer action."""

    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    fraud_flag_id: Mapped[int] = mapped_column(ForeignKey("fraud_flags.id"), index=True)
    status: Mapped[str] = mapped_column(String(16))
    reviewed_by: Mapped[str] = mapped_column(String(120))
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    flag: Mapped[FraudFlag] = relationship(back_populates="reviews")
