"""
Token Usage Model
Tracks token consumption and costs for LLM providers
"""

from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Float, Integer, DateTime, JSON
from typing import Optional
from datetime import datetime

from .base import Base, BaseModel


class TokenUsage(Base, BaseModel):
    """Token usage tracking model"""
    
    __tablename__ = "token_usages"
    
    # Token information
    tokens_used: Mapped[int] = mapped_column(Integer, nullable=False)
    tokens_input: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tokens_output: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # Cost information
    cost: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    cost_per_token: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Model and provider
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    
    # Context
    prompt: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    completion: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    
    # Metadata (attr renombrado: 'metadata' está reservado por Declarative)
    usage_metadata: Mapped[Optional[dict]] = mapped_column("metadata", JSON, nullable=True)
    
    # Relationships
    user_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    agent_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    task_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    workspace_id: Mapped[str] = mapped_column(String(100), nullable=False)
    
    def __repr__(self) -> str:
        return f"<TokenUsage(id={self.id}, tokens={self.tokens_used}, model={self.model}, provider={self.provider})>"
    
    @property
    def display_cost(self) -> str:
        """Format cost for display"""
        if self.cost > 0:
            return f"${self.cost:.4f}"
        return "$0.0000"
    
    def to_summary(self) -> dict:
        """Convert to summary format"""
        return {
            "id": str(self.id),
            "model": self.model,
            "provider": self.provider,
            "tokens_used": self.tokens_used,
            "cost": self.cost,
            "created_at": self.created_at.isoformat(),
        }
