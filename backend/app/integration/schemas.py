from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class NewSession(BaseModel):
    title: str = Field(default="Cuộc trò chuyện mới", min_length=1, max_length=120)
    project_id: UUID | None = None


class NewProject(BaseModel):
    name: str = Field(min_length=1, max_length=120)

    @field_validator("name")
    @classmethod
    def valid_name(cls, value):
        if not value.strip():
            raise ValueError("Tên Project không được để trống")
        return value.strip()


class SessionUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    pinned: bool | None = None
    archived: bool | None = None
    project_id: UUID | None = None

    @field_validator("title")
    @classmethod
    def valid_title(cls, value):
        if value is not None and not value.strip():
            raise ValueError("Tên hội thoại không được để trống")
        return value.strip() if value is not None else None


class ChatRequest(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    document_ids: list[UUID] | None = Field(default=None, max_length=20)
    request_id: UUID

    @field_validator("content")
    @classmethod
    def nonempty(cls, value):
        if not value.strip():
            raise ValueError("Câu hỏi không được để trống")
        return value.strip()
