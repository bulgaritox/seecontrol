"""
User Model
Represents a user of the SeeControl platform
"""

from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Enum, Text
from typing import List, Optional
from enum import Enum as PyEnum

from .base import Base, BaseModel


class UserRole(str, PyEnum):
    """User roles for RBAC"""
    OWNER = "owner"
    ADMIN = "admin"
    VIEWER = "viewer"


class User(Base, BaseModel):
    """User model with authentication and workspace information"""
    
    __tablename__ = "users"
    
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(500), nullable=False)
    workspace_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.VIEWER, nullable=False)
    
    # BYOK Configuration
    api_key: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    custom_endpoint: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    default_model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # Preferences
    theme: Mapped[Optional[str]] = mapped_column(String(50), default="pixel", nullable=True)
    
    # Relationships
    agents: Mapped[List["Agent"]] = relationship("Agent", back_populates="user", cascade="all, delete-orphan")
    skills: Mapped[List["Skill"]] = relationship("Skill", back_populates="user")
    tasks: Mapped[List["Task"]] = relationship("Task", back_populates="user")
    missions: Mapped[List["Mission"]] = relationship("Mission", back_populates="user")
    workspaces: Mapped[List["Workspace"]] = relationship("Workspace", back_populates="user")
    token_usages: Mapped[List["TokenUsage"]] = relationship("TokenUsage", back_populates="user")
    webhooks: Mapped[List["Webhook"]] = relationship("Webhook", back_populates="user")
    
    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, role={self.role.value})>"
    
    @property
    def is_owner(self) -> bool:
        return self.role == UserRole.OWNER
    
    @property
    def is_admin(self) -> bool:
        return self.role in [UserRole.OWNER, UserRole.ADMIN]
    
    @property
    def can_create_agents(self) -> bool:
        return self.role in [UserRole.OWNER, UserRole.ADMIN]
    
    @property
    def can_configure_tokens(self) -> bool:
        return self.role == UserRole.OWNER
    
    @property
    def can_approve_tasks(self) -> bool:
        return self.role in [UserRole.OWNER, UserRole.ADMIN]
