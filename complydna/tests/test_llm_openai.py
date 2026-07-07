from __future__ import annotations

import pytest

from app.config import Settings
from app.services.llm_openai import OpenAICompatibleLLM
from app.services.llm_stub import DevStubLLM, build_llm_client


def test_build_llm_client_returns_stub_by_default() -> None:
    client = build_llm_client(Settings(llm_provider="stub"))
    assert isinstance(client, DevStubLLM)


def test_build_llm_client_returns_openai_compatible() -> None:
    client = build_llm_client(
        Settings(
            llm_provider="openai",
            llm_base_url="http://localhost:11434/v1",
            llm_model="llama3.2",
        )
    )
    assert isinstance(client, OpenAICompatibleLLM)


def test_openai_compatible_llm_parses_chat_response(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    class FakeCompletions:
        def create(self, **kwargs):
            captured["kwargs"] = kwargs
            message = type("Message", (), {"content": "Yükümlülük vardır [LAW-5549 / Madde 4 f.1]."})()
            choice = type("Choice", (), {"message": message})()
            return type("Response", (), {"choices": [choice]})()

    class FakeChat:
        completions = FakeCompletions()

    class FakeClient:
        chat = FakeChat()

    def fake_openai(**kwargs):
        captured["client_kwargs"] = kwargs
        return FakeClient()

    monkeypatch.setattr("app.services.llm_openai.OpenAI", fake_openai)

    llm = OpenAICompatibleLLM(
        base_url="http://ollama.local/v1",
        model="llama3.2",
        api_key="secret",
    )
    answer = llm.complete(system="sys", user="user")

    assert "LAW-5549" in answer
    client_kwargs = captured["client_kwargs"]
    assert client_kwargs["base_url"] == "http://ollama.local/v1"
    assert client_kwargs["api_key"] == "secret"
    kwargs = captured["kwargs"]
    assert kwargs["model"] == "llama3.2"
    assert kwargs["messages"][0]["role"] == "system"
