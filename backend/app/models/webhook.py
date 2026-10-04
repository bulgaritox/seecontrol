"""
Webhook Model
For external integrations and notifications
"""

from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Text, Enum, Boolean, JSON, Integer
from typing import List, Optional
from enum import Enum as PyEnum

from .base import Base, BaseModel


class WebhookEvent(str, PyEnum):
    """Events that can trigger webhooks"""
    TASK_CREATED = "task.created"
    TASK_UPDATED = "task.updated"
    TASK_COMPLETED = "task.completed"
    TASK_FAILED = "task.failed"
    AGENT_STARTED = "agent.started"
    AGENT_COMPLETED = "agent.completed"
    AGENT_BLOCKED = "agent.blocked"
    MISSION_CREATED = "mission.created"
    MISSION_COMPLETED = "mission.completed"
    TOKEN_THRESHOLD = "token.threshold"


class WebhookMethod(str, PyEnum):
    """HTTP methods for webhooks"""
    POST = "POST"
    PUT = "PUT"
    GET = "GET"
    DELETE = "DELETE"


class Webhook(Base, BaseModel):
    """Webhook model for external integrations"""
    
    __tablename__ = "webhooks"
    
    # Webhook configuration
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    method: Mapped[WebhookMethod] = mapped_column(Enum(WebhookMethod), default=WebhookMethod.POST, nullable=False)
    
    # Events to listen for
    events: Mapped[List[WebhookEvent]] = mapped_column(JSON, default=[], nullable=False)
    
    # Authentication
    secret: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    headers: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Payload configuration
    payload_template: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    include_data: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_triggered: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    last_response: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Rate limiting
    max_retries: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    retry_delay: Mapped[int] = mapped_column(Integer, default=1000, nullable=False)  # in ms
    
    # Relationships
    user_id: Mapped[str] = mapped_column(String(100), nullable=False)
    user: Mapped["User"] = relationship("User", back_populates="webhooks")
    
    workspace_id: Mapped[str] = mapped_column(String(100), nullable=False)
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="webhooks")
    
    def __repr__(self) -> str:
        return f"<Webhook(id={self.id}, name={self.name}, url={self.url})>"
    
    @property
    def is_configured(self) -> bool:
        return self.url and self.is_active
    
    def to_test_payload(self) -> dict:
        """Create a test payload for webhook testing"""
        return {
            "webhook_id": str(self.id),
            "webhook_name": self.name,
            "event": "test",
            "timestamp": self.created_at.isoformat(),
            "data": {"test": True},
        }
