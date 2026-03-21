from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    openai_api_key: str = ""
    cartesia_api_key: str = ""
    world_model_backend: str = "worldgen"

    # Book scene LoRA (set to path of trained safetensors to enable)
    book_lora_path: str = ""
    book_lora_weight: float = 0.7

    # Frontend origin for CORS
    frontend_url: str = "http://localhost:3000"

    # Static files directory for generated scenes
    static_dir: str = "static"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
