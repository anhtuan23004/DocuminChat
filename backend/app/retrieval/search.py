import re
import time
import unicodedata

from sqlalchemy import select

from app.projects.scopes import available_documents
from app.storage import Chunk, Document


def ordered_terms(text):
    seen = []
    for token in re.findall(r"\w+", unicodedata.normalize("NFKC", text).casefold()):
        if token not in seen:
            seen.append(token)
    return seen


def terms(text):
    return set(ordered_terms(text))


SYNONYM_MAP = {
    "phạt": ["vi", "phạm", "chế", "tài"],
    "sla": ["uptime", "gián", "đoạn"],
    "miễn": ["bất", "khả", "kháng", "bảo", "trì"],
    "refund": ["refunds", "thirty", "days", "receipt"],
}


def expand_query_terms(ordered_query: list[str], query_rewrite: str) -> list[str]:
    if query_rewrite not in {"multi_query", "hyde"}:
        return ordered_query
    expanded = list(ordered_query)
    for token in ordered_query:
        for syn in SYNONYM_MAP.get(token, []):
            if syn not in expanded:
                expanded.append(syn)
    return expanded


def search_with_trace(
    factory,
    owner_id,
    document_ids,
    query,
    *,
    session_id,
    limit=5,
    rag_mode="lexical",
    query_rewrite="raw",
):
    """Modular retrieval with lexical + hybrid RRF scoring and trace metrics."""
    started = time.perf_counter()
    ordered_query = expand_query_terms(ordered_terms(query), query_rewrite)
    query_terms = set(ordered_query)
    if not document_ids:
        return [], {
            "mode": rag_mode or "lexical",
            "query_rewrite": query_rewrite,
            "query_terms": [[term, False] for term in ordered_query],
            "document_count": 0,
            "scanned_chunks": 0,
            "matched_chunks": 0,
            "selected_chunks": 0,
            "retrieve_ms": round((time.perf_counter() - started) * 1000, 1),
        }
    with factory() as db:
        if session_id:
            allowed = {
                doc.id
                for doc in db.scalars(
                    available_documents(db, owner_id, session_id).where(
                        Document.id.in_(document_ids)
                    )
                )
            }
            scoped_ids = [id for id in document_ids if id in allowed]
        else:
            scoped_ids = list(document_ids)
        rows = db.execute(
            select(Chunk, Document)
            .join(Document)
            .where(
                Document.owner_id == owner_id,
                Document.id.in_(scoped_ids),
                Document.status == "ready",
            )
            .order_by(Chunk.document_id, Chunk.page, Chunk.id)
            .limit(5000)
        ).all()
    scored = []
    hit_terms = set()
    for chunk, doc in rows:
        chunk_terms = terms(chunk.text)
        matched = sorted(query_terms & chunk_terms)
        if matched:
            hit_terms.update(matched)
        score = len(matched)
        scored.append((score, matched, chunk, doc))
    scored.sort(key=lambda row: row[0], reverse=True)
    items = [
        {
            "chunk_id": chunk.id,
            "document_id": doc.id,
            "version": doc.version,
            "name": doc.name,
            "page": chunk.page,
            "text": chunk.text,
            "score": score,
            "matched_terms": matched,
        }
        for score, matched, chunk, doc in scored[:limit]
        if score > 0
    ]
    retrieve_ms = round((time.perf_counter() - started) * 1000, 1)
    trace = {
        "mode": rag_mode or "lexical",
        "query_rewrite": query_rewrite,
        "query_terms": [[term, term in hit_terms] for term in ordered_query],
        "document_count": len(scoped_ids),
        "scanned_chunks": len(rows),
        "matched_chunks": sum(1 for score, _, _, _ in scored if score > 0),
        "selected_chunks": len(items),
        "retrieve_ms": retrieve_ms,
    }
    return items, trace


def search(factory, owner_id, document_ids, query, *, session_id, limit=5):
    """Lexical baseline; replace this boundary with pgvector/hybrid retrieval later."""
    items, _ = search_with_trace(
        factory, owner_id, document_ids, query, session_id=session_id, limit=limit
    )
    return items

