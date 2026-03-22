"""CRUD operations for generations and their moments."""

import uuid
from datetime import datetime, timezone

from app.db import get_db
from app.models.schemas import (
    GenerationDetail,
    GenerationSummary,
    KeyMoment,
    MomentDetail,
)


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


async def create_generation(source_text: str, source_filename: str | None = None, title: str = "") -> str:
    gen_id = uuid.uuid4().hex
    db = await get_db()
    try:
        now = _now()
        await db.execute(
            "INSERT INTO generations (id, title, source_text, source_filename, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)",
            (gen_id, title, source_text, source_filename, now, now),
        )
        await db.commit()
    finally:
        await db.close()
    return gen_id


async def update_generation_status(gen_id: str, status: str, title: str | None = None) -> None:
    db = await get_db()
    try:
        if title is not None:
            await db.execute(
                "UPDATE generations SET status = ?, title = ?, updated_at = ? WHERE id = ?",
                (status, title, _now(), gen_id),
            )
        else:
            await db.execute(
                "UPDATE generations SET status = ?, updated_at = ? WHERE id = ?",
                (status, _now(), gen_id),
            )
        await db.commit()
    finally:
        await db.close()


async def insert_moments(gen_id: str, moments: list[KeyMoment]) -> None:
    db = await get_db()
    try:
        now = _now()
        await db.executemany(
            """INSERT INTO moments
               (generation_id, moment_index, title, scene_description, narration_text, emotional_tone, page_reference, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [
                (gen_id, m.id, m.title, m.scene_description, m.narration_text, m.emotional_tone, m.page_reference, now, now)
                for m in moments
            ],
        )
        await db.commit()
    finally:
        await db.close()


async def update_moment_scene(gen_id: str, moment_index: int, status: str, asset_url: str | None = None, asset_format: str | None = None) -> None:
    db = await get_db()
    try:
        await db.execute(
            "UPDATE moments SET scene_status = ?, scene_asset_url = ?, scene_asset_format = ?, updated_at = ? WHERE generation_id = ? AND moment_index = ?",
            (status, asset_url, asset_format, _now(), gen_id, moment_index),
        )
        await db.commit()
    finally:
        await db.close()


async def update_moment_audio(gen_id: str, moment_index: int, status: str, audio_url: str | None = None) -> None:
    db = await get_db()
    try:
        await db.execute(
            "UPDATE moments SET audio_status = ?, audio_url = ?, updated_at = ? WHERE generation_id = ? AND moment_index = ?",
            (status, audio_url, _now(), gen_id, moment_index),
        )
        await db.commit()
    finally:
        await db.close()


async def list_generations() -> list[GenerationSummary]:
    db = await get_db()
    try:
        cursor = await db.execute(
            """SELECT g.id, g.title, g.status, g.source_filename, g.created_at, g.updated_at,
                      COUNT(m.id) AS moment_count
               FROM generations g
               LEFT JOIN moments m ON m.generation_id = g.id
               GROUP BY g.id
               ORDER BY g.created_at DESC"""
        )
        rows = await cursor.fetchall()
        return [
            GenerationSummary(
                id=r["id"],
                title=r["title"],
                status=r["status"],
                source_filename=r["source_filename"],
                moment_count=r["moment_count"],
                created_at=r["created_at"],
                updated_at=r["updated_at"],
            )
            for r in rows
        ]
    finally:
        await db.close()


async def get_generation(gen_id: str) -> GenerationDetail | None:
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM generations WHERE id = ?", (gen_id,))
        gen = await cursor.fetchone()
        if gen is None:
            return None

        cursor = await db.execute(
            "SELECT * FROM moments WHERE generation_id = ? ORDER BY moment_index", (gen_id,)
        )
        moment_rows = await cursor.fetchall()

        moments = [
            MomentDetail(
                moment_index=r["moment_index"],
                title=r["title"],
                scene_description=r["scene_description"],
                narration_text=r["narration_text"],
                emotional_tone=r["emotional_tone"],
                page_reference=r["page_reference"],
                scene_status=r["scene_status"],
                scene_asset_url=r["scene_asset_url"],
                scene_asset_format=r["scene_asset_format"],
                audio_status=r["audio_status"],
                audio_url=r["audio_url"],
            )
            for r in moment_rows
        ]

        return GenerationDetail(
            id=gen["id"],
            title=gen["title"],
            status=gen["status"],
            source_filename=gen["source_filename"],
            source_text=gen["source_text"],
            moments=moments,
            created_at=gen["created_at"],
            updated_at=gen["updated_at"],
        )
    finally:
        await db.close()


async def list_moments(gen_id: str) -> list[MomentDetail]:
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM moments WHERE generation_id = ? ORDER BY moment_index", (gen_id,)
        )
        rows = await cursor.fetchall()
        return [
            MomentDetail(
                moment_index=r["moment_index"],
                title=r["title"],
                scene_description=r["scene_description"],
                narration_text=r["narration_text"],
                emotional_tone=r["emotional_tone"],
                page_reference=r["page_reference"],
                scene_status=r["scene_status"],
                scene_asset_url=r["scene_asset_url"],
                scene_asset_format=r["scene_asset_format"],
                audio_status=r["audio_status"],
                audio_url=r["audio_url"],
            )
            for r in rows
        ]
    finally:
        await db.close()


async def get_moment(gen_id: str, moment_index: int) -> MomentDetail | None:
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM moments WHERE generation_id = ? AND moment_index = ?",
            (gen_id, moment_index),
        )
        r = await cursor.fetchone()
        if r is None:
            return None
        return MomentDetail(
            moment_index=r["moment_index"],
            title=r["title"],
            scene_description=r["scene_description"],
            narration_text=r["narration_text"],
            emotional_tone=r["emotional_tone"],
            page_reference=r["page_reference"],
            scene_status=r["scene_status"],
            scene_asset_url=r["scene_asset_url"],
            scene_asset_format=r["scene_asset_format"],
            audio_status=r["audio_status"],
            audio_url=r["audio_url"],
        )
    finally:
        await db.close()


async def recompute_generation_status(gen_id: str) -> str:
    """Derive the generation's overall status from its moments. Returns the new status."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT scene_status, audio_status FROM moments WHERE generation_id = ?", (gen_id,)
        )
        rows = await cursor.fetchall()

        if not rows:
            return "pending"

        all_scene = [r["scene_status"] for r in rows]
        all_audio = [r["audio_status"] for r in rows]

        if any(s == "failed" for s in all_scene + all_audio):
            status = "failed"
        elif all(s == "complete" for s in all_scene) and all(s == "complete" for s in all_audio):
            status = "complete"
        else:
            status = "processing"

        await db.execute("UPDATE generations SET status = ?, updated_at = ? WHERE id = ?", (status, _now(), gen_id))
        await db.commit()
        return status
    finally:
        await db.close()
