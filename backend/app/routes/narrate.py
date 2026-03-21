from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from app.models.schemas import NarrateRequest
from app.services.tts import generate_narration

router = APIRouter()


@router.post("/narrate")
async def narrate(request: NarrateRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Narration text cannot be empty")

    try:
        audio_bytes = await generate_narration(request.text, request.emotional_tone)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate narration: {e}")

    return Response(content=audio_bytes, media_type="audio/wav")
