import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from .api import dashboard, fraud, transactions
from .config import get_settings
from .database import init_db
from .rules import discover_rules

log = logging.getLogger("fraudguard")
settings = get_settings()

@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(
    lifespan=lifespan,
    title="FraudGuard – Fraud Rule Engine & Review Console",
    description="Rule-based transaction risk evaluation. Not a certified fraud-detection model.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    errors = [
        {"field": ".".join(str(p) for p in e["loc"] if p != "body"), "message": e["msg"]}
        for e in exc.errors()
    ]
    summary = "; ".join(f"{e['field']}: {e['message']}" for e in errors)
    return JSONResponse(status_code=422, content={"detail": f"Invalid input – {summary}", "errors": errors})


@app.exception_handler(SQLAlchemyError)
async def db_handler(_: Request, exc: SQLAlchemyError):
    log.exception("Database error")
    return JSONResponse(status_code=500, content={"detail": "A database error occurred. Please try again."})


@app.get("/health", tags=["system"])
def health():
    rules = discover_rules(settings)
    return {
        "status": "ok",
        "rules_loaded": [{"name": r.name, "title": r.title, "description": r.description} for r in rules],
        "notification_backend": type(__import__("app.services.evaluation", fromlist=["x"]).get_notification_service()).__name__,
    }


app.include_router(transactions.router)
app.include_router(fraud.router)
app.include_router(dashboard.router)
