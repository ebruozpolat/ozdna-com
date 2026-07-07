from __future__ import annotations

from openai import OpenAI

from app.services.answerer import LLMClient


class OpenAICompatibleLLM:
    """OpenAI-compatible chat API client (Ollama, vLLM, Azure OpenAI, etc.)."""

    def __init__(
        self,
        *,
        base_url: str,
        model: str,
        api_key: str = "",
        timeout: float = 120.0,
    ) -> None:
        self.model = model
        self._client = OpenAI(
            base_url=base_url.rstrip("/"),
            api_key=api_key or "not-needed",
            timeout=timeout,
        )

    def complete(self, *, system: str, user: str) -> str:
        response = self._client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.1,
        )

        content = response.choices[0].message.content
        if not isinstance(content, str) or not content.strip():
            msg = "LLM returned empty content"
            raise RuntimeError(msg)
        return content.strip()
