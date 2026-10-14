import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker


def identifier():
    return str(uuid.uuid4())


def now():
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    owner_id: Mapped[str] = mapped_column(String(100), index=True)
    name: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Session(Base):
    __tablename__ = "chat_sessions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    owner_id: Mapped[str] = mapped_column(String(100), index=True)
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"), index=True)
    title: Mapped[str] = mapped_column(String(120), default="Cuộc trò chuyện mới")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    active_request: Mapped[str | None] = mapped_column(String(36))
    active_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    session_id: Mapped[str] = mapped_column(ForeignKey("chat_sessions.id"), index=True)
    role: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="completed")
    sources: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Turn(Base):
    __tablename__ = "turns"
    __table_args__ = (UniqueConstraint("session_id", "request_id"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    session_id: Mapped[str] = mapped_column(ForeignKey("chat_sessions.id"))
    request_id: Mapped[str] = mapped_column(String(36))
    fingerprint: Mapped[str] = mapped_column(String(64))
    message_id: Mapped[str] = mapped_column(ForeignKey("messages.id"))
    status: Mapped[str] = mapped_column(String(20), default="running")


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (UniqueConstraint("owner_id", "checksum"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    owner_id: Mapped[str] = mapped_column(String(100), index=True)
    name: Mapped[str] = mapped_column(String(255))
    checksum: Mapped[str] = mapped_column(String(64))
    path: Mapped[str] = mapped_column(Text)
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Chunk(Base):
    __tablename__ = "chunks"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), index=True)
    page: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)


class DocumentBinding(Base):
    __tablename__ = "document_bindings"
    __table_args__ = (
        CheckConstraint(
            "(project_id IS NOT NULL AND session_id IS NULL) OR "
            "(project_id IS NULL AND session_id IS NOT NULL)",
            name="one_document_scope",
        ),
        UniqueConstraint("document_id", "project_id"),
        UniqueConstraint("document_id", "session_id"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), index=True)
    project_id: Mapped[str | None] = mapped_column(ForeignKey("projects.id"), index=True)
    session_id: Mapped[str | None] = mapped_column(ForeignKey("chat_sessions.id"), index=True)


class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), unique=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    lease_token: Mapped[str | None] = mapped_column(String(36))
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error: Mapped[str | None] = mapped_column(Text)


def database(settings):
    kwargs = {"pool_pre_ping": True}
    if settings.database_url.startswith("sqlite"):
        from pathlib import Path

        Path(".data").mkdir(exist_ok=True)
        kwargs["connect_args"] = {"check_same_thread": False}
    engine = create_engine(settings.database_url, **kwargs)
    return engine, sessionmaker(engine, expire_on_commit=False)
