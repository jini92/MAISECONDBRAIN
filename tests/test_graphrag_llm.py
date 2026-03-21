from __future__ import annotations

import sys
import types
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from mnemo.graphrag import ollama_llm_fn


def _install_fake_ollama(monkeypatch, response_text: str, calls: dict) -> None:
    class FakeClient:
        def __init__(self, host=None, **kwargs):
            calls["init"] = {"host": host, "kwargs": kwargs}

        def chat(self, **kwargs):
            calls["chat"] = kwargs
            return {"message": {"content": response_text}}

    monkeypatch.setitem(sys.modules, "ollama", types.SimpleNamespace(Client=FakeClient))


def test_ollama_llm_fn_uses_responsive_defaults(monkeypatch) -> None:
    calls: dict = {}
    _install_fake_ollama(monkeypatch, "OK", calls)

    monkeypatch.delenv("OLLAMA_HOST", raising=False)
    monkeypatch.delenv("MNEMO_LLM_TIMEOUT", raising=False)
    monkeypatch.delenv("MNEMO_LLM_KEEP_ALIVE", raising=False)
    monkeypatch.delenv("MNEMO_LLM_NUM_PREDICT", raising=False)
    monkeypatch.delenv("MNEMO_LLM_MODEL", raising=False)

    assert ollama_llm_fn("Prompt") == "OK"
    assert calls["init"] == {"host": None, "kwargs": {"timeout": 180.0}}
    assert calls["chat"]["model"] == "llama3.1:8b"
    assert calls["chat"]["options"] == {"temperature": 0.3, "num_predict": 16}
    assert calls["chat"]["keep_alive"] == "30m"


def test_ollama_llm_fn_respects_env_overrides_and_strips_think_tags(monkeypatch) -> None:
    calls: dict = {}
    _install_fake_ollama(monkeypatch, "<think>hidden</think>  Final answer  ", calls)

    monkeypatch.setenv("OLLAMA_HOST", "http://127.0.0.1:11434")
    monkeypatch.setenv("MNEMO_LLM_TIMEOUT", "45")
    monkeypatch.setenv("MNEMO_LLM_KEEP_ALIVE", "10m")
    monkeypatch.setenv("MNEMO_LLM_NUM_PREDICT", "8")
    monkeypatch.setenv("MNEMO_LLM_MODEL", "qwen3:8b")

    assert ollama_llm_fn("Prompt") == "Final answer"
    assert calls["init"] == {
        "host": "http://127.0.0.1:11434",
        "kwargs": {"timeout": 45.0},
    }
    assert calls["chat"]["model"] == "qwen3:8b"
    assert calls["chat"]["options"] == {"temperature": 0.3, "num_predict": 8}
    assert calls["chat"]["keep_alive"] == "10m"
