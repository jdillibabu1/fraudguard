import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import Settings
from app.database import Base, get_db
from app.main import app
from app.services.evaluation import get_notification_service
from app.services.notifications import NotificationResult, NotificationService


class RecordingNotifier(NotificationService):
    def __init__(self):
        self.sent = []

    def send_high_risk_alert(self, txn, flag):
        self.sent.append(txn.transaction_id)
        return NotificationResult("console", True, "recorded by test")


@pytest.fixture
def settings():
    return Settings(_env_file=None)


@pytest.fixture
def notifier():
    return RecordingNotifier()


@pytest.fixture
def client(notifier):
    from app import models  # noqa: F401

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False)

    def _db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_notification_service] = lambda: notifier
    yield TestClient(app)
    app.dependency_overrides.clear()
