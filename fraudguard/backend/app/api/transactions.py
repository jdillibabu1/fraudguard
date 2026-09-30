import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select, func
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..database import get_db
from ..models import Transaction, User, utcnow
from ..rules import RuleEngine
from ..schemas import FraudFlagOut, TransactionCreate, TransactionDetail, TransactionPage
from ..services.evaluation import evaluate_transaction, get_engine, get_notification_service
from ..services.notifications import NotificationService

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.post("", response_model=TransactionDetail, status_code=201)
def create_transaction(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    engine: RuleEngine = Depends(get_engine),
    notifier: NotificationService = Depends(get_notification_service),
    settings: Settings = Depends(get_settings),
):
    """Persist a transaction and evaluate it immediately."""
    txn_id = payload.transaction_id or f"TXN-{uuid.uuid4().hex[:8].upper()}"
    if db.scalar(select(Transaction.id).where(Transaction.transaction_id == txn_id)):
        raise HTTPException(409, f"Transaction '{txn_id}' already exists")

    if not db.scalar(select(User.id).where(User.user_id == payload.user_id)):
        db.add(User(user_id=payload.user_id))
        db.flush()

    txn = Transaction(
        transaction_id=txn_id,
        user_id=payload.user_id,
        amount=payload.amount,
        currency=payload.currency,
        timestamp=payload.timestamp or utcnow(),
        latitude=payload.latitude,
        longitude=payload.longitude,
        location_name=payload.location_name,
        merchant=payload.merchant,
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    evaluate_transaction(db, txn, engine, notifier, settings)
    db.refresh(txn)
    return txn


@router.get("", response_model=TransactionPage)
def list_transactions(
    db: Session = Depends(get_db),
    user_id: str | None = None,
    search: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    q = select(Transaction)
    if user_id:
        q = q.where(Transaction.user_id == user_id)
    if search:
        like = f"%{search}%"
        q = q.where(or_(Transaction.transaction_id.ilike(like), Transaction.user_id.ilike(like)))
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    items = db.scalars(q.order_by(Transaction.timestamp.desc()).limit(limit).offset(offset)).unique().all()
    return {"total": total, "items": items}


def _get_or_404(db: Session, txn_pk: int) -> Transaction:
    txn = db.get(Transaction, txn_pk)
    if not txn:
        raise HTTPException(404, f"Transaction {txn_pk} not found")
    return txn


@router.get("/{txn_pk}", response_model=TransactionDetail)
def get_transaction(txn_pk: int, db: Session = Depends(get_db)):
    return _get_or_404(db, txn_pk)


@router.post("/{txn_pk}/evaluate", response_model=FraudFlagOut)
def evaluate(
    txn_pk: int,
    db: Session = Depends(get_db),
    engine: RuleEngine = Depends(get_engine),
    notifier: NotificationService = Depends(get_notification_service),
    settings: Settings = Depends(get_settings),
):
    """(Re-)run the rule engine against an existing transaction."""
    txn = _get_or_404(db, txn_pk)
    return evaluate_transaction(db, txn, engine, notifier, settings)
