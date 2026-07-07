from __future__ import annotations

import re

from app.config import Settings, get_settings
from app.services.answerer import LLMClient
from app.services.llm_openai import OpenAICompatibleLLM

CITATION_LINE = re.compile(r"^(\[[^\]]+\])\s+(.*)$", re.MULTILINE)


class DevStubLLM:
    """Development stub that cites the first retrieved context block."""

    def complete(self, *, system: str, user: str) -> str:
        del system
        context_marker = "Mevzuat bağlamı:\n"
        context = user.split(context_marker, maxsplit=1)[-1] if context_marker in user else user

        for line in context.splitlines():
            line = line.strip()
            if not line:
                continue
            match = CITATION_LINE.match(line)
            if match:
                citation, metin = match.groups()
                sentence = metin.strip().rstrip(".")
                if sentence:
                    return f"{sentence} {citation}."
                return f"Mevzuat hükmü geçerlidir {citation}."

        return "Mevzuatta açık hüküm bulamadım."


def build_llm_client(settings: Settings | None = None) -> LLMClient:
    cfg = settings or get_settings()
    if cfg.llm_provider == "openai":
        return OpenAICompatibleLLM(
            base_url=cfg.llm_base_url,
            model=cfg.llm_model,
            api_key=cfg.llm_api_key,
            timeout=cfg.llm_timeout_seconds,
        )
    return DevStubLLM()
