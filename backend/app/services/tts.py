import httpx
from app.config import get_settings

CARTESIA_URL = "https://api.cartesia.ai/tts/bytes"
VOICE_ID = "6ccbfb76-1fc6-48f7-b71d-91ac6298247b"


async def generate_narration(text: str, emotional_tone: str = "neutral") -> bytes:
    """Generate TTS audio bytes (wav) via Cartesia sonic-3."""
    settings = get_settings()

    payload = {
        "model_id": "sonic-3",
        "transcript": text,
        "voice": {"mode": "id", "id": VOICE_ID},
        "output_format": {
            "container": "wav",
            "encoding": "pcm_f32le",
            "sample_rate": 44100,
        },
        "speed": "normal",
        "generation_config": {"speed": 0.8, "volume": 1},
    }

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            CARTESIA_URL,
            headers={
                "Cartesia-Version": "2025-04-16",
                "X-API-Key": settings.cartesia_api_key,
                "Content-Type": "application/json",
            },
            json=payload,
        )
        resp.raise_for_status()
        return resp.content
