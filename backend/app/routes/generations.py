import asyncio
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.config import get_settings
from app.models.schemas import (
    GenerationCreateResponse,
    GenerationDetail,
    GenerationListResponse,
    MomentDetail,
    SceneListResponse,
)
from app.services.generation_store import (
    create_generation,
    get_generation,
    get_moment,
    list_generations,
    list_moments,
)
from app.services.pdf import extract_text_from_pdf
from app.services.pipeline import run_pipeline

router = APIRouter()


@router.post("/generations", response_model=GenerationCreateResponse)
async def create_new_generation(
    file: UploadFile | None = File(None),
    text: str | None = Form(None),
    num_scenes: int = Form(5),
):
    """Start a new generation from a PDF upload or raw text.

    The pipeline runs in the background: extract moments -> generate scenes + narrate.
    Poll GET /api/generations/{id} to track progress.
    """
    source_text: str | None = None
    source_filename: str | None = None

    if file is not None and file.filename:
        name = file.filename.lower()
        if not (name.endswith(".pdf") or name.endswith(".txt")):
            raise HTTPException(status_code=400, detail="Only .pdf and .txt files are supported")

        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(status_code=400, detail="Empty file")

        if name.endswith(".pdf"):
            try:
                source_text, _ = extract_text_from_pdf(file_bytes)
            except Exception as e:
                raise HTTPException(status_code=422, detail=f"Failed to parse PDF: {e}")
        else:
            source_text = file_bytes.decode("utf-8", errors="replace")

        if not source_text.strip():
            raise HTTPException(status_code=422, detail="No text could be extracted from the file")

        source_filename = file.filename

    elif text and text.strip():
        source_text = text.strip()
    else:
        raise HTTPException(status_code=400, detail="Provide either a PDF file or text")

    if not 1 <= num_scenes <= 20:
        raise HTTPException(status_code=400, detail="num_scenes must be between 1 and 20")

    gen_id = await create_generation(source_text, source_filename)
    asyncio.create_task(run_pipeline(gen_id, source_text, num_scenes))

    return GenerationCreateResponse(id=gen_id, status="pending")


@router.get("/generations", response_model=GenerationListResponse)
async def get_all_generations():
    """List all generations, newest first."""
    gens = await list_generations()
    return GenerationListResponse(generations=gens)


@router.get("/generations/{gen_id}", response_model=GenerationDetail)
async def get_generation_by_id(gen_id: str):
    """Get full details of a generation including all moments and their scene/audio status."""
    gen = await get_generation(gen_id)
    if gen is None:
        raise HTTPException(status_code=404, detail="Generation not found")
    return gen


@router.get("/generations/{gen_id}/scenes", response_model=SceneListResponse)
async def get_scenes(gen_id: str):
    """List all scenes/moments for a generation, ordered by moment_index."""
    gen = await get_generation(gen_id)
    if gen is None:
        raise HTTPException(status_code=404, detail="Generation not found")

    moments = await list_moments(gen_id)
    return SceneListResponse(generation_id=gen_id, scenes=moments)


@router.get("/generations/{gen_id}/scenes/{moment_index}", response_model=MomentDetail)
async def get_scene(gen_id: str, moment_index: int):
    """Get details of a specific scene by its index."""
    moment = await get_moment(gen_id, moment_index)
    if moment is None:
        raise HTTPException(status_code=404, detail="Scene not found")
    return moment


@router.get("/generations/{gen_id}/scenes/{moment_index}/splat")
async def get_scene_splat(gen_id: str, moment_index: int):
    """Download the gaussian splat file for a scene."""
    moment = await get_moment(gen_id, moment_index)
    if moment is None:
        raise HTTPException(status_code=404, detail="Scene not found")
    if moment.scene_status != "complete" or not moment.scene_asset_url:
        raise HTTPException(status_code=404, detail=f"Scene splat not available (status: {moment.scene_status})")

    settings = get_settings()
    file_path = Path(settings.static_dir) / moment.scene_asset_url.removeprefix("/static/")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Splat file not found on disk")

    media_type = "application/octet-stream"
    if moment.scene_asset_format == "ply":
        media_type = "application/x-ply"
    elif moment.scene_asset_format == "spz":
        media_type = "application/octet-stream"

    return FileResponse(file_path, media_type=media_type, filename=file_path.name)


@router.get("/generations/{gen_id}/scenes/{moment_index}/audio")
async def get_scene_audio(gen_id: str, moment_index: int):
    """Download the narration audio file for a scene."""
    moment = await get_moment(gen_id, moment_index)
    if moment is None:
        raise HTTPException(status_code=404, detail="Scene not found")
    if moment.audio_status != "complete" or not moment.audio_url:
        raise HTTPException(status_code=404, detail=f"Audio not available (status: {moment.audio_status})")

    settings = get_settings()
    file_path = Path(settings.static_dir) / moment.audio_url.removeprefix("/static/")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found on disk")

    return FileResponse(file_path, media_type="audio/wav", filename=file_path.name)
