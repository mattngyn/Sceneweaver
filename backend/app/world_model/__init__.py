import importlib

from app.config import get_settings
from .adapter import WorldModelAdapter


def create_adapter() -> WorldModelAdapter:
    """Create a world model adapter based on WORLD_MODEL_BACKEND env var.

    Discovers adapters by convention: a backend named "foo" loads
    app.world_model.foo_adapter and instantiates FooAdapter.
    """
    settings = get_settings()
    backend = settings.world_model_backend

    module_name = f".{backend}_adapter"

    try:
        module = importlib.import_module(module_name, package=__package__)
    except ModuleNotFoundError:
        raise ValueError(f"Unknown world model backend: {backend!r} (no module {module_name})")

    # Find the first concrete WorldModelAdapter subclass in the module
    for attr_name in dir(module):
        obj = getattr(module, attr_name)
        if isinstance(obj, type) and issubclass(obj, WorldModelAdapter) and obj is not WorldModelAdapter:
            return obj()

    raise ValueError(f"Module {module_name} has no WorldModelAdapter subclass")
