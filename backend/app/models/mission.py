"""
Mission Model
Represents a mission/bounty that agents can accept and complete
"""

from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Text, Enum, Float, Integer, DateTime, JSON, Boolean
from typing import List, Optional
from enum import Enum as PyEnum
from datetime import datetime

from .base import Base, BaseModel


class MissionDifficulty(str, PyEnum):
    """Difficulty levels for missions"""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class MissionStatus(str, PyEnum):
    """Status for missions"""
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    DELIVERED = "delivered"
    COMPLETED = "completed"
    FAILED = "failed"


class Mission(Base, BaseModel):
    """Mission model representing a bounty/task for agents"""
    
    __tablename__ = "missions"
    
    # Basic information
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Difficulty and reward
    difficulty: Mapped[MissionDifficulty] = mapped_column(Enum(MissionDifficulty), default=MissionDifficulty.MEDIUM, nullable=False)
    reward: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    reward_currency: Mapped[str] = mapped_column(String(10), default="USD", nullable=False)
    
    # Requirements
    required_skills: Mapped[List[str]] = mapped_column(JSON, default=[], nullable=False)
    required_agents: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    
    # Status and progress
    status: Mapped[MissionStatus] = mapped_column(Enum(MissionStatus), default=MissionStatus.OPEN, nullable=False)
    progress: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    
    # Agent team
    agent_team: Mapped[List[str]] = mapped_column(JSON, default=[], nullable=False)
    assigned_agent_ids: Mapped[List[str]] = mapped_column(JSON, default=[], nullable=False)
    
    # Deadline
    deadline: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Delivery
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    delivery_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Results
    result: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    result_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Feedback
    feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rating: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Auto-accept configuration
    auto_accept: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Relationships
    user_id: Mapped[str] = mapped_column(String(100), nullable=False)
    workspace_id: Mapped[str] = mapped_column(String(100), nullable=False)
    
    # Tags
    tags: Mapped[List[str]] = mapped_column(JSON, default=[], nullable=False)
    
    def __repr__(self) -> str:
        return f"<Mission(id={self.id}, title={self.title}, status={self.status.value})>"
    
    @property
    def is_open(self) -> bool:
        return self.status == MissionStatus.OPEN
    
    @property
    def is_in_progress(self) -> bool:
        return self.status == MissionStatus.IN_PROGRESS
    
    @property
    def is_completed(self) -> bool:
        return self.status == MissionStatus.COMPLETED
    
    @property
    def is_expired(self) -> bool:
        if self.deadline:
            return datetime.utcnow() > self.deadline
        return False
    
    def to_mission_center_card(self) -> dict:
        """Convert to mission center card format"""
        return {
            "id": str(self.id),
            "title": self.title,
            "description": self.description,
            "difficulty": self.difficulty.value,
            "reward": self.reward,
            "reward_currency": self.reward_currency,
            "required_skills": self.required_skills,
            "status": self.status.value,
            "progress": int(self.progress),
            "deadline": self.deadline.isoformat() if self.deadline else None,
        }
