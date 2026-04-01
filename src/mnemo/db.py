"""PostgreSQL + pgvector knowledge graph storage.

Replaces in-memory NetworkX graph with persistent database storage.
Supports real-time CRUD and vector similarity search.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

_conn = None
_has_pgvector = False


def get_conn():
    """Get or create PostgreSQL connection."""
    global _conn, _has_pgvector
    if _conn is not None:
        try:
            _conn.cursor().execute("SELECT 1")
            return _conn
        except Exception:
            _conn = None

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set")

    import psycopg2
    import psycopg2.extras
    _conn = psycopg2.connect(db_url, connect_timeout=10)
    _conn.autocommit = True

    # Try to enable pgvector
    try:
        cur = _conn.cursor()
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector")
        cur.close()
        _has_pgvector = True
        logger.info("pgvector extension enabled")
    except Exception as e:
        logger.warning("pgvector not available, falling back to text search: %s", e)
        _has_pgvector = False

    _init_tables()
    return _conn


def _init_tables():
    """Create knowledge graph tables."""
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS knowledge_nodes (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        entity_type TEXT DEFAULT 'note',
        content TEXT,
        metadata JSONB DEFAULT '{}',
        source TEXT DEFAULT 'vault',
        source_path TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_kn_name ON knowledge_nodes(name);
    CREATE INDEX IF NOT EXISTS idx_kn_type ON knowledge_nodes(entity_type);
    CREATE INDEX IF NOT EXISTS idx_kn_source ON knowledge_nodes(source);
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS knowledge_edges (
        id SERIAL PRIMARY KEY,
        source_name TEXT NOT NULL,
        target_name TEXT NOT NULL,
        relation TEXT DEFAULT 'related',
        weight DOUBLE PRECISION DEFAULT 1.0,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(source_name, target_name, relation)
    );
    CREATE INDEX IF NOT EXISTS idx_ke_source ON knowledge_edges(source_name);
    CREATE INDEX IF NOT EXISTS idx_ke_target ON knowledge_edges(target_name);
    """)

    if _has_pgvector:
        try:
            cur.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_embeddings (
                id SERIAL PRIMARY KEY,
                node_name TEXT UNIQUE NOT NULL REFERENCES knowledge_nodes(name) ON DELETE CASCADE,
                embedding vector(1024),
                model TEXT DEFAULT 'qwen3-embedding:0.6b',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_kemb_name ON knowledge_embeddings(node_name);
            """)
        except Exception as e:
            logger.warning("Could not create embeddings table: %s", e)
    else:
        cur.execute("""
        CREATE TABLE IF NOT EXISTS knowledge_embeddings (
            id SERIAL PRIMARY KEY,
            node_name TEXT UNIQUE NOT NULL,
            embedding_json TEXT,
            model TEXT DEFAULT 'qwen3-embedding:0.6b',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        """)

    cur.close()
    logger.info("Knowledge graph tables initialized")


# ---------------------------------------------------------------------------
# Node CRUD
# ---------------------------------------------------------------------------

def upsert_node(
    name: str,
    entity_type: str = "note",
    content: str | None = None,
    metadata: dict | None = None,
    source: str = "vault",
    source_path: str | None = None,
) -> dict:
    """Insert or update a knowledge node."""
    conn = get_conn()
    cur = conn.cursor()
    meta_json = json.dumps(metadata or {})
    cur.execute("""
        INSERT INTO knowledge_nodes (name, entity_type, content, metadata, source, source_path)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (name) DO UPDATE SET
            entity_type = EXCLUDED.entity_type,
            content = EXCLUDED.content,
            metadata = EXCLUDED.metadata,
            source = EXCLUDED.source,
            source_path = EXCLUDED.source_path,
            updated_at = NOW()
        RETURNING id, name, entity_type, source
    """, (name, entity_type, content, meta_json, source, source_path))
    row = cur.fetchone()
    cur.close()
    return {"id": row[0], "name": row[1], "entity_type": row[2], "source": row[3]}


def get_node(name: str) -> dict | None:
    """Get a node by name."""
    conn = get_conn()
    import psycopg2.extras
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM knowledge_nodes WHERE name = %s", (name,))
    row = cur.fetchone()
    cur.close()
    return dict(row) if row else None


def delete_node(name: str) -> bool:
    """Delete a node and its edges."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM knowledge_edges WHERE source_name = %s OR target_name = %s", (name, name))
    cur.execute("DELETE FROM knowledge_nodes WHERE name = %s", (name,))
    cur.close()
    return True


# ---------------------------------------------------------------------------
# Edge CRUD
# ---------------------------------------------------------------------------

def upsert_edge(source_name: str, target_name: str, relation: str = "related", weight: float = 1.0) -> dict:
    """Insert or update an edge."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO knowledge_edges (source_name, target_name, relation, weight)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (source_name, target_name, relation) DO UPDATE SET
            weight = EXCLUDED.weight
        RETURNING id, source_name, target_name, relation
    """, (source_name, target_name, relation, weight))
    row = cur.fetchone()
    cur.close()
    return {"id": row[0], "source": row[1], "target": row[2], "relation": row[3]}


def get_neighbors(name: str, limit: int = 20) -> list[dict]:
    """Get neighbors of a node."""
    conn = get_conn()
    import psycopg2.extras
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT e.target_name as name, e.relation, e.weight, n.entity_type, n.source
        FROM knowledge_edges e
        LEFT JOIN knowledge_nodes n ON n.name = e.target_name
        WHERE e.source_name = %s
        UNION
        SELECT e.source_name as name, e.relation, e.weight, n.entity_type, n.source
        FROM knowledge_edges e
        LEFT JOIN knowledge_nodes n ON n.name = e.source_name
        WHERE e.target_name = %s
        ORDER BY weight DESC
        LIMIT %s
    """, (name, name, limit))
    rows = cur.fetchall()
    cur.close()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Embedding CRUD
# ---------------------------------------------------------------------------

def upsert_embedding(node_name: str, embedding: list[float], model: str = "qwen3-embedding:0.6b"):
    """Store embedding for a node."""
    conn = get_conn()
    cur = conn.cursor()
    if _has_pgvector:
        cur.execute("""
            INSERT INTO knowledge_embeddings (node_name, embedding, model)
            VALUES (%s, %s::vector, %s)
            ON CONFLICT (node_name) DO UPDATE SET
                embedding = EXCLUDED.embedding,
                model = EXCLUDED.model,
                created_at = NOW()
        """, (node_name, str(embedding), model))
    else:
        cur.execute("""
            INSERT INTO knowledge_embeddings (node_name, embedding_json, model)
            VALUES (%s, %s, %s)
            ON CONFLICT (node_name) DO UPDATE SET
                embedding_json = EXCLUDED.embedding_json,
                model = EXCLUDED.model,
                created_at = NOW()
        """, (node_name, json.dumps(embedding), model))
    cur.close()


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

def search_keyword(query: str, limit: int = 10) -> list[dict]:
    """Keyword search across nodes."""
    conn = get_conn()
    import psycopg2.extras
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    pattern = f"%{query}%"
    cur.execute("""
        SELECT name, entity_type, source, source_path,
               LEFT(content, 200) as snippet
        FROM knowledge_nodes
        WHERE name ILIKE %s OR content ILIKE %s
        ORDER BY
            CASE WHEN name ILIKE %s THEN 0 ELSE 1 END,
            updated_at DESC
        LIMIT %s
    """, (pattern, pattern, pattern, limit))
    rows = cur.fetchall()
    cur.close()
    return [dict(r) for r in rows]


def search_vector(query_embedding: list[float], limit: int = 10) -> list[dict]:
    """Vector similarity search using pgvector."""
    if not _has_pgvector:
        return []
    conn = get_conn()
    import psycopg2.extras
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT e.node_name as name, n.entity_type, n.source, n.source_path,
               LEFT(n.content, 200) as snippet,
               1 - (e.embedding <=> %s::vector) as score
        FROM knowledge_embeddings e
        JOIN knowledge_nodes n ON n.name = e.node_name
        ORDER BY e.embedding <=> %s::vector
        LIMIT %s
    """, (str(query_embedding), str(query_embedding), limit))
    rows = cur.fetchall()
    cur.close()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

def get_stats() -> dict:
    """Get graph statistics."""
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM knowledge_nodes")
    node_count = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM knowledge_edges")
    edge_count = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM knowledge_embeddings")
    embedding_count = cur.fetchone()[0]

    cur.execute("SELECT entity_type, COUNT(*) FROM knowledge_nodes GROUP BY entity_type ORDER BY COUNT(*) DESC LIMIT 10")
    type_dist = {r[0]: r[1] for r in cur.fetchall()}

    cur.execute("SELECT source, COUNT(*) FROM knowledge_nodes GROUP BY source ORDER BY COUNT(*) DESC")
    source_dist = {r[0]: r[1] for r in cur.fetchall()}

    cur.close()
    return {
        "node_count": node_count,
        "edge_count": edge_count,
        "embedding_count": embedding_count,
        "type_distribution": type_dist,
        "source_distribution": source_dist,
        "has_pgvector": _has_pgvector,
    }


# ---------------------------------------------------------------------------
# Bulk import (for migration from NetworkX)
# ---------------------------------------------------------------------------

def bulk_import_graph(graph_data: dict) -> dict:
    """Import nodes and edges from a NetworkX-style graph dict.

    Args:
        graph_data: {"nodes": [{name, type, ...}], "edges": [{source, target, ...}]}

    Returns:
        {"nodes_imported": int, "edges_imported": int}
    """
    conn = get_conn()
    cur = conn.cursor()

    nodes = graph_data.get("nodes", [])
    edges = graph_data.get("edges", [])

    n_imported = 0
    for node in nodes:
        try:
            name = node.get("name") or node.get("id", "")
            if not name:
                continue
            cur.execute("""
                INSERT INTO knowledge_nodes (name, entity_type, content, metadata, source, source_path)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (name) DO NOTHING
            """, (
                name,
                node.get("entity_type", node.get("type", "note")),
                node.get("content", ""),
                json.dumps(node.get("metadata", {})),
                node.get("source", "vault"),
                node.get("source_path", node.get("path", "")),
            ))
            n_imported += 1
        except Exception as e:
            logger.warning("Failed to import node %s: %s", node.get("name"), e)

    e_imported = 0
    for edge in edges:
        try:
            cur.execute("""
                INSERT INTO knowledge_edges (source_name, target_name, relation, weight)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (source_name, target_name, relation) DO NOTHING
            """, (
                edge.get("source", ""),
                edge.get("target", ""),
                edge.get("relation", "related"),
                edge.get("weight", 1.0),
            ))
            e_imported += 1
        except Exception as e:
            logger.warning("Failed to import edge: %s", e)

    cur.close()
    return {"nodes_imported": n_imported, "edges_imported": e_imported}
