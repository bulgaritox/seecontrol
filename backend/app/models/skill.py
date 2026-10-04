"""
Skill Model
Represents a reusable skill that agents can use
"""

from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Text, Enum, Float, Integer, Boolean, JSON
from typing import List, Optional
from enum import Enum as PyEnum

from .base import Base, BaseModel


class SkillCategory(str, PyEnum):
    """Categories for skills"""
    WRITING = "writing"
    IMAGE = "image"
    VIDEO = "video"
    RESEARCH = "research"
    DATA = "data"
    CODE = "code"
    GENERAL = "general"


class Skill(Base, BaseModel):
    """Skill model representing a reusable capability"""
    
    __tablename__ = "skills"
    
    # Basic information
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[SkillCategory] = mapped_column(Enum(SkillCategory), nullable=False)
    
    # Instructions and examples
    instructions: Mapped[str] = mapped_column(Text, nullable=False)
    examples: Mapped[List[str]] = mapped_column(JSON, default=[], nullable=False)
    
    # Versioning
    version: Mapped[str] = mapped_column(String(20), default="1.0.0", nullable=False)
    
    # Marketplace information
    author: Mapped[str] = mapped_column(String(100), nullable=False)
    author_id: Mapped[str] = mapped_column(String(100), nullable=False)
    marketplace: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rating: Mapped[Optional[float]] = mapped_column(Float, default=0.0, nullable=True)
    downloads: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # Triggers and dependencies
    triggers: Mapped[List[str]] = mapped_column(JSON, default=[], nullable=False)
    dependencies: Mapped[List[str]] = mapped_column(JSON, default=[], nullable=False)
    
    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_certified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Relationships
    user_id: Mapped[str] = mapped_column(String(100), nullable=False)
    user: Mapped["User"] = relationship("User", back_populates="skills")
    workspace_id: Mapped[str] = mapped_column(String(100), nullable=False)
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="skills")
    
    # Tags for organization
    tags: Mapped[List[str]] = mapped_column(JSON, default=[], nullable=False)
    
    def __repr__(self) -> str:
        return f"<Skill(id={self.id}, name={self.name}, category={self.category.value})>"
    
    @property
    def display_name(self) -> str:
        return f"{self.name}.Skill"
    
    def to_marketplace_card(self) -> dict:
        """Convert to marketplace card format"""
        return {
            "id": str(self.id),
            "name": self.name,
            "description": self.description,
            "category": self.category.value,
            "version": self.version,
            "author": self.author,
            "price": self.price,
            "rating": self.rating,
            "downloads": self.downloads,
            "is_certified": self.is_certified,
        }
