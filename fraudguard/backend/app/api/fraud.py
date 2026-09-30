from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import FraudFlag, Review, Transaction, utcnow
from ..schemas import FlagPage, FraudFlagOut, ReviewRequest

router = APIRouter(prefix="/fraud", tags=["fraud"])

RISK_LEVELS = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
STATUSES = {"PENDING", "REVIEWED", "CLEARED"}


@router.get("/flags", response_model=FlagPage)
def list_flags(
    db: Session = Depends(get_db),
    risk_level: str | None = None,
    status: str | None = None,
    search: str | None = None,
    flagged_only: bool = True,
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """Flagged transactions (default). Pass flagged_only=false to include low-risk evaluations."""
    q = select(FraudFlag).join(Transaction, FraudFlag.transaction_pk == Transaction.id)
    if flagged_only:
        q = q.where(FraudFlag.is_flagged.is_(True))
    if risk_level:
        if risk_level.upper() not in RISK_LEVELS:
            raise HTTPException(422, f"risk_level must be one of {sorted(RISK_LEVELS)}")
        q = q.where(FraudFlag.risk_level == risk_level.upper())
    if status:
        if status.upper() not in STATUSES:
            raise HTTPException(422, f"status must be one of {sorted(STATUSES)}")
        q = q.where(FraudFlag.review_status == status.upper())
    if search:
        like = f"%{search}%"
        q = q.where(or_(Transaction.transaction_id.ilike(like), Transaction.user_id.ilike(like)))

    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    items = db.scalars(
        q.order_by(FraudFlag.risk_score.desc(), Transaction.timestamp.desc()).limit(limit).offset(offset)
    ).unique().all()
    return {"total": total, "items": items}


def _flag_or_404(db: Session, flag_id: int) -> FraudFlag:
    flag = db.get(FraudFlag, flag_id)
    if not flag:
        raise HTTPException(404, f"Fraud flag {flag_id} not found")
    return flag


@router.get("/flags/{flag_id}", response_model=FraudFlagOut)
def get_flag(flag_id: int, db: Session = Depends(get_db)):
    return _flag_or_404(db, flag_id)


@router.patch("/flags/{flag_id}/review", response_model=FraudFlagOut)
def review_flag(flag_id: int, body: ReviewRequest, db: Session = Depends(get_db)):
    flag = _flag_or_404(db, flag_id)
    now = utcnow()
    flag.review_status = body.status.value
    flag.reviewed_by = body.reviewed_by
    flag.reviewed_at = now
    flag.review_comment = body.comment
    db.add(Review(fraud_flag_id=flag.id, status=body.status.value,
                  reviewed_by=body.reviewed_by, comment=body.comment, reviewed_at=now))
    db.commit()
    db.refresh(flag)
    return flag
