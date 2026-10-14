import re
import unicodedata

from sqlalchemy import select

from app.projects.scopes import available_documents
from app.storage import Chunk, Document


def terms(text):
    return set(re.findall(r"\w+", unicodedata.normalize("NFKC", text).casefold()))


def search(factory, owner_id, document_ids, query, *, session_id, limit=5):
    """Lexical baseline; replace this boundary with pgvector/hybrid retrieval later."""
    if not document_ids:
        return []
    query_terms = terms(query)
    with factory() as db:
        allowed = {
            doc.id
            for doc in db.scalars(
                available_documents(db, owner_id, session_id).where(Document.id.in_(document_ids))
            )
        }
        document_ids = [id for id in document_ids if id in allowed]
        rows = db.execute(
            select(Chunk, Document)
            .join(Document)
            .where(
                Document.owner_id == owner_id,
                Document.id.in_(document_ids),
                Document.status == "ready",
            )
            .order_by(Chunk.document_id, Chunk.page, Chunk.id)
            .limit(5000)
        ).all()
    scored = [(len(query_terms & terms(chunk.text)), chunk, doc) for chunk, doc in rows]
    scored.sort(key=lambda row: row[0], reverse=True)
    return [
        {
            "chunk_id": chunk.id,
            "document_id": doc.id,
            "version": doc.version,
            "name": doc.name,
            "page": chunk.page,
            "text": chunk.text,
        }
        for score, chunk, doc in scored[:limit]
        if score > 0
    ]
