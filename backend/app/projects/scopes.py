from fastapi import HTTPException
from sqlalchemy import or_, select

from app.storage import Document, DocumentBinding, Project, Session


def owned_project(db, project_id, owner_id):
    project = db.scalar(
        select(Project).where(Project.id == project_id, Project.owner_id == owner_id)
    )
    if not project:
        raise HTTPException(404, "Không tìm thấy Project.")
    return project


def owned_session(db, session_id, owner_id="local"):
    session = db.scalar(
        select(Session).where(Session.id == session_id, Session.owner_id == owner_id)
    )
    if not session:
        raise HTTPException(404, "Không tìm thấy hội thoại.")
    return session


def check_scope(db, owner_id, project_id=None, session_id=None):
    if bool(project_id) == bool(session_id):
        raise HTTPException(422, "Chọn đúng một project_id hoặc session_id.")
    if project_id:
        owned_project(db, project_id, owner_id)
    else:
        session = owned_session(db, session_id, owner_id)
        if session.project_id:
            owned_project(db, session.project_id, owner_id)


def binding_filter(db, owner_id, project_id=None, session_id=None, inherit=True):
    check_scope(db, owner_id, project_id, session_id)
    if project_id:
        return DocumentBinding.project_id == project_id
    session = owned_session(db, session_id, owner_id)
    condition = DocumentBinding.session_id == session_id
    if inherit and session.project_id:
        condition = or_(condition, DocumentBinding.project_id == session.project_id)
    return condition


def available_documents(db, owner_id, session_id):
    condition = binding_filter(db, owner_id, session_id=session_id)
    return select(Document).where(
        Document.owner_id == owner_id,
        select(DocumentBinding.id)
        .where(DocumentBinding.document_id == Document.id, condition)
        .exists(),
    )
