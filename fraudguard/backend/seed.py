"""Deterministic demo data.  Run:  python seed.py   (resets the database)."""
import random
from datetime import datetime, timedelta, timezone

from app.config import get_settings
from app.database import Base, SessionLocal, engine, init_db
from app.models import Review, Transaction, User, utcnow
from app.services.evaluation import evaluate_transaction, get_engine, get_notification_service

CITIES = {
    "Chennai": (13.0827, 80.2707), "Mumbai": (19.0760, 72.8777), "Bengaluru": (12.9716, 77.5946),
    "Delhi": (28.6139, 77.2090), "Hyderabad": (17.3850, 78.4867), "Pune": (18.5204, 73.8567),
    "Kolkata": (22.5726, 88.3639), "Kochi": (9.9312, 76.2673),
    "New York": (40.7128, -74.0060), "London": (51.5074, -0.1278),
    "Singapore": (1.3521, 103.8198), "Dubai": (25.2048, 55.2708),
}
USERS = {  # user_id: (name, home city)
    "USR-1001": ("Aarav Menon", "Chennai"), "USR-1002": ("Priya Shah", "Mumbai"),
    "USR-1003": ("Rohan Iyer", "Bengaluru"), "USR-1004": ("Meera Kapoor", "Delhi"),
    "USR-1005": ("Karthik Reddy", "Hyderabad"), "USR-1006": ("Sneha Kulkarni", "Pune"),
    "USR-1007": ("Vikram Sen", "Kolkata"), "USR-1008": ("Ananya Nair", "Kochi"),
}
MERCHANTS = ["Amazon India", "Swiggy", "Zomato", "BigBasket", "Flipkart", "IRCTC", "Uber", "Reliance Fresh",
             "Myntra", "BookMyShow", "Apollo Pharmacy", "Croma"]


def build_plan(now: datetime):
    """Returns list of (user, minutes_ago_offset_from_day0, amount, city, merchant)."""
    rnd = random.Random(42)
    day0 = (now - timedelta(days=6)).replace(hour=9, minute=0, second=0, microsecond=0)
    plan = []

    def add(user, at, amount, city, merchant=None):
        plan.append((user, at, amount, city, merchant or rnd.choice(MERCHANTS)))

    # 1. normal activity (spread over 6 days, hours apart, at home city)
    for i in range(30):
        user = f"USR-{1001 + i % 8}"
        add(user, day0 + timedelta(days=i // 5, hours=(i % 5) * 3 + rnd.randint(0, 2), minutes=rnd.randint(0, 50)),
            round(rnd.uniform(250, 14000), 2), USERS[user][1])

    # 2. rapid repeated transactions: USR-1003, 7 in ~4 min (velocity)
    t = day0 + timedelta(days=3, hours=14)
    for k in range(7):
        add("USR-1003", t + timedelta(seconds=k * 40), round(rnd.uniform(400, 1800), 2), "Bengaluru", "Gift Card Hub")

    # 3. high-value transactions (unusual amount)
    add("USR-1002", day0 + timedelta(days=2, hours=16), 650_000, "Mumbai", "Tanishq Jewellers")
    add("USR-1005", day0 + timedelta(days=4, hours=11), 480_000, "Hyderabad", "Croma")
    add("USR-1007", day0 + timedelta(days=5, hours=13), 275_000, "Kolkata", "Electronics Mart")

    # 4. impossible location
    t = day0 + timedelta(days=1, hours=19)                       # Chennai -> New York in 15 min
    add("USR-1001", t, 4200, "Chennai", "Saravana Stores")
    add("USR-1001", t + timedelta(minutes=15), 8600, "New York", "Best Buy")
    t = day0 + timedelta(days=4, hours=20)                       # Delhi -> London in 20 min, high value
    add("USR-1004", t, 3100, "Delhi", "Apollo Pharmacy")
    add("USR-1004", t + timedelta(minutes=20), 320_000, "London", "Harrods")

    # 5. multiple rules at once: Pune <-> Singapore hopping every minute, high value at the end
    t = day0 + timedelta(days=5, hours=9)
    for k in range(6):
        add("USR-1006", t + timedelta(minutes=k), 420_000 if k >= 4 else 6500,
            "Pune" if k % 2 == 0 else "Singapore", "CryptoXchange")

    # 5b. velocity + high value = HIGH: USR-1007 rapid burst ending with a big purchase
    t = day0 + timedelta(days=3, hours=18)
    for k in range(6):
        add("USR-1007", t + timedelta(seconds=k * 30), 240_000 if k == 5 else round(rnd.uniform(500, 2500), 2),
            "Kolkata", "QuickPay Wallet")

    # 6. some benign travel for contrast: Kochi -> Bengaluru next day (plausible)
    add("USR-1008", day0 + timedelta(days=2, hours=8), 1800, "Kochi")
    add("USR-1008", day0 + timedelta(days=2, hours=20), 2300, "Bengaluru")
    return sorted(plan, key=lambda p: p[1])


def main():
    settings = get_settings()
    Base.metadata.drop_all(bind=engine)
    init_db()
    db = SessionLocal()
    engine_ = get_engine()
    notifier = get_notification_service()

    for uid, (name, _) in USERS.items():
        db.add(User(user_id=uid, name=name))
    db.commit()

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    flags = []
    for n, (user, ts, amount, city, merchant) in enumerate(build_plan(now), start=1):
        lat, lon = CITIES[city]
        txn = Transaction(transaction_id=f"TXN-{n:05d}", user_id=user, amount=amount, currency="INR",
                          timestamp=ts, latitude=lat, longitude=lon, location_name=city, merchant=merchant)
        db.add(txn)
        db.commit()
        db.refresh(txn)
        flags.append(evaluate_transaction(db, txn, engine_, notifier, settings))

    # a few historical review decisions so the charts are populated
    flagged = [f for f in flags if f.is_flagged]
    decisions = [("CLEARED", "Customer confirmed purchase by phone."),
                 ("REVIEWED", "Confirmed suspicious; card blocked."),
                 ("CLEARED", "Known high-value purchase, KYC verified.")]
    picks = [f for f in flagged if f.risk_level == "MEDIUM"][:2] + [f for f in flagged if f.risk_level == "HIGH"][:1]
    for f, (status, comment) in zip(picks, decisions):
        f.review_status, f.reviewed_by, f.reviewed_at, f.review_comment = status, "seed.analyst", utcnow(), comment
        db.add(Review(fraud_flag_id=f.id, status=status, reviewed_by="seed.analyst", comment=comment))
    db.commit()

    from collections import Counter
    c = Counter(f.risk_level for f in flags)
    print(f"\nSeeded {len(flags)} transactions, {len(flagged)} flagged. Risk levels: {dict(c)}")
    db.close()


if __name__ == "__main__":
    main()
