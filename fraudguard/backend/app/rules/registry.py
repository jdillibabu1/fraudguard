"""Auto-discovery: every module in app/rules/ that uses @register_rule is picked up."""
import importlib
import pkgutil

from ..config import Settings
from .base import Rule

_REGISTRY: dict[str, type[Rule]] = {}


def register_rule(cls: type[Rule]) -> type[Rule]:
    if not cls.name:
        raise ValueError(f"{cls.__name__} must define a `name`")
    _REGISTRY[cls.name] = cls
    return cls


def discover_rules(settings: Settings) -> list[Rule]:
    """Import every module in this package, then instantiate all registered rules."""
    package = importlib.import_module(__package__)
    for mod in pkgutil.iter_modules(package.__path__):
        if mod.name not in {"base", "registry", "engine", "scoring"}:
            importlib.import_module(f"{__package__}.{mod.name}")
    return [cls(settings) for cls in _REGISTRY.values()]
