"""임베딩 생성기 — OpenAI / Ollama 지원"""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from .parser import NoteDocument

EMBEDDING_DIM = {
    "text-embedding-3-small": 1536,
    "text-embedding-3-large": 3072,
    "nomic-embed-text": 768,
}


def _prepare_text(note: NoteDocument, max_chars: int = 2000) -> str:
    """노트 텍스트를 임베딩용으로 준비"""
    parts = []
    # 제목
    parts.append(f"# {note.name}")
    # 경로 (프로젝트 컨텍스트)
    if note.path:
        # 폴더명에서 프로젝트 정보 추출
        path_str = str(note.path)
        for segment in ["MAIOSS", "MAIBEAUTY", "MAIAX", "MAIBOT", "MAISTAR7", "MAICON",
                        "MAITUTOR", "MAIBOTALKS", "MAITOK", "MAISECONDBRAIN"]:
            if segment in path_str:
                parts.append(f"Project: {segment}")
                break
    # 태그
    if note.tags:
        parts.append(f"Tags: {', '.join(note.tags)}")
    # 엔티티 타입
    entity_type = note.frontmatter.get("type", note.frontmatter.get("_inferred_type", ""))
    if entity_type:
        parts.append(f"Type: {entity_type}")
    # 본문
    parts.append(note.body.strip())

    text = "\n".join(parts)
    return text[:max_chars]


def embed_openai(
    texts: dict[str, str],
    model: str = "text-embedding-3-small",
    api_key: str | None = None,
    batch_size: int = 100,
) -> dict[str, np.ndarray]:
    """OpenAI API로 임베딩 생성"""
    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    embeddings = {}
    names = list(texts.keys())

    for i in range(0, len(names), batch_size):
        batch_names = names[i:i + batch_size]
        batch_texts = [texts[n] for n in batch_names]

        response = client.embeddings.create(
            input=batch_texts,
            model=model,
        )

        for j, item in enumerate(response.data):
            embeddings[batch_names[j]] = np.array(item.embedding, dtype=np.float32)

    return embeddings


def embed_ollama(
    texts: dict[str, str],
    model: str = "nomic-embed-text",
    base_url: str = "http://localhost:11434",
) -> dict[str, np.ndarray]:
    """Ollama 로컬 모델로 임베딩 생성"""
    import ollama as _ollama

    client = _ollama.Client(host=base_url)
    embeddings = {}

    for name, text in texts.items():
        response = client.embed(model=model, input=text)
        embeddings[name] = np.array(response["embeddings"][0], dtype=np.float32)

    return embeddings


def embed_notes(
    notes: list[NoteDocument],
    provider: str = "openai",
    model: str | None = None,
    api_key: str | None = None,
    existing: dict[str, np.ndarray] | None = None,
    changed_keys: set[str] | None = None,
) -> dict[str, np.ndarray]:
    """노트 리스트를 임베딩. 변경된 것만 재생성 (증분).

    Args:
        notes: 파싱된 노트 리스트
        provider: "openai" or "ollama"
        model: 모델명 (None이면 provider 기본값)
        api_key: OpenAI API 키
        existing: 기존 임베딩 캐시
        changed_keys: 변경된 노트 키 (None이면 전체)

    Returns:
        {노트key: 벡터} 딕셔너리
    """
    if existing is None:
        existing = {}

    # 변경분만 임베딩
    if changed_keys is not None:
        to_embed = [n for n in notes if n.key in changed_keys]
    else:
        to_embed = [n for n in notes if n.key not in existing]

    if not to_embed:
        return existing

    # 텍스트 준비 (최소 50자 이상만 임베딩)
    texts = {}
    for n in to_embed:
        t = _prepare_text(n)
        if len(t.strip()) >= 10:
            texts[n.key] = t

    # 임베딩 생성
    if provider == "openai":
        new_embeddings = embed_openai(texts, model=model or "text-embedding-3-small", api_key=api_key)
    elif provider == "ollama":
        new_embeddings = embed_ollama(texts, model=model or "nomic-embed-text")
    else:
        raise ValueError(f"Unknown provider: {provider}")

    # 기존 + 신규 병합
    result = {**existing, **new_embeddings}

    # 삭제된 노트 제거
    note_keys = {n.key for n in notes}
    result = {k: v for k, v in result.items() if k in note_keys}

    return result


class EmbeddingCache:
    """임베딩 캐시 관리 (.mnemo/embeddings/)"""

    def __init__(self, cache_dir: str | Path = ".mnemo"):
        self.dir = Path(cache_dir) / "embeddings"
        self.dir.mkdir(parents=True, exist_ok=True)
        self.index_path = self.dir / "index.json"

    def save(self, embeddings: dict[str, np.ndarray]) -> None:
        """임베딩 저장 (단일 .npz 파일)"""
        if not embeddings:
            return
        np.savez_compressed(
            self.dir / "vectors.npz",
            **{k: v for k, v in embeddings.items()},
        )
        # 인덱스 저장
        index = {"count": len(embeddings), "names": list(embeddings.keys())}
        self.index_path.write_text(json.dumps(index, ensure_ascii=False), encoding="utf-8")

    def load(self) -> dict[str, np.ndarray]:
        """임베딩 로드"""
        npz_path = self.dir / "vectors.npz"
        if not npz_path.exists():
            return {}
        data = np.load(npz_path, allow_pickle=False)
        return {k: data[k] for k in data.files}
