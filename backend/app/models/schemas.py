from pydantic import BaseModel


# --- Key Moment (LLM extraction output) ---

class KeyMoment(BaseModel):
    id: int
    title: str
    scene_description: str
    narration_text: str
    emotional_tone: str
    page_reference: str | None = None


# --- Low-level endpoints (still useful individually) ---

class ExtractMomentsRequest(BaseModel):
    text: str
    num_scenes: int = 5


class ExtractMomentsResponse(BaseModel):
    moments: list[KeyMoment]


class GenerateSceneRequest(BaseModel):
    prompt: str


class GenerateSceneResponse(BaseModel):
    job_id: str


class SceneStatusResponse(BaseModel):
    status: str  # "pending" | "processing" | "complete" | "failed"
    progress: float | None = None
    asset_url: str | None = None
    asset_format: str | None = None


class NarrateRequest(BaseModel):
    text: str
    emotional_tone: str = "neutral"


class ParseResponse(BaseModel):
    text: str
    page_count: int


# --- Generation entity (top-level orchestrated pipeline) ---

class CreateGenerationRequest(BaseModel):
    text: str | None = None
    # PDF is sent as multipart file, text as fallback


class MomentDetail(BaseModel):
    moment_index: int
    title: str
    scene_description: str
    narration_text: str
    emotional_tone: str
    page_reference: str | None = None
    scene_status: str
    scene_asset_url: str | None = None
    scene_asset_format: str | None = None
    audio_status: str
    audio_url: str | None = None


class GenerationSummary(BaseModel):
    id: str
    title: str
    status: str
    source_filename: str | None = None
    moment_count: int
    created_at: str
    updated_at: str


class GenerationDetail(BaseModel):
    id: str
    title: str
    status: str
    source_filename: str | None = None
    source_text: str
    moments: list[MomentDetail]
    created_at: str
    updated_at: str


class SceneListResponse(BaseModel):
    generation_id: str
    scenes: list[MomentDetail]


class GenerationListResponse(BaseModel):
    generations: list[GenerationSummary]


class GenerationCreateResponse(BaseModel):
    id: str
    status: str
