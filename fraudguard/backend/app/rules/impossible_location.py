from math import asin, cos, radians, sin, sqrt

from .base import Rule, RuleContext, RuleResult
from .registry import register_rule

EARTH_RADIUS_KM = 6371.0088


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    dlat, dlon = radians(lat2 - lat1), radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * asin(sqrt(a))


@register_rule
class ImpossibleLocationRule(Rule):
    name = "impossible_location"
    title = "Impossible Location"
    description = "Required travel speed between two consecutive transactions is unrealistic."

    def evaluate(self, ctx: RuleContext) -> RuleResult:
        s, tx = ctx.settings, ctx.transaction
        earlier = [h for h in ctx.history if h.timestamp <= tx.timestamp]
        if not earlier:
            return self.miss("No previous transaction to compare against")
        prev = max(earlier, key=lambda h: h.timestamp)

        km = haversine_km(prev.latitude, prev.longitude, tx.latitude, tx.longitude)
        hours = (tx.timestamp - prev.timestamp).total_seconds() / 3600
        if km < s.min_travel_distance_km:
            return self.miss(f"Only {km:.0f} km from previous transaction")

        speed = float("inf") if hours <= 0 else km / hours
        if speed > s.max_travel_speed_kmh:
            minutes = hours * 60
            speed_txt = "instant" if speed == float("inf") else f"{speed:,.0f} km/h"
            return self.hit(
                f"{km:,.0f} km from previous transaction in {minutes:.0f} min "
                f"(required speed {speed_txt}; max realistic {s.max_travel_speed_kmh:,.0f} km/h)",
                s.impossible_location_score,
                "HIGH",
            )
        return self.miss(f"{km:,.0f} km in {hours * 60:.0f} min is physically plausible")
