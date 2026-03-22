from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from app.models.schemas import ExtractMomentsRequest, ExtractMomentsResponse
from app.services.llm import extract_key_moments
from app.services.pdf import extract_text_from_pdf

router = APIRouter()


@router.post("/extract-moments", response_model=ExtractMomentsResponse)
async def extract_moments(request: ExtractMomentsRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    if not 1 <= request.num_scenes <= 20:
        raise HTTPException(status_code=400, detail="num_scenes must be between 1 and 20")

    try:
        moments = await extract_key_moments(request.text, request.num_scenes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract moments: {e}")

    return ExtractMomentsResponse(moments=moments)


@router.post("/parse-and-extract", response_model=ExtractMomentsResponse)
async def parse_and_extract(
    file: UploadFile = File(...),
    num_scenes: int = Form(5),
):
    """Upload a PDF or TXT file and extract key moments in one step. No DB, no generation."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    if not 1 <= num_scenes <= 20:
        raise HTTPException(status_code=400, detail="num_scenes must be between 1 and 20")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    name = file.filename.lower()
    if name.endswith(".pdf"):
        try:
            text, _ = extract_text_from_pdf(file_bytes)
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Failed to parse PDF: {e}")
    elif name.endswith(".txt"):
        text = file_bytes.decode("utf-8", errors="replace")
    else:
        raise HTTPException(status_code=400, detail="Only .pdf and .txt files are supported")

    if not text.strip():
        raise HTTPException(status_code=422, detail="No text could be extracted from the file")

    try:
        moments = await extract_key_moments(text, num_scenes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract moments: {e}")

    return ExtractMomentsResponse(moments=moments)
