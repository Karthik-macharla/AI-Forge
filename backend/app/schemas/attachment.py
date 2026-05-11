import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, computed_field


class AttachmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    message_id: uuid.UUID
    thread_id: uuid.UUID
    file_name: str
    mime_type: str
    attachment_type: str
    file_size_bytes: int
    created_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def url(self) -> str:
        return f"/api/attachments/{self.id}/file"
