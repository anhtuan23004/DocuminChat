import hashlib
from pathlib import Path
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.integration.auth import OWNER
from app.integration.schemas import NewProject
from app.projects.scopes import binding_filter, check_scope, owned_project
from app.storage import Document, DocumentBinding, Job, Project, identifier


def project_dict(project):
    return {"id": project.id, "name": project.name, "created_at": project.created_at.isoformat()}


def document_dict(doc, job, bindings):
    return {
        "id": doc.id,
        "name": doc.name,
        "version": doc.version,
        "status": doc.status,
        "job_id": job.id,
        "error": job.error,
        "bindings": [
            {"id": link.id, "project_id": link.project_id, "session_id": link.session_id}
            for link in bindings
        ],
    }


def catalog_router(settings, factory):
    router = APIRouter(prefix="/api/v1")

    @router.get("/projects")
    def projects(offset: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=200)):
        with factory() as db:
            rows = db.scalars(
                select(Project)
                .where(Project.owner_id == OWNER)
                .order_by(Project.created_at.desc(), Project.id)
                .offset(offset)
                .limit(limit)
            )
            return {"items": [project_dict(p) for p in rows]}

    @router.post("/projects", status_code=201)
    def create_project(payload: NewProject):
        with factory() as db:
            project = Project(owner_id=OWNER, name=payload.name)
            db.add(project)
            db.commit()
            return project_dict(project)

    @router.get("/projects/{project_id}")
    def get_project(project_id: UUID):
        with factory() as db:
            return project_dict(owned_project(db, str(project_id), OWNER))

    @router.get("/documents")
    def documents(
        project_id: UUID | None = None,
        session_id: UUID | None = None,
        offset: int = Query(0, ge=0),
        limit: int = Query(100, ge=1, le=200),
    ):
        project_id, session_id = (
            str(project_id) if project_id else None,
            str(session_id) if session_id else None,
        )
        with factory() as db:
            condition = binding_filter(db, OWNER, project_id, session_id)
            rows = db.execute(
                select(Document, Job)
                .join(Job)
                .where(
                    Document.owner_id == OWNER,
                    select(DocumentBinding.id)
                    .where(DocumentBinding.document_id == Document.id, condition)
                    .exists(),
                )
                .order_by(Document.created_at.desc(), Document.id)
                .offset(offset)
                .limit(limit)
            ).all()
            links = list(
                db.scalars(
                    select(DocumentBinding).where(
                        condition, DocumentBinding.document_id.in_([d.id for d, _ in rows])
                    )
                )
            )
            return {
                "items": [
                    document_dict(d, j, [link for link in links if link.document_id == d.id])
                    for d, j in rows
                ]
            }

    @router.post("/documents", status_code=202)
    async def upload(
        file: Annotated[UploadFile, File()],
        project_id: Annotated[UUID | None, Form()] = None,
        session_id: Annotated[UUID | None, Form()] = None,
    ):
        project_id, session_id = (
            str(project_id) if project_id else None,
            str(session_id) if session_id else None,
        )
        with factory() as db:
            check_scope(db, OWNER, project_id, session_id)
        name = (file.filename or "document").replace("\\", "/").split("/")[-1][:255]
        extension = Path(name).suffix.lower()
        if extension not in {".pdf", ".txt"}:
            raise HTTPException(422, "Chỉ nhận PDF hoặc TXT UTF-8.")
        path = settings.data_dir / (identifier() + extension)
        persisted = False
        try:
            digest, size, prefix = hashlib.sha256(), 0, b""
            with path.open("xb") as target:
                while block := await file.read(64 * 1024):
                    size += len(block)
                    if size > settings.max_upload_bytes:
                        raise HTTPException(413, "File vượt giới hạn 20 MB.")
                    if not prefix:
                        prefix = block[:8]
                    digest.update(block)
                    target.write(block)
            if not size or (extension == ".pdf" and not prefix.startswith(b"%PDF-")):
                raise HTTPException(422, "File rỗng hoặc không phải PDF hợp lệ.")
            checksum = digest.hexdigest()
            with factory() as db:
                check_scope(db, OWNER, project_id, session_id)
                doc = db.scalar(
                    select(Document).where(
                        Document.owner_id == OWNER, Document.checksum == checksum
                    )
                )
                is_new = doc is None
                if is_new:
                    doc = Document(owner_id=OWNER, name=name, checksum=checksum, path=str(path))
                    db.add(doc)
                    db.flush()
                    job = Job(document_id=doc.id)
                    db.add(job)
                else:
                    job = db.scalar(select(Job).where(Job.document_id == doc.id))
                link = db.scalar(
                    select(DocumentBinding).where(
                        DocumentBinding.document_id == doc.id,
                        DocumentBinding.project_id == project_id,
                        DocumentBinding.session_id == session_id,
                    )
                )
                if not link:
                    link = DocumentBinding(
                        document_id=doc.id, project_id=project_id, session_id=session_id
                    )
                    db.add(link)
                try:
                    db.commit()
                except IntegrityError as error:
                    db.rollback()
                    raise HTTPException(
                        409, "File vừa được đính kèm trong request khác. Hãy làm mới."
                    ) from error
                persisted = is_new
                return document_dict(doc, job, [link])
        finally:
            await file.close()
            if not persisted:
                path.unlink(missing_ok=True)

    @router.delete("/document-bindings/{binding_id}", status_code=204)
    def detach(binding_id: UUID):
        with factory() as db:
            row = db.execute(
                select(DocumentBinding, Document)
                .join(Document)
                .where(DocumentBinding.id == str(binding_id), Document.owner_id == OWNER)
            ).first()
            if not row:
                raise HTTPException(404, "Không tìm thấy tài liệu tại nơi lưu này.")
            link, _ = row
            check_scope(db, OWNER, link.project_id, link.session_id)
            db.delete(link)
            db.commit()

    return router
