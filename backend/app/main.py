import asyncio
import json
import logging
from contextlib import asynccontextmanager
from uuid import UUID

import httpx
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import or_, select, text, update

from app.config import Settings
from app.generation.provider import ProviderError
from app.integration.auth import OWNER
from app.integration.catalog import catalog_router
from app.integration.schemas import ChatRequest, NewSession, SandboxRequest, SessionUpdate
from app.integration.turns import begin, finish, message_dict
from app.projects.scopes import owned_project, owned_session
from app.rag.graph import build_graph
from app.rag.pipeline import PRESETS, run_sandbox_eval
from app.storage import Chunk, Document, Job, Message, Session, database, now

log = logging.getLogger(__name__)


def event(kind, data):
    return f"event: {kind}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def create_app(settings=None, factory=None):
    settings = settings or Settings()
    engine = None
    if factory is None:
        engine, factory = database(settings)

    @asynccontextmanager
    async def lifespan(app):
        settings.validate()
        yield
        if engine:
            engine.dispose()

    app = FastAPI(title="DocuminChat API", version="0.1.0", lifespan=lifespan)
    app.state.provider_transport = None

    @app.middleware("http")
    async def local_origin(request: Request, call_next):
        # The local identity is a single-user development adapter, bound to loopback in Compose.
        origin = request.headers.get("origin")
        if (
            request.method not in {"GET", "HEAD", "OPTIONS"}
            and origin
            and origin
            not in {
                "http://localhost:3030",
                "http://127.0.0.1:3030",
                "http://localhost:8000",
                "http://127.0.0.1:8000",
            }
        ):
            return JSONResponse({"detail": "Origin không được phép."}, status_code=403)
        return await call_next(request)

    @app.get("/api/v1/health")
    def health():
        with factory() as db:
            db.execute(text("SELECT 1"))
        return {
            "status": "ok",
            "auth": "local-development",
            "model_configured": settings.model_configured,
            "model_name": settings.llm_model or None,
            "retrieval": "lexical",
            "ocr": False,
        }

    @app.get("/api/v1/sessions")
    def sessions(
        offset: int = Query(0, ge=0),
        limit: int = Query(50, ge=1, le=100),
        archived: bool = False,
        project_id: UUID | None = None,
        unassigned: bool = False,
        q: str = Query("", max_length=200),
        include_archived: bool = False,
    ):
        if project_id and unassigned:
            raise HTTPException(422, "Chọn project_id hoặc unassigned.")
        with factory() as db:
            query = select(Session)
            if project_id:
                owned_project(db, str(project_id), OWNER)
                query = query.where(Session.project_id == str(project_id))
            elif unassigned:
                query = query.where(Session.project_id.is_(None))
            query = query.where(Session.owner_id == OWNER)
            if not include_archived:
                query = query.where(Session.archived == archived)
            if q.strip():
                query = query.where(
                    or_(
                        Session.title.icontains(q.strip(), autoescape=True),
                        select(Message.id)
                        .where(
                            Message.session_id == Session.id,
                            Message.content.icontains(q.strip(), autoescape=True),
                        )
                        .exists(),
                    )
                )
            rows = db.scalars(
                query.order_by(Session.pinned.desc(), Session.updated_at.desc(), Session.id)
                .offset(offset)
                .limit(limit)
            )
            return {"items": [session_dict(s) for s in rows]}

    def session_dict(session):
        return {
            "project_id": session.project_id,
            "id": session.id,
            "title": session.title,
            "pinned": session.pinned,
            "archived": session.archived,
            "created_at": session.created_at.isoformat(),
            "updated_at": session.updated_at.isoformat(),
        }

    @app.patch("/api/v1/sessions/{session_id}")
    def update_session(session_id: str, payload: SessionUpdate):
        changes = {
            key: value
            for key, value in payload.model_dump(exclude_unset=True).items()
            if value is not None or key == "project_id"
        }
        if changes.get("project_id") is not None:
            changes["project_id"] = str(changes["project_id"])
        if not changes:
            raise HTTPException(422, "Cần title, pinned, archived hoặc project_id.")
        with factory() as db:
            session = owned_session(db, session_id)
            if changes.get("project_id"):
                owned_project(db, changes["project_id"], OWNER)
            statement = update(Session).where(Session.id == session_id, Session.owner_id == OWNER)
            if changes.get("archived") or "project_id" in changes:
                statement = statement.where(
                    or_(Session.active_request.is_(None), Session.active_until < now())
                )
            result = db.execute(
                statement.execution_options(synchronize_session="fetch").values(**changes)
            )
            if not result.rowcount:
                raise HTTPException(
                    409, "Dừng hoặc chờ lượt trả lời hoàn tất trước khi chuyển Project/lưu trữ."
                )
            db.commit()
            return session_dict(session)

    @app.get("/api/v1/sessions/{session_id}")
    def get_session(session_id: UUID):
        with factory() as db:
            return session_dict(owned_session(db, str(session_id)))

    @app.post("/api/v1/sessions", status_code=201)
    def new_session(payload: NewSession):
        with factory() as db:
            if payload.project_id:
                owned_project(db, str(payload.project_id), OWNER)
            session = Session(
                owner_id=OWNER,
                title=payload.title,
                project_id=str(payload.project_id) if payload.project_id else None,
            )
            db.add(session)
            db.commit()
            return session_dict(session)

    @app.get("/api/v1/sessions/{session_id}/messages")
    def messages(
        session_id: str, offset: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=200)
    ):
        with factory() as db:
            owned_session(db, session_id)
            rows = db.scalars(
                select(Message)
                .where(Message.session_id == session_id)
                .order_by(Message.created_at)
                .offset(offset)
                .limit(limit)
            )
            return {"items": [message_dict(m) for m in rows]}

    @app.post("/api/v1/sessions/{session_id}/messages")
    def chat(session_id: str, payload: ChatRequest):
        turn = begin(factory, settings, session_id, payload)
        request_id = str(payload.request_id)

        async def stream():
            if "replay" in turn:
                msg = turn["replay"]
                yield event("sources", {"items": msg["sources"]})
                if msg.get("trace"):
                    yield event("trace", msg["trace"])
                yield event("delta", {"text": msg["content"]})
                yield event("done", {"message_id": msg["id"], "request_id": request_id})
                return
            answer, sources, trace, completed = "", [], None, False
            try:
                graph = build_graph(
                    settings, factory, OWNER, app.state.provider_transport, session_id=session_id
                )
                async with asyncio.timeout(settings.llm_timeout_seconds):
                    async for mode, data in graph.astream(
                        {
                            "query": payload.content,
                            "document_ids": turn["document_ids"],
                            "history": turn["history"],
                            "pipeline_config": (
                                payload.pipeline_config.model_dump()
                                if payload.pipeline_config
                                else None
                            ),
                        },
                        stream_mode=["custom", "updates"],
                    ):
                        if mode == "custom":
                            if data["type"] == "delta":
                                answer += data["data"]["text"]
                            elif data["type"] == "sources":
                                sources = data["data"]["items"]
                            elif data["type"] == "trace":
                                trace = data["data"]
                            yield event(data["type"], data["data"])
                completed = finish(
                    factory,
                    session_id,
                    request_id,
                    turn["message_id"],
                    answer,
                    sources,
                    "completed",
                    trace=trace,
                )
                if not completed:
                    raise ProviderError("Lượt trả lời hết hạn. Hãy tải lại hội thoại.")
                yield event("done", {"message_id": turn["message_id"], "request_id": request_id})
            except asyncio.CancelledError:
                raise
            except (
                ProviderError,
                httpx.HTTPError,
                TimeoutError,
                ValueError,
                RuntimeError,
            ) as error:
                log.warning("chat request=%s failed type=%s", request_id, type(error).__name__)
                message = (
                    str(error)
                    if isinstance(error, ProviderError)
                    else (
                        "Không kết nối được model hoặc lượt trả lời bị gián đoạn. Hãy kiểm tra backend/model."
                    )
                )
                yield event(
                    "error",
                    {"code": "generation_failed", "message": message, "request_id": request_id},
                )
            finally:
                if not completed:
                    finish(
                        factory,
                        session_id,
                        request_id,
                        turn["message_id"],
                        answer,
                        sources,
                        "failed",
                        trace=trace,
                    )

        return StreamingResponse(
            stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    app.include_router(catalog_router(settings, factory))

    @app.get("/api/v1/presets")
    def list_presets():
        return {"items": list(PRESETS.values())}

    @app.post("/api/v1/eval/sandbox")
    def eval_sandbox(payload: SandboxRequest):
        return run_sandbox_eval(factory, OWNER, payload)

    @app.get("/api/v1/jobs/{job_id}")
    def job_status(job_id: str):
        with factory() as db:
            row = db.execute(
                select(Job, Document)
                .join(Document)
                .where(Job.id == job_id, Document.owner_id == OWNER)
            ).first()
            if not row:
                raise HTTPException(404, "Không tìm thấy job.")
            job, doc = row
            return {
                "id": job.id,
                "document_id": doc.id,
                "status": job.status,
                "attempts": job.attempts,
                "error": job.error,
            }

    @app.get("/api/v1/sources/{chunk_id}")
    def source(chunk_id: str):
        with factory() as db:
            row = db.execute(
                select(Chunk, Document)
                .join(Document)
                .where(Chunk.id == chunk_id, Document.owner_id == OWNER, Document.status == "ready")
            ).first()
            if not row:
                raise HTTPException(404, "Không tìm thấy nguồn.")
            chunk, doc = row
            return {
                "chunk_id": chunk.id,
                "document_id": doc.id,
                "name": doc.name,
                "version": doc.version,
                "page": chunk.page,
                "text": chunk.text,
            }

    return app


app = create_app()

