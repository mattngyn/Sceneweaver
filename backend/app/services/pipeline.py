"""
Background pipeline orchestrator.
Runs the full generation flow: extract moments -> (generate scene + narrate) per moment.
All progress is persisted to SQLite so the frontend can poll.
"""

import asyncio
import logging
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

logger = logging.getLogger(__name__)


async def _generate_scene_for_moment(gen_id: str, moment_index: int, scene_description: str) -> None:
    """Kick off scene generation and poll until complete."""
    try:
        logger.info(f"[{gen_id}] Scene {moment_index}: creating adapter")
        adapter = create_adapter()

        await update_moment_scene(gen_id, moment_index, "processing")

        logger.info(f"[{gen_id}] Scene {moment_index}: starting generation")
        job = await adapter.generate_scene(scene_description)
        logger.info(f"[{gen_id}] Scene {moment_index}: job_id={job.job_id}, polling...")

        while True:
            await asyncio.sleep(5)
            status = await adapter.get_scene_status(job.job_id)
            logger.info(f"[{gen_id}] Scene {moment_index}: status={status.status}, progress={status.progress}")

            if status.status == "complete":
                asset = await adapter.get_scene_asset(job.job_id)
                await update_moment_scene(gen_id, moment_index, "complete", asset.url, asset.format)
                logger.info(f"[{gen_id}] Scene {moment_index}: complete -> {asset.url}")
                return
            elif status.status == "failed":
                await update_moment_scene(gen_id, moment_index, "failed")
                logger.error(f"[{gen_id}] Scene {moment_index}: generation failed")
                return
    except Exception:
        logger.exception(f"[{gen_id}] Scene {moment_index}: exception")
        try:
            await update_moment_scene(gen_id, moment_index, "failed")
        except Exception:
            pass


async def _generate_audio_for_moment(gen_id: str, moment_index: int, narration_text: str, emotional_tone: str) -> None:
    """Generate TTS audio and save to disk."""
    await update_moment_audio(gen_id, moment_index, "processing")

    try:
        logger.info(f"[{gen_id}] Audio {moment_index}: generating TTS ({len(narration_text)} chars)")
        audio_bytes = await generate_narration(narration_text, emotional_tone)

        settings = get_settings()
        audio_dir = Path(settings.static_dir) / "audio"
        audio_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{gen_id}_{moment_index}.wav"
        audio_path = audio_dir / filename
        audio_path.write_bytes(audio_bytes)

        await update_moment_audio(gen_id, moment_index, "complete", f"/static/audio/{filename}")
        logger.info(f"[{gen_id}] Audio {moment_index}: complete ({len(audio_bytes)} bytes)")
    except Exception as e:
        logger.exception(f"[{gen_id}] Audio {moment_index}: exception during TTS")
        await update_moment_audio(gen_id, moment_index, "failed")


async def run_pipeline(gen_id: str, source_text: str, num_scenes: int = 5, book_title: str | None = None) -> None:
    """Full pipeline: extract moments, then generate scenes + audio in parallel per moment."""
    try:
        logger.info(f"[{gen_id}] Pipeline started (num_scenes={num_scenes}, book_title={book_title})")
        await update_generation_status(gen_id, "extracting")

        moments = await extract_key_moments(source_text, num_scenes, book_title=book_title)
        if not moments:
            logger.error(f"[{gen_id}] No moments extracted")
            await update_generation_status(gen_id, "failed")
            return

        title = book_title or (moments[0].title if moments else "Untitled")
        logger.info(f"[{gen_id}] Extracted {len(moments)} moments, title={title!r}")
        await update_generation_status(gen_id, "processing", title=title)
        await insert_moments(gen_id, moments)

        tasks = []
        for m in moments:
            scene_prompt = m.scene_description
            if book_title:
                scene_prompt = f"[From the book \"{book_title}\"] {scene_prompt}"
            tasks.append(_generate_scene_for_moment(gen_id, m.id, scene_prompt))
            tasks.append(_generate_audio_for_moment(gen_id, m.id, m.narration_text, m.emotional_tone))

        await asyncio.gather(*tasks, return_exceptions=True)
        final_status = await recompute_generation_status(gen_id)
        logger.info(f"[{gen_id}] Pipeline finished: {final_status}")

    except Exception as e:
        logger.exception(f"[{gen_id}] Pipeline failed")
        await update_generation_status(gen_id, "failed")
