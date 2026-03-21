"""
Background pipeline orchestrator.
Runs the full generation flow: extract moments -> (generate scene + narrate) per moment.
All progress is persisted to SQLite so the frontend can poll.
"""

import asyncio
import uuid
from pathlib import Path

from app.config import get_settings
from app.services.llm import extract_key_moments
from app.services.tts import generate_narration
from app.services.generation_store import (
    insert_moments,
    recompute_generation_status,
    update_generation_status,
    update_moment_audio,
    update_moment_scene,
)
from app.world_model import create_adapter


async def _generate_scene_for_moment(gen_id: str, moment_index: int, scene_description: str) -> None:
    """Kick off scene generation and poll until complete."""
    adapter = create_adapter()

    await update_moment_scene(gen_id, moment_index, "processing")

    try:
        job = await adapter.generate_scene(scene_description)

        while True:
            await asyncio.sleep(2)
            status = await adapter.get_scene_status(job.job_id)

            if status.status == "complete":
                asset = await adapter.get_scene_asset(job.job_id)
                await update_moment_scene(gen_id, moment_index, "complete", asset.url, asset.format)
                return
            elif status.status == "failed":
                await update_moment_scene(gen_id, moment_index, "failed")
                return
    except Exception:
        await update_moment_scene(gen_id, moment_index, "failed")


async def _generate_audio_for_moment(gen_id: str, moment_index: int, narration_text: str, emotional_tone: str) -> None:
    """Generate TTS audio and save to disk."""
    await update_moment_audio(gen_id, moment_index, "processing")

    try:
        audio_bytes = await generate_narration(narration_text, emotional_tone)

        settings = get_settings()
        audio_dir = Path(settings.static_dir) / "audio"
        audio_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{gen_id}_{moment_index}.wav"
        audio_path = audio_dir / filename
        audio_path.write_bytes(audio_bytes)

        await update_moment_audio(gen_id, moment_index, "complete", f"/static/audio/{filename}")
    except Exception:
        await update_moment_audio(gen_id, moment_index, "failed")


async def run_pipeline(gen_id: str, source_text: str, num_scenes: int = 5) -> None:
    """Full pipeline: extract moments, then generate scenes + audio in parallel per moment."""
    try:
        await update_generation_status(gen_id, "extracting")

        moments = await extract_key_moments(source_text, num_scenes)
        if not moments:
            await update_generation_status(gen_id, "failed")
            return

        title = moments[0].title if moments else "Untitled"
        await update_generation_status(gen_id, "processing", title=title)
        await insert_moments(gen_id, moments)

        # For each moment, run scene generation and audio generation concurrently
        tasks = []
        for m in moments:
            tasks.append(_generate_scene_for_moment(gen_id, m.id, m.scene_description))
            tasks.append(_generate_audio_for_moment(gen_id, m.id, m.narration_text, m.emotional_tone))

        await asyncio.gather(*tasks, return_exceptions=True)
        await recompute_generation_status(gen_id)

    except Exception:
        await update_generation_status(gen_id, "failed")
