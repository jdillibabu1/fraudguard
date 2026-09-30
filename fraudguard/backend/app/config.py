"""Central configuration. Every tunable value lives here and comes from env vars / .env."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./fraudguard.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Rule 1: velocity
    velocity_transaction_limit: int = 5
    velocity_window_minutes: int = 5
    velocity_score: int = 30

    # Rule 2: unusual amount (hybrid: absolute threshold OR multiple of user's average)
    high_amount_threshold: float = 200_000
    amount_history_multiplier: float = 5.0
    amount_history_min_txns: int = 3
    amount_history_floor: float = 10_000
    unusual_amount_score: int = 35

    # Rule 3: impossible travel
    max_travel_speed_kmh: float = 900.0
    min_travel_distance_km: float = 50.0
    impossible_location_score: int = 45

    # Risk levels: score >= threshold -> that level
    medium_threshold: int = 30
    high_threshold: int = 60
    critical_threshold: int = 80
    flag_threshold: int = 30      # score at/above which a transaction is "flagged"
    notify_threshold: int = 60    # score at/above which a notification is sent

    # Notifications
    notification_backend: str = "auto"  # auto | console | aws
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "ap-south-1"
    sns_topic_arn: str = ""
    ses_from_email: str = ""
    ses_to_email: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
