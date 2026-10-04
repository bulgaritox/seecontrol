"""
Base Model for SQLAlchemy
Provides common fields and functionality for all models
"""

from sqlalchemy.orm import DeclarativeBase, declared_attr, Mapped, mapped_column
from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from typing import Optional
import uuid


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models"""
    pass


class BaseModel:
    """Base model with common fields"""
    
    @declared_attr
    def __tablename__(cls) -> str:
        return cls.__name__.lower() + "s"
    
    id: Mapped[str] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def to_dict(self) -> dict:
        """Convert model to dictionary"""
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}
    
    def to_dict_with_relationships(self) -> dict:
        """Convert model to dictionary including relationships"""
        result = self.to_dict()
        for key, value in self.__dict__.items():
            if not key.startswith('_') and key not in result:
                if hasattr(value, 'to_dict'):
                    result[key] = value.to_dict()
                elif isinstance(value, list) and len(value) > 0 and hasattr(value[0], 'to_dict'):
                    result[key] = [item.to_dict() for item in value]
        return result
    
    @classmethod
    def get_table_name(cls) -> str:
        """Get table name for model"""
        return cls.__tablename__
