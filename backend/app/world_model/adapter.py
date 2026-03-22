from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class SceneJob:
    job_id: str


@dataclass
class SceneStatus:
    status: str  # "pending" | "processing" | "complete" | "failed"
    progress: float | None = None


@dataclass
class SceneAsset:
    format: str  # "spz" | "ply" | "splat"
    url: str
    metadata: dict | None = None


class WorldModelAdapter(ABC):
    @abstractmethod
    async def generate_scene(self, prompt: str) -> SceneJob:
        """Kick off scene generation. Returns a job ID for polling."""
        ...

    @abstractmethod
    async def get_scene_status(self, job_id: str) -> SceneStatus:
        """Check the status of a generation job."""
        ...

    @abstractmethod
    async def get_scene_asset(self, job_id: str) -> SceneAsset:
        """Retrieve the generated scene asset once complete."""
        ...
