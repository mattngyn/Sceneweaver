from __future__ import annotations

import argparse
import json
import os
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from dotenv import load_dotenv

load_dotenv()

try:
    import fitz
except ImportError as exc:
    raise ImportError("PyMuPDF is required. Install it with: pip install pymupdf") from exc


DEFAULT_MODEL = "gemini-2.5-flash"

DIR_INPUT = "input"
DIR_PROMPTS = "prompts"
DIR_TEXT = "text"
DIR_SECTION_TEXT = "text/sections"
DIR_MANIFESTS = "manifests"
DIR_GENERATIONS = "generations"
DIR_WORLD = "world"
DIR_AUDIO = "audio"

PROJECT_MANIFEST = "manifests/project.json"
SECTIONS_MANIFEST = "manifests/sections.json"
UI_MANIFEST = "manifests/ui_manifest.json"
BOOK_ENVIRONMENTS = "manifests/book_environments.json"
FULL_TEXT_FILE = "text/full_book.txt"
DEFAULT_PROJECT_PROMPT = "prompts/environment_summary.txt"

DEFAULT_ENVIRONMENT_PROMPT = """You are extracting scene descriptions for a 3D world generation pipeline.

Task:
Read the source text and produce EXACTLY 3 high-quality paragraphs that capture the 3 primary environments from the passage.

Hard rules:
1. Environment only.
2. Do NOT mention people, characters, creatures, bodies, faces, names, clothing, dialogue, emotions, or actions.
3. Focus on place, layout, architecture, landscape, weather, time of day, lighting, textures, objects, color, scale, and atmosphere.
4. Each paragraph should stand on its own as a clean world or scene prompt.
5. Each paragraph should be one paragraph only, not bullet points.
6. Do not include numbering or labels.
7. If the text mostly covers one place, still return 3 paragraphs by separating it into the 3 most visually distinct environmental views or sub-environments.
8. Keep each paragraph concrete and visual, not abstract literary analysis.

Source text:
{{SECTION_TEXT}}
""".strip()


def _now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def _clean_text(text: str) -> str:
    text = text.replace("\u00a0", " ")
    text = text.replace("\u00ad\n", "")
    text = re.sub(r"-\n(?=[a-z])", "", text)
    text = re.sub(r"\s+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def _safe_name(value: str, max_len: int = 80) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "_", value).strip("_")
    return (value[:max_len] or "item").lower()


def _read_json(path: Union[str, Path]) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _write_json(path: Union[str, Path], payload: Any) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def _rel(path: Path, root: Path) -> str:
    return str(path.resolve().relative_to(root.resolve())).replace("\\", "/")


def _absolute_project_dir(project_dir: Union[str, Path]) -> Path:
    project_dir = Path(project_dir)
    if not project_dir.exists():
        raise FileNotFoundError(f"Project directory not found: {project_dir}")
    return project_dir.resolve()


def _project_paths(project_dir: Union[str, Path]) -> Dict[str, Path]:
    root = _absolute_project_dir(project_dir)
    return {
        "root": root,
        "input": root / DIR_INPUT,
        "prompts": root / DIR_PROMPTS,
        "text": root / DIR_TEXT,
        "section_text": root / DIR_SECTION_TEXT,
        "manifests": root / DIR_MANIFESTS,
        "generations": root / DIR_GENERATIONS,
        "world": root / DIR_WORLD,
        "audio": root / DIR_AUDIO,
        "project_manifest": root / PROJECT_MANIFEST,
        "sections_manifest": root / SECTIONS_MANIFEST,
        "ui_manifest": root / UI_MANIFEST,
        "book_environments": root / BOOK_ENVIRONMENTS,
        "full_text": root / FULL_TEXT_FILE,
        "prompt_file": root / DEFAULT_PROJECT_PROMPT,
    }


def _ensure_project_dirs(project_dir: Union[str, Path]) -> Dict[str, Path]:
    root = Path(project_dir).resolve()
    paths = {
        "root": root,
        "input": root / DIR_INPUT,
        "prompts": root / DIR_PROMPTS,
        "text": root / DIR_TEXT,
        "section_text": root / DIR_SECTION_TEXT,
        "manifests": root / DIR_MANIFESTS,
        "generations": root / DIR_GENERATIONS,
        "world": root / DIR_WORLD,
        "audio": root / DIR_AUDIO,
    }
    for path in paths.values():
        path.mkdir(parents=True, exist_ok=True)

    prompt_file = root / DEFAULT_PROJECT_PROMPT
    if not prompt_file.exists():
        prompt_file.write_text(DEFAULT_ENVIRONMENT_PROMPT, encoding="utf-8")

    return _project_paths(root)


def _load_sections(project_dir: Union[str, Path]) -> List[Dict[str, Any]]:
    paths = _project_paths(project_dir)
    if not paths["sections_manifest"].exists():
        raise FileNotFoundError("sections.json not found. Run build_section_index or process_book first.")
    return _read_json(paths["sections_manifest"])


def _save_sections(project_dir: Union[str, Path], sections: List[Dict[str, Any]]) -> None:
    paths = _project_paths(project_dir)
    _write_json(paths["sections_manifest"], sections)


def _find_section(project_dir: Union[str, Path], section_identifier: Union[int, str]) -> Dict[str, Any]:
    sections = _load_sections(project_dir)
    if isinstance(section_identifier, int):
        for section in sections:
            if section["index"] == section_identifier:
                return section
        raise IndexError(f"No section with index {section_identifier}")

    section_identifier = section_identifier.strip()
    for section in sections:
        if section["title"] == section_identifier:
            return section
    target = section_identifier.lower()
    for section in sections:
        if target in section["title"].lower():
            return section
    raise ValueError(f"Could not find a section matching '{section_identifier}'")


def create_project(
    pdf_path: Union[str, Path],
    workspace: Union[str, Path] = "story_projects",
    project_name: Optional[str] = None,
    overwrite: bool = False,
) -> Dict[str, Any]:
    pdf_path = Path(pdf_path).resolve()
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    name = _safe_name(project_name or pdf_path.stem)
    project_dir = Path(workspace).resolve() / name

    if project_dir.exists() and not overwrite:
        paths = _project_paths(project_dir)
        if paths["project_manifest"].exists():
            return _read_json(paths["project_manifest"])

    paths = _ensure_project_dirs(project_dir)
    stored_pdf = paths["input"] / pdf_path.name
    shutil.copy2(pdf_path, stored_pdf)

    manifest = {
        "project_name": name,
        "project_dir": str(paths["root"]),
        "source_pdf_name": pdf_path.name,
        "source_pdf_path": str(pdf_path),
        "stored_pdf_path": str(stored_pdf),
        "relative_stored_pdf_path": _rel(stored_pdf, paths["root"]),
        "prompt_path": _rel(paths["prompt_file"], paths["root"]),
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
        "status": {
            "text_extracted": False,
            "sections_indexed": False,
            "all_sections_summarized": False,
        },
    }
    _write_json(paths["project_manifest"], manifest)
    return manifest


def load_project(project_dir: Union[str, Path]) -> Dict[str, Any]:
    paths = _project_paths(project_dir)
    if not paths["project_manifest"].exists():
        raise FileNotFoundError("project.json not found in manifests/")
    return _read_json(paths["project_manifest"])


def _update_project_status(project_dir: Union[str, Path], **status_updates: bool) -> Dict[str, Any]:
    paths = _project_paths(project_dir)
    manifest = load_project(project_dir)
    manifest["status"] = {**manifest.get("status", {}), **status_updates}
    manifest["updated_at"] = _now_iso()
    _write_json(paths["project_manifest"], manifest)
    return manifest


def extract_pdf_text(project_dir: Union[str, Path], pdf_path: Optional[Union[str, Path]] = None) -> Dict[str, Any]:
    paths = _ensure_project_dirs(project_dir)
    project = load_project(project_dir)
    book_path = Path(pdf_path).resolve() if pdf_path else Path(project["stored_pdf_path"]).resolve()

    doc = fitz.open(book_path)
    page_texts = [_clean_text(page.get_text("text")) for page in doc]
    full_text = _clean_text("\n\n".join(page_texts))
    paths["full_text"].write_text(full_text, encoding="utf-8")

    pages_manifest = []
    for page_index, page_text in enumerate(page_texts):
        pages_manifest.append(
            {
                "page_number": page_index + 1,
                "char_count": len(page_text),
                "empty": not bool(page_text.strip()),
            }
        )
    _write_json(paths["manifests"] / "pages.json", pages_manifest)

    _update_project_status(project_dir, text_extracted=True)
    return {
        "full_text_path": str(paths["full_text"]),
        "relative_full_text_path": _rel(paths["full_text"], paths["root"]),
        "page_count": len(page_texts),
        "char_count": len(full_text),
    }


def build_section_index(
    project_dir: Union[str, Path],
    fallback_pages_per_chunk: int = 8,
    min_chars_per_section: int = 900,
) -> List[Dict[str, Any]]:
    paths = _ensure_project_dirs(project_dir)
    project = load_project(project_dir)
    book_path = Path(project["stored_pdf_path"]).resolve()

    doc = fitz.open(book_path)
    page_texts = [_clean_text(page.get_text("text")) for page in doc]
    if not paths["full_text"].exists():
        extract_pdf_text(project_dir)

    toc = doc.get_toc() or []
    sections: List[Dict[str, Any]] = []

    if toc:
        for i, item in enumerate(toc):
            level, title, start_page_1 = item[:3]
            start_page = max(int(start_page_1) - 1, 0)
            next_start_page = len(page_texts)

            for later in toc[i + 1:]:
                later_level, _, later_start_page_1 = later[:3]
                if later_level <= level:
                    next_start_page = max(int(later_start_page_1) - 1, start_page + 1)
                    break

            section_text = _clean_text("\n\n".join(page_texts[start_page:next_start_page]))
            if len(section_text) < min_chars_per_section:
                continue

            file_name = f"section_{len(sections):03d}_{_safe_name(title)}.txt"
            text_path = paths["section_text"] / file_name
            text_path.write_text(section_text, encoding="utf-8")

            sections.append(
                {
                    "index": len(sections),
                    "title": title.strip() or f"Section {len(sections)}",
                    "level": level,
                    "start_page": start_page + 1,
                    "end_page": next_start_page,
                    "char_count": len(section_text),
                    "text_path": _rel(text_path, paths["root"]),
                    "has_environment_bundle": False,
                    "environment_bundle_path": None,
                }
            )
    else:
        for start_page in range(0, len(page_texts), fallback_pages_per_chunk):
            end_page = min(start_page + fallback_pages_per_chunk, len(page_texts))
            section_text = _clean_text("\n\n".join(page_texts[start_page:end_page]))
            if not section_text.strip():
                continue

            title = f"Pages {start_page + 1}-{end_page}"
            file_name = f"section_{len(sections):03d}_{_safe_name(title)}.txt"
            text_path = paths["section_text"] / file_name
            text_path.write_text(section_text, encoding="utf-8")

            sections.append(
                {
                    "index": len(sections),
                    "title": title,
                    "level": 1,
                    "start_page": start_page + 1,
                    "end_page": end_page,
                    "char_count": len(section_text),
                    "text_path": _rel(text_path, paths["root"]),
                    "has_environment_bundle": False,
                    "environment_bundle_path": None,
                }
            )

    if not sections:
        raise ValueError("No readable sections were extracted from the PDF.")

    _save_sections(project_dir, sections)
    _update_project_status(project_dir, sections_indexed=True)
    build_ui_manifest(project_dir)
    return sections


def list_sections(project_dir: Union[str, Path]) -> List[Dict[str, Any]]:
    return _load_sections(project_dir)


def get_section_text(project_dir: Union[str, Path], section_identifier: Union[int, str]) -> str:
    paths = _project_paths(project_dir)
    section = _find_section(project_dir, section_identifier)
    text_path = paths["root"] / section["text_path"]
    return text_path.read_text(encoding="utf-8")


def get_section(project_dir: Union[str, Path], section_identifier: Union[int, str]) -> Dict[str, Any]:
    return _find_section(project_dir, section_identifier)


def _load_prompt_template(project_dir: Union[str, Path], prompt_path: Optional[Union[str, Path]] = None) -> str:
    paths = _project_paths(project_dir)
    if prompt_path is None:
        target = paths["prompt_file"]
    else:
        target = Path(prompt_path)
        if not target.is_absolute():
            target = paths["root"] / target
    if target.exists():
        return target.read_text(encoding="utf-8").strip()
    return DEFAULT_ENVIRONMENT_PROMPT


def _render_prompt(template: str, section_text: str) -> str:
    if "{{SECTION_TEXT}}" not in template:
        return f"{template}\n\nSource text:\n{section_text}".strip()
    return template.replace("{{SECTION_TEXT}}", section_text)


def _call_gemini(prompt: str, api_key: Optional[str], model: str) -> List[str]:
    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise ImportError("google-genai is required. Install it with: pip install google-genai") from exc

    schema = {
        "type": "object",
        "properties": {
            "paragraphs": {
                "type": "array",
                "minItems": 3,
                "maxItems": 3,
                "items": {"type": "string"},
            }
        },
        "required": ["paragraphs"],
    }

    key = api_key or os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=key) if key else genai.Client()
    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.5,
            response_mime_type="application/json",
            response_json_schema=schema,
        ),
    )
    raw = response.text or ""
    payload = json.loads(raw)
    paragraphs = payload.get("paragraphs", [])
    paragraphs = [re.sub(r"\s+", " ", p).strip() for p in paragraphs]
    if len(paragraphs) != 3 or any(not p for p in paragraphs):
        raise ValueError(f"Expected exactly 3 non-empty paragraphs, got: {paragraphs}")
    return paragraphs


def summarize_section_environments(
    project_dir: Union[str, Path],
    section_identifier: Union[int, str],
    api_key: Optional[str] = None,
    model: str = DEFAULT_MODEL,
    prompt_path: Optional[Union[str, Path]] = None,
    overwrite: bool = False,
) -> Dict[str, Any]:
    paths = _project_paths(project_dir)
    section = _find_section(project_dir, section_identifier)

    if section.get("has_environment_bundle") and section.get("environment_bundle_path") and not overwrite:
        bundle_path = paths["root"] / section["environment_bundle_path"]
        if bundle_path.exists():
            return _read_json(bundle_path)

    section_text = get_section_text(project_dir, section["index"])
    prompt_template = _load_prompt_template(project_dir, prompt_path=prompt_path)
    prompt = _render_prompt(prompt_template, section_text)
    paragraphs = _call_gemini(prompt=prompt, api_key=api_key, model=model)

    generation_dir = paths["generations"] / f"section_{section['index']:03d}"
    generation_dir.mkdir(parents=True, exist_ok=True)

    paragraph_paths = []
    for idx, paragraph in enumerate(paragraphs, start=1):
        p_path = generation_dir / f"environment_{idx:02d}.txt"
        p_path.write_text(paragraph, encoding="utf-8")
        paragraph_paths.append(_rel(p_path, paths["root"]))

    bundle_path = generation_dir / "environment_bundle.json"
    bundle = {
        "project_name": load_project(project_dir)["project_name"],
        "section_index": section["index"],
        "section_title": section["title"],
        "section_pages": {
            "start_page": section["start_page"],
            "end_page": section["end_page"],
        },
        "source_text_path": section["text_path"],
        "prompt_path": _rel(paths["prompt_file"], paths["root"]) if prompt_path is None else str(prompt_path),
        "model": model,
        "created_at": _now_iso(),
        "paragraphs": paragraphs,
        "paragraph_paths": paragraph_paths,
        "world_output_dir": _rel(paths["world"] / f"section_{section['index']:03d}", paths["root"]),
        "audio_output_dir": _rel(paths["audio"] / f"section_{section['index']:03d}", paths["root"]),
    }
    _write_json(bundle_path, bundle)

    sections = _load_sections(project_dir)
    for idx, item in enumerate(sections):
        if item["index"] == section["index"]:
            sections[idx] = {
                **item,
                "has_environment_bundle": True,
                "environment_bundle_path": _rel(bundle_path, paths["root"]),
            }
            break
    _save_sections(project_dir, sections)

    build_ui_manifest(project_dir)
    return bundle


def summarize_book_environments(
    project_dir: Union[str, Path],
    api_key: Optional[str] = None,
    model: str = DEFAULT_MODEL,
    prompt_path: Optional[Union[str, Path]] = None,
    section_limit: Optional[int] = None,
    overwrite: bool = False,
) -> Dict[str, Any]:
    sections = _load_sections(project_dir)
    bundles = []
    target_sections = sections if section_limit is None else sections[:section_limit]

    for section in target_sections:
        bundle = summarize_section_environments(
            project_dir=project_dir,
            section_identifier=section["index"],
            api_key=api_key,
            model=model,
            prompt_path=prompt_path,
            overwrite=overwrite,
        )
        bundles.append(bundle)

    refreshed_sections = _load_sections(project_dir)
    section_lookup = {section["index"]: section for section in refreshed_sections}
    aggregate = {
        "project_name": load_project(project_dir)["project_name"],
        "section_count": len(bundles),
        "generated_at": _now_iso(),
        "sections": [
            {
                "section_index": bundle["section_index"],
                "section_title": bundle["section_title"],
                "environment_bundle_path": section_lookup[bundle["section_index"]]["environment_bundle_path"],
                "paragraphs": bundle["paragraphs"],
            }
            for bundle in bundles
        ],
    }
    _write_json(_project_paths(project_dir)["book_environments"], aggregate)

    all_sections = _load_sections(project_dir)
    all_summarized = all(section.get("has_environment_bundle") for section in all_sections)
    _update_project_status(project_dir, all_sections_summarized=all_summarized)
    build_ui_manifest(project_dir)
    return aggregate


def build_ui_manifest(project_dir: Union[str, Path]) -> Dict[str, Any]:
    paths = _project_paths(project_dir)
    project = load_project(project_dir)
    sections = _load_sections(project_dir) if paths["sections_manifest"].exists() else []

    ui_sections = []
    for section in sections:
        entry = {
            "index": section["index"],
            "title": section["title"],
            "level": section["level"],
            "start_page": section["start_page"],
            "end_page": section["end_page"],
            "char_count": section["char_count"],
            "text_path": section["text_path"],
            "has_environment_bundle": section["has_environment_bundle"],
            "environment_bundle_path": section["environment_bundle_path"],
            "environment_preview": [],
        }
        if section["has_environment_bundle"] and section["environment_bundle_path"]:
            bundle = _read_json(paths["root"] / section["environment_bundle_path"])
            entry["environment_preview"] = bundle["paragraphs"]
        ui_sections.append(entry)

    ui_manifest = {
        "project": {
            "project_name": project["project_name"],
            "project_dir": project["project_dir"],
            "stored_pdf_path": project["relative_stored_pdf_path"],
            "full_text_path": _rel(paths["full_text"], paths["root"]) if paths["full_text"].exists() else None,
            "prompt_path": project["prompt_path"],
            "status": project["status"],
            "counts": {
                "sections": len(ui_sections),
                "sections_with_environment_bundle": sum(1 for section in ui_sections if section["has_environment_bundle"]),
            },
        },
        "frontend_contract": {
            "primary_manifest": "manifests/ui_manifest.json",
            "section_manifest": "manifests/sections.json",
            "book_environment_manifest": "manifests/book_environments.json",
            "future_world_dir": DIR_WORLD,
            "future_audio_dir": DIR_AUDIO,
        },
        "sections": ui_sections,
    }
    _write_json(paths["ui_manifest"], ui_manifest)
    return ui_manifest


def process_book(
    pdf_path: Union[str, Path],
    workspace: Union[str, Path] = "story_projects",
    project_name: Optional[str] = None,
    api_key: Optional[str] = None,
    model: str = DEFAULT_MODEL,
    prompt_path: Optional[Union[str, Path]] = None,
    section_limit: Optional[int] = None,
    overwrite: bool = False,
) -> Dict[str, Any]:
    project = create_project(
        pdf_path=pdf_path,
        workspace=workspace,
        project_name=project_name,
        overwrite=overwrite,
    )
    project_dir = project["project_dir"]
    extract_pdf_text(project_dir)
    build_section_index(project_dir)
    summarize_book_environments(
        project_dir=project_dir,
        api_key=api_key,
        model=model,
        prompt_path=prompt_path,
        section_limit=section_limit,
        overwrite=overwrite,
    )
    return build_ui_manifest(project_dir)


def main() -> None:
    parser = argparse.ArgumentParser(description="UI-first PDF to environment paragraph pipeline.")
    subparsers = parser.add_subparsers(dest="command")

    process_parser = subparsers.add_parser("process")
    process_parser.add_argument("pdf_path")
    process_parser.add_argument("--workspace", default="story_projects")
    process_parser.add_argument("--project-name")
    process_parser.add_argument("--api-key")
    process_parser.add_argument("--model", default=DEFAULT_MODEL)
    process_parser.add_argument("--prompt-path")
    process_parser.add_argument("--section-limit", type=int)
    process_parser.add_argument("--overwrite", action="store_true")

    section_parser = subparsers.add_parser("summarize-section")
    section_parser.add_argument("project_dir")
    section_parser.add_argument("section")
    section_parser.add_argument("--api-key")
    section_parser.add_argument("--model", default=DEFAULT_MODEL)
    section_parser.add_argument("--prompt-path")
    section_parser.add_argument("--overwrite", action="store_true")

    manifest_parser = subparsers.add_parser("ui-manifest")
    manifest_parser.add_argument("project_dir")

    args = parser.parse_args()

    if args.command == "process":
        result = process_book(
            pdf_path=args.pdf_path,
            workspace=args.workspace,
            project_name=args.project_name,
            api_key=args.api_key,
            model=args.model,
            prompt_path=args.prompt_path,
            section_limit=args.section_limit,
            overwrite=args.overwrite,
        )
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return

    if args.command == "summarize-section":
        section_identifier: Union[int, str]
        section_identifier = int(args.section) if args.section.isdigit() else args.section
        result = summarize_section_environments(
            project_dir=args.project_dir,
            section_identifier=section_identifier,
            api_key=args.api_key,
            model=args.model,
            prompt_path=args.prompt_path,
            overwrite=args.overwrite,
        )
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return

    if args.command == "ui-manifest":
        result = build_ui_manifest(args.project_dir)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return

    parser.print_help()


if __name__ == "__main__":
    main()
