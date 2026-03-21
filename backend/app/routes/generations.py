import asyncio

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.models.schemas import (
    GenerationCreateResponse,
    GenerationDetail,
    GenerationListResponse,
)
from app.services.generation_store import (
    create_generation,
    get_generation,
    list_generations,
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
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")

        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(status_code=400, detail="Empty file")

        try:
            source_text, _ = extract_text_from_pdf(file_bytes)
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Failed to parse PDF: {e}")

        if not source_text.strip():
            raise HTTPException(status_code=422, detail="No text could be extracted from the PDF")

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
