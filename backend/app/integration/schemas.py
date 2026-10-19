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


class PipelineConfig(BaseModel):
    preset_id: str = Field(default="preset-b", max_length=64)
    # Module 1: Chunking & Ingestion
    chunk_strategy: str = Field(default="page_aware", max_length=40)
    chunk_size: int = Field(default=800, ge=200, le=4000)
    chunk_overlap: int = Field(default=120, ge=0, le=1000)
    keep_heading: bool = True
    # Module 2: RAG & Retrieval
    rag_mode: str = Field(default="hybrid", max_length=40)
    query_rewrite: str = Field(default="multi_query", max_length=40)
    top_k: int = Field(default=4, ge=1, le=20)
    min_score: float = Field(default=0.35, ge=0.0, le=1.0)
    reranker: bool = True
    # Module 3: Context Engineering
    context_ordering: str = Field(default="lost_in_middle", max_length=40)
    max_context_chars: int = Field(default=12000, ge=1000, le=48000)
    context_format: str = Field(default="xml", max_length=32)
    deduplicate: bool = True
    # Module 4: Memory
    memory_mode: str = Field(default="summary_buffer", max_length=40)
    window_turns: int = Field(default=4, ge=0, le=20)
    max_memory_chars: int = Field(default=2400, ge=200, le=12000)
    resolve_pronouns: bool = True
    # Module 5: Prompt & Generator
    prompt_template: str = Field(default="analytical_cot_v2", max_length=64)
    system_prompt: str | None = Field(default=None, max_length=8000)
    temperature: float = Field(default=0.0, ge=0.0, le=2.0)
    top_p: float = Field(default=0.85, ge=0.05, le=1.0)
    enforce_citations: bool = True


class ChatRequest(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    document_ids: list[UUID] | None = Field(default=None, max_length=20)
    request_id: UUID
    pipeline_config: PipelineConfig | None = None

    @field_validator("content")
    @classmethod
    def nonempty(cls, value):
        if not value.strip():
            raise ValueError("Câu hỏi không được để trống")
        return value.strip()


class SandboxRequest(BaseModel):
    module: str = Field(default="rag", max_length=32)
    query: str = Field(
        default="Mức phạt vi phạm SLA khi hệ thống gián đoạn quá 4 giờ và thời hạn thanh toán?",
        min_length=1,
        max_length=2000,
    )
    session_id: UUID | None = None
    document_ids: list[UUID] | None = Field(default=None, max_length=20)
    config_a: PipelineConfig | None = None
    config_b: PipelineConfig | None = None

