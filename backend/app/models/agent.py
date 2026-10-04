"""
Agent Model
Represents an AI agent with specific skills and capabilities
"""

from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Text, Enum, Float, Integer, Boolean, JSON
from typing import List, Optional
from enum import Enum as PyEnum

from .base import Base, BaseModel


class AgentStatus(str, PyEnum):
    """Agent status for tracking state"""
    IDLE = "idle"
    WORKING = "working"
    PROGRESS = "progress"
    THINKING = "thinking"
    BLOCKED = "blocked"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"


class Agent(Base, BaseModel):
    """Agent model representing an AI worker"""
    
    __tablename__ = "agents"
    
    # Basic information
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Character configuration (for pixel art visualization)
    character_type: Mapped[str] = mapped_column(String(50), default="custom", nullable=False)
    
    # Status and progress
    status: Mapped[AgentStatus] = mapped_column(Enum(AgentStatus), default=AgentStatus.IDLE, nullable=False)
    progress: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    
    # Current task
    current_task: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    current_task_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # Skills and tools
    skills: Mapped[List[str]] = mapped_column(JSON, default=[], nullable=False)
    tools: Mapped[List[str]] = mapped_column(JSON, default=[], nullable=False)
    disallowed_tools: Mapped[List[str]] = mapped_column(JSON, default=[], nullable=False)
    
    # Personality and configuration
    personality: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    memory: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # LLM Configuration
    model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    temperature: Mapped[Optional[float]] = mapped_column(Float, default=0.7, nullable=True)
    max_tokens: Mapped[Optional[int]] = mapped_column(Integer, default=4096, nullable=True)
    
    # Workspace and dependencies
    dependencies: Mapped[List[str]] = mapped_column(JSON, default=[], nullable=False)
    handoff_to: Mapped[List[str]] = mapped_column(JSON, default=[], nullable=False)
    
    # Limits
    max_turns: Mapped[Optional[int]] = mapped_column(Integer, default=50, nullable=True)
    token_budget: Mapped[Optional[int]] = mapped_column(Integer, default=10000, nullable=True)
    
    # Relationships
    user_id: Mapped[str] = mapped_column(String(100), nullable=False)
    workspace_id: Mapped[str] = mapped_column(String(100), nullable=False)
    
    
    def __repr__(self) -> str:
        return f"<Agent(id={self.id}, name={self.name}, status={self.status.value})>"
    
    @property
    def is_available(self) -> bool:
        return self.status in [AgentStatus.IDLE, AgentStatus.COMPLETED, AgentStatus.FAILED]
    
    @property
    def is_busy(self) -> bool:
        return self.status in [AgentStatus.WORKING, AgentStatus.PROGRESS, AgentStatus.THINKING]
    
    @property
    def is_blocked(self) -> bool:
        return self.status == AgentStatus.BLOCKED
    
    def to_office_state(self) -> dict:
        """Convert to format suitable for office visualization"""
        return {
            "id": str(self.id),
            "name": self.name,
            "role": self.role,
            "character_type": self.character_type,
            "status": self.status.value,
            "progress": int(self.progress),
            "current_task": self.current_task,
        }
