"""
Workspace Model
Represents a workspace for organizing agents, tasks, and resources
"""

from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Text, Enum, Integer, JSON, Boolean, Float
from typing import List, Optional
from enum import Enum as PyEnum

from .base import Base, BaseModel


class WorkspacePlan(str, PyEnum):
    """Subscription plans for workspaces"""
    FREE = "free"
    STARTUP = "startup"
    GROWTH = "growth"
    ENTERPRISE = "enterprise"


class MemoryScope(str, PyEnum):
    """Memory scope options"""
    SESSION = "session"
    LONG_TERM = "long_term"
    PROJECT_CONTEXT = "project_context"


class EscalationPolicy(str, PyEnum):
    """Escalation policy options"""
    AUTO_RETRY = "auto_retry"
    NOTIFY_USER = "notify_user"
    FAIL = "fail"


class Workspace(Base, BaseModel):
    """Workspace model for organizing resources"""
    
    __tablename__ = "workspaces"
    
    # Basic information
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Plan and limits
    plan: Mapped[WorkspacePlan] = mapped_column(Enum(WorkspacePlan), default=WorkspacePlan.FREE, nullable=False)
    credits: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    
    # Agent limits
    max_agents: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    max_parallel_agents: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    
    # Task limits
    max_tasks: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    max_concurrent_tasks: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    
    # Automation limits
    max_automations: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_scheduled_automations: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # Workflow limits
    max_workflows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_saved_workflows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # Runtime limits
    max_task_runtime_minutes: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    web_research_limit: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    file_analysis_limit_mb: Mapped[int] = mapped_column(Integer, default=20, nullable=False)
    
    # Token budget
    token_budget: Mapped[int] = mapped_column(Integer, default=5000, nullable=False)
    
    # Theme and appearance
    theme: Mapped[str] = mapped_column(String(50), default="pixel", nullable=False)
    layout: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Orchestration settings
    master_ai_model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    default_provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    strategy: Mapped[Optional[str]] = mapped_column(String(50), default="hierarchical", nullable=True)
    escalation_policy: Mapped[EscalationPolicy] = mapped_column(Enum(EscalationPolicy), default=EscalationPolicy.NOTIFY_USER, nullable=False)
    heartbeat_interval: Mapped[int] = mapped_column(Integer, default=1500, nullable=False)
    memory_scope: Mapped[MemoryScope] = mapped_column(Enum(MemoryScope), default=MemoryScope.SESSION, nullable=False)
    
    # Notifications
    notifications: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Relationships
    user_id: Mapped[str] = mapped_column(String(100), nullable=False)
    user: Mapped["User"] = relationship("User", back_populates="workspaces")
    
    agents: Mapped[List["Agent"]] = relationship("Agent", back_populates="workspace")
    tasks: Mapped[List["Task"]] = relationship("Task", back_populates="workspace")
    skills: Mapped[List["Skill"]] = relationship("Skill", back_populates="workspace")
    missions: Mapped[List["Mission"]] = relationship("Mission", back_populates="workspace")
    token_usages: Mapped[List["TokenUsage"]] = relationship("TokenUsage", back_populates="workspace")
    webhooks: Mapped[List["Webhook"]] = relationship("Webhook", back_populates="workspace")
    
    def __repr__(self) -> str:
        return f"<Workspace(id={self.id}, name={self.name}, plan={self.plan.value})>"
    
    @property
    def is_free_plan(self) -> bool:
        return self.plan == WorkspacePlan.FREE
    
    @property
    def can_create_agents(self) -> bool:
        return self.max_agents > len(self.agents)
    
    @property
    def can_run_parallel(self) -> bool:
        return self.max_parallel_agents > 1
    
    def to_settings_dict(self) -> dict:
        """Convert to settings dictionary"""
        return {
            "workspace_id": str(self.id),
            "workspace_name": self.name,
            "plan": self.plan.value,
            "max_agents": self.max_agents,
            "max_parallel_agents": self.max_parallel_agents,
            "max_tasks": self.max_tasks,
            "max_concurrent_tasks": self.max_concurrent_tasks,
            "theme": self.theme,
            "master_ai_model": self.master_ai_model,
            "default_provider": self.default_provider,
            "strategy": self.strategy,
            "escalation_policy": self.escalation_policy.value,
            "heartbeat_interval": self.heartbeat_interval,
            "memory_scope": self.memory_scope.value,
        }
