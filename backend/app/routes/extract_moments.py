from fastapi import APIRouter, HTTPException
from app.models.schemas import ExtractMomentsRequest, ExtractMomentsResponse
from app.services.llm import extract_key_moments

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
