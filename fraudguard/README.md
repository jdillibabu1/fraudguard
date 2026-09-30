# FraudGuard – Fraud Rule Engine & Review Console

A rule-based transaction risk evaluation system with a React reviewer console.
Built for the **Python problem statement: Fraud Rule Engine with Review Console**.

> **Note:** FraudGuard is a transparent, rule-based risk evaluation system built for a hackathon.
> It is **not** a certified or production fraud-detection model.

---

## 1. Problem statement
Financial systems must spot potentially fraudulent transactions from different risk indicators. A flexible rule engine should evaluate each transaction and let human reviewers investigate what it flags.

## 2. Solution
Every transaction is run through a pluggable **rule engine**. Each rule independently reports whether it fired and why. Scores are summed (capped at 100) into an explainable risk level. Flagged transactions appear in a **React reviewer console** where an analyst reads the reasons, adds a comment and marks the transaction **Reviewed** or **Cleared**. Crossing the high-risk threshold sends an **AWS SNS/SES** notification (or a clearly logged local one when AWS isn't configured).

## 3. Features
- 3 independent rules: **velocity**, **unusual amount**, **impossible location** (Haversine, fully offline)
- Rules are **auto-discovered**: add a file, register the class, done. No engine changes
- Explainable score (per-rule contribution, capped at 100) and 4 risk levels, all configurable
- Persistence with SQLAlchemy (SQLite now, PostgreSQL by changing one env var)
- Reviewer console: stat strip, 4 charts, searchable/filterable table, "Why was this flagged?" panel, review workflow with audit history
- Transaction **Simulator** page with one-click attack scenarios (for live demos)
- AWS SES/SNS notifications with automatic console fallback
- Input validation, friendly errors, 28 automated tests

## 4. Architecture
```
React Frontend (Vite)
      | REST / JSON
      v
FastAPI Backend
      +-- Rule Engine (rules/)          <- pluggable rules, scoring
      +-- Database (SQLAlchemy)         <- users, transactions, fraud_flags, reviews
      +-- Notification Service          <- AWS SNS/SES  |  Console fallback
      +-- Seed / Demo Data (seed.py)
```
Request flow for `POST /transactions`: validate -> save -> load user's history -> `RuleEngine.evaluate()` -> save `FraudFlag` -> notify if score >= threshold -> return result.

## 5. Tech stack
Python 3.10+, FastAPI, SQLAlchemy 2, Pydantic 2, pytest · React 18, Vite, Recharts · SQLite (PostgreSQL-ready) · boto3 (AWS SNS/SES)

## 6. Folder structure
```
fraudguard/
├── backend/
│   ├── app/
│   │   ├── main.py            FastAPI app, CORS, error handlers
│   │   ├── config.py          all settings (env-driven)
│   │   ├── database.py        engine/session
│   │   ├── models.py          User, Transaction, FraudFlag, Review
│   │   ├── schemas.py         Pydantic request/response models + validation
│   │   ├── api/               transactions.py, fraud.py, dashboard.py
│   │   ├── rules/             base.py, registry.py, engine.py, scoring.py
│   │   │                      velocity.py, unusual_amount.py, impossible_location.py
│   │   └── services/          evaluation.py, notifications.py, stats.py
│   ├── tests/                 test_rules.py, test_api.py
│   ├── seed.py                deterministic demo data
│   ├── requirements.txt
│   └── .env.example
├── frontend/src/
│   ├── components/            StatStrip, Charts, FlagsTable, DetailModal, Badges
│   ├── pages/                 ConsolePage, SimulatorPage
│   ├── hooks/  services/  utils/
│   └── App.jsx
└── README.md
```

## 7. Database design
| Table | Purpose | Key columns |
|---|---|---|
| `users` | account owner | `user_id` (unique), `name` |
| `transactions` | what happened | `transaction_id`, `user_id`, `amount`, `currency`, `timestamp`, `latitude`, `longitude`, `location_name`, `merchant`, `created_at` |
| `fraud_flags` | evaluation + review state (1:1 with a transaction) | `risk_score`, `risk_level`, `is_flagged`, `triggered_rules`, `explanations`, `rule_results`, `evaluated_at`, `review_status` (PENDING/REVIEWED/CLEARED), `reviewed_by`, `reviewed_at`, `review_comment`, `notification_*` |
| `reviews` | audit trail, one row per reviewer action | `fraud_flag_id`, `status`, `reviewed_by`, `comment`, `reviewed_at` |

Every transaction gets an evaluation; `is_flagged` is true when score >= `FLAG_THRESHOLD`.

## 8. Fraud rules
| Rule | Triggers when | Config (env) | Score |
|---|---|---|---|
| **Velocity** | more than `VELOCITY_TRANSACTION_LIMIT` (5) transactions by a user in `VELOCITY_WINDOW_MINUTES` (5) | `VELOCITY_*` | +30 |
| **Unusual amount** | amount >= `HIGH_AMOUNT_THRESHOLD` (₹200,000) **or** > 5x the user's own average (needs 3+ past transactions and amount >= ₹10,000) | `HIGH_AMOUNT_THRESHOLD`, `UNUSUAL_AMOUNT_SCORE` | +35 |
| **Impossible location** | Haversine distance to previous transaction (>= 50 km) divided by elapsed time exceeds `MAX_TRAVEL_SPEED_KMH` (900) | `MAX_TRAVEL_SPEED_KMH`, `IMPOSSIBLE_LOCATION_SCORE` | +45 |

### Adding a new rule (no engine changes)
Create `backend/app/rules/night_owl.py`:
```python
from .base import Rule, RuleContext, RuleResult
from .registry import register_rule

@register_rule
class NightOwlRule(Rule):
    name = "night_owl"
    title = "Night-time Transaction"
    def evaluate(self, ctx: RuleContext) -> RuleResult:
        if ctx.transaction.timestamp.hour < 5:
            return self.hit("Transaction made between midnight and 5 AM", score=10, severity="LOW")
        return self.miss()
```
Restart the API. The rule is discovered automatically, scored, stored, and shown in the UI with its title (the console reads rule titles from `/health`). `RuleEngine` never mentions individual rules. The test `test_new_rule_added_without_touching_engine` proves it.

## 9. Risk scoring
`score = min(100, sum of triggered rule scores)`

| Score | Level |
|---|---|
| 0-29 | LOW |
| 30-59 | MEDIUM |
| 60-79 | HIGH |
| 80-100 | CRITICAL |

Flagged = score >= 30. Notification = score >= 60. All thresholds are env-configurable. Example: velocity + amount = 65 (HIGH); amount + impossible location = 80 (CRITICAL).

## 10. API endpoints
Interactive docs: http://localhost:8000/docs

| Method | Path | Description |
|---|---|---|
| GET | `/health` | status + loaded rules + notification backend |
| POST | `/transactions` | create **and evaluate** a transaction (201) |
| GET | `/transactions` | list (`search`, `user_id`, `limit`, `offset`) |
| GET | `/transactions/{id}` | one transaction with its evaluation |
| POST | `/transactions/{id}/evaluate` | re-run the rule engine |
| GET | `/fraud/flags` | flagged transactions (`risk_level`, `status`, `search`, `flagged_only=false` for all) |
| GET | `/fraud/flags/{id}` | full detail incl. per-rule results and review history |
| PATCH | `/fraud/flags/{id}/review` | body `{status: REVIEWED\|CLEARED\|PENDING, reviewed_by, comment}` |
| GET | `/dashboard/stats` | numbers + chart data |

Errors return `{"detail": "..."}` with 404 (not found), 409 (duplicate ID), 422 (validation), 500 (database).

## 11. Setup

### Prerequisites
Python 3.10+ and Node.js 18+.

### Backend
```bash
cd backend
python -m venv .venv
# Windows:   .venv\Scripts\activate
# Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # Windows: copy .env.example .env
python seed.py                # load demo data (resets the DB)
uvicorn app.main:app --reload --port 8000
```

### Frontend (second terminal)
```bash
cd frontend
npm install
npm run dev                   # opens http://localhost:5173
```

### Tests
```bash
cd backend
pytest -q
```

## 12. Environment variables
See `backend/.env.example`. Never commit `.env` (it is in `.gitignore`).

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./fraudguard.db` | use `postgresql+psycopg2://...` for PostgreSQL (`pip install psycopg2-binary`) |
| `CORS_ORIGINS` | `http://localhost:5173,...` | allowed frontend origins |
| `VELOCITY_TRANSACTION_LIMIT` / `VELOCITY_WINDOW_MINUTES` | 5 / 5 | velocity rule |
| `HIGH_AMOUNT_THRESHOLD` | 200000 | amount rule |
| `MAX_TRAVEL_SPEED_KMH` | 900 | location rule |
| `FLAG_THRESHOLD` / `NOTIFY_THRESHOLD` | 30 / 60 | flagging / alerting |
| `NOTIFICATION_BACKEND` | `auto` | `auto`, `console`, or `aws` |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | – | AWS credentials |
| `SNS_TOPIC_ARN` | – | publish alerts to SNS |
| `SES_FROM_EMAIL`, `SES_TO_EMAIL` | – | send alert email via SES |

Frontend: `VITE_API_URL` (default `http://localhost:8000`) in `frontend/.env`.

## 13. AWS notification setup
1. **SNS:** create a topic, subscribe your email, confirm the subscription, copy the Topic ARN into `SNS_TOPIC_ARN`.
2. **SES:** verify a sender address (and the recipient while in sandbox), set `SES_FROM_EMAIL` and `SES_TO_EMAIL`.
3. Create an IAM user allowed `sns:Publish` / `ses:SendEmail`; put its keys and `AWS_REGION` in `backend/.env`.
4. Restart the backend. `/health` now reports `AWSNotificationService`.

With no AWS config the app uses `ConsoleNotificationService`, which logs a clearly marked `HIGH-RISK NOTIFICATION TRIGGERED` block in the backend terminal. If an AWS call fails, the app logs the error, falls back to the console log and keeps working. The UI shows **"High-risk notification triggered"** with the channel used.

## 14. Demo flow (3-5 minutes)
1. `python seed.py`, start backend and frontend, open the dashboard.
2. Point out the **stat strip** (58 transactions, 13 flagged) and the four charts.
3. In the table, open the top **CRITICAL** transaction.
4. Read **"Why was this transaction flagged?"**: velocity ✓, unusual amount ✓, impossible location ✓, with score contributions and the notification banner.
5. Add a comment, click **Clear transaction** (or **Mark as reviewed**). The status badge changes immediately and a history entry appears.
6. Close the modal: **Pending reviews** dropped and the *Flagged vs cleared* chart updated.
7. Go to **Simulator**, click **All three rules** (or **Impossible travel**), then read the fresh result and the **High-risk notification triggered** banner. Show the backend terminal log.
8. Return to the console; the new transaction is at the top.
9. Explain extensibility: show `rules/` and the "Adding a new rule" snippet; the engine file never lists rules.

## 15. How this solution satisfies the problem requirements
| # | Official requirement | Where it is implemented |
|---|---|---|
| 1 | Rule engine for transaction risk evaluation | `app/rules/engine.py`, `scoring.py`, `services/evaluation.py` |
| 2 | ≥3 independent rules: velocity, unusual amount, impossible location | `rules/velocity.py`, `unusual_amount.py`, `impossible_location.py` |
| 3 | New rules addable without modifying the engine | `Rule` ABC + `@register_rule` + auto-discovery in `registry.py`; proven by a test |
| 4 | Persist transactions and fraud flags | SQLAlchemy tables `transactions`, `fraud_flags`, `reviews` (SQLite / PostgreSQL) |
| 5 | React-based reviewer console | `frontend/` (React + Vite) |
| 6 | Display flagged transactions | `GET /fraud/flags` + `FlagsTable` with filters/search |
| 7 | Mark as reviewed or cleared | `PATCH /fraud/flags/{id}/review` + `DetailModal` review form |
| 8 | AWS SES/SNS notification on high-risk threshold | `services/notifications.py` (`AWSNotificationService`, env-configured; console fallback) |

## 16. Future improvements
Authentication and reviewer roles · per-user learned baselines · rule enable/disable and threshold editing from the UI · Alembic migrations · WebSocket live updates · device/IP-based rules · async notification queue · Docker Compose.
