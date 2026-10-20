import hashlib
import json
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import or_, select, update
from sqlalchemy.exc import IntegrityError

from app.integration.auth import OWNER
from app.projects.scopes import available_documents, owned_session
from app.storage import Document, Message, Session, Turn, identifier, now


def message_dict(message):
    return {
        "id": message.id,
        "role": message.role,
        "content": message.content,
        "status": message.status,
        "sources": message.sources,
        "created_at": message.created_at.isoformat(),
    }


def begin(factory, settings, session_id, payload):
    requested_ids = (
        sorted(set(map(str, payload.document_ids))) if payload.document_ids is not None else None
    )
    request_id = str(payload.request_id)
    fingerprint = hashlib.sha256(json.dumps([payload.content, requested_ids]).encode()).hexdigest()
    with factory() as db:
        session = owned_session(db, session_id)
        if session.archived:
            raise HTTPException(409, "Hãy khôi phục hội thoại trước khi gửi câu hỏi.")
        previous = db.scalar(
            select(Turn).where(Turn.session_id == session_id, Turn.request_id == request_id)
        )
        if previous:
            if previous.fingerprint != fingerprint:
                raise HTTPException(409, "request_id đã dùng cho nội dung khác.")
            if previous.status == "completed":
                return {"replay": message_dict(db.get(Message, previous.message_id))}
            raise HTTPException(409, "Lượt này đang chạy hoặc đã gián đoạn; hãy gửi lượt mới.")
        query = available_documents(db, OWNER, session_id)
        if requested_ids is None:
            query = (
                query.where(Document.status == "ready")
                .order_by(Document.created_at.desc(), Document.id)
                .limit(20)
            )
        else:
            query = query.where(Document.id.in_(requested_ids))
        documents = {doc.id: doc for doc in db.scalars(query)}
        document_ids = requested_ids if requested_ids is not None else list(documents)
        for doc_id in document_ids:
            doc = documents.get(doc_id)
            if not doc:
                raise HTTPException(404, "Tài liệu không thuộc hội thoại hoặc Project này.")
            if doc.status != "ready":
                raise HTTPException(409, "Tài liệu chưa sẵn sàng.")
        if not settings.model_configured:
            raise HTTPException(
                503, "Chưa cấu hình model. Thiết lập LLM_BASE_URL và LLM_MODEL trên backend."
            )
        old_request = session.active_request
        result = db.execute(
            update(Session)
            .execution_options(synchronize_session="fetch")
            .where(
                Session.id == session_id,
                Session.project_id == session.project_id,
                Session.archived.is_(False),
                or_(Session.active_request.is_(None), Session.active_until < now()),
            )
            .values(
                active_request=request_id,
                updated_at=now(),
                active_until=now() + timedelta(seconds=settings.llm_timeout_seconds + 30),
            )
        )
        if not result.rowcount:
            raise HTTPException(
                409, "Hội thoại đang tạo câu trả lời hoặc ngữ cảnh đã thay đổi. Hãy làm mới."
            )
        if old_request:
            old = db.scalar(
                select(Turn).where(Turn.session_id == session_id, Turn.request_id == old_request)
            )
            if old and old.status == "running":
                old.status = "failed"
                db.get(Message, old.message_id).status = "failed"
        rows = list(
            db.scalars(
                select(Message)
                .where(Message.session_id == session_id, Message.status == "completed")
                .order_by(Message.created_at.desc())
                .limit(20)
            )
        )
        history = []
        size = 0
        for msg in rows:
            size += len(msg.content)
            if size > settings.max_context_chars:
                break
            history.insert(0, {"role": msg.role, "content": msg.content})
        user = Message(id=identifier(), session_id=session_id, role="user", content=payload.content)
        assistant = Message(
            id=identifier(), session_id=session_id, role="assistant", status="streaming"
        )
        db.add_all([user, assistant])
        db.flush()
        db.add(
            Turn(
                session_id=session_id,
                request_id=request_id,
                fingerprint=fingerprint,
                message_id=assistant.id,
            )
        )
        if not rows:
            session.title = payload.content[:80]
        try:
            db.commit()
        except IntegrityError as error:
            db.rollback()
            raise HTTPException(409, "Lượt này đã được gửi.") from error
        return {"message_id": assistant.id, "history": history, "document_ids": document_ids}


def finish(factory, session_id, request_id, message_id, answer, sources, status):
    with factory() as db:
        result = db.execute(
            update(Session)
            .execution_options(synchronize_session="fetch")
            .where(
                Session.id == session_id,
                Session.active_request == request_id,
                Session.active_until > now(),
            )
            .values(active_request=None, active_until=None)
        )
        if not result.rowcount:
            db.rollback()
            return False
        msg = db.get(Message, message_id)
        msg.content, msg.sources, msg.status = answer, sources, status
        turn = db.scalar(
            select(Turn).where(Turn.session_id == session_id, Turn.request_id == request_id)
        )
        turn.status = status
        db.commit()
        return True
