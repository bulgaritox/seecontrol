"""
Task Model
Represents a task that agents can work on
"""

from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Text, Enum, Float, Integer, DateTime, JSON
from typing import List, Optional
from enum import Enum as PyEnum
from datetime import datetime

from .base import Base, BaseModel


class TaskPriority(str, PyEnum):
    """Priority levels for tasks"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class TaskStatus(str, PyEnum):
    """Status for tasks"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    BLOCKED = "blocked"
    PAUSED = "paused"


class Task(Base, BaseModel):
    """Task model representing work to be done by agents"""
    
    __tablename__ = "tasks"
    
    # Basic information
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Priority and status
    priority: Mapped[TaskPriority] = mapped_column(Enum(TaskPriority), default=TaskPriority.MEDIUM, nullable=False)
    status: Mapped[TaskStatus] = mapped_column(Enum(TaskStatus), default=TaskStatus.PENDING, nullable=False)
    progress: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    
    # Agent assignment
    agent_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    agent: Mapped[Optional["Agent"]] = relationship("Agent", back_populates="tasks")
    
    # Dependencies
    dependencies: Mapped[List[str]] = mapped_column(JSON, default=[], nullable=False)
    
    # Results
    result: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    result_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Token usage
    tokens_used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cost: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    
    # Timing
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    estimated_duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # in minutes
    
    # Retry configuration
    max_retries: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # Relationships
    user_id: Mapped[str] = mapped_column(String(100), nullable=False)
    user: Mapped["User"] = relationship("User", back_populates="tasks")
    workspace_id: Mapped[str] = mapped_column(String(100), nullable=False)
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="tasks")
    
    # Subtasks
    subtasks: Mapped[List[dict]] = mapped_column(JSON, default=[], nullable=False)
    completed_subtasks: Mapped[List[str]] = mapped_column(JSON, default=[], nullable=False)
    
    # Metadata
    metadata: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    def __repr__(self) -> str:
        return f"<Task(id={self.id}, title={self.title}, status={self.status.value})>"
    
    @property
    def is_complete(self) -> bool:
        return self.status == TaskStatus.COMPLETED
    
    @property
    def is_in_progress(self) -> bool:
        return self.status == TaskStatus.IN_PROGRESS
    
    @property
    def is_blocked(self) -> bool:
        return self.status == TaskStatus.BLOCKED
    
    @property
    def has_dependencies(self) -> bool:
        return len(self.dependencies) > 0
    
    @property
    def all_dependencies_complete(self) -> bool:
        # This would need to check the status of dependency tasks
        return True
    
    def to_office_update(self) -> dict:
        """Convert to format for office WebSocket update"""
        return {
            "type": "task.update",
            "task_id": str(self.id),
            "title": self.title,
            "status": self.status.value,
            "progress": int(self.progress),
            "agent_id": str(self.agent_id) if self.agent_id else None,
            "timestamp": datetime.utcnow().isoformat(),
        }
