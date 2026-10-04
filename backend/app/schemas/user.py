"""
User Schemas
Pydantic schemas for user validation
"""

from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from enum import Enum

from ..models.user import UserRole


class UserBase(BaseModel):
    """Base user schema"""
    email: EmailStr
    workspace_name: str = Field(..., min_length=1, max_length=100)
    
    model_config = ConfigDict(from_attributes=True)


class UserCreate(UserBase):
    """Schema for creating a new user"""
    password: str = Field(..., min_length=8, max_length=100)
    role: UserRole = Field(default=UserRole.VIEWER)
    
    # BYOK Configuration
    api_key: Optional[str] = Field(default=None, max_length=500)
    provider: Optional[str] = Field(default=None, max_length=50)
    custom_endpoint: Optional[str] = Field(default=None, max_length=500)
    default_model: Optional[str] = Field(default=None, max_length=100)


class UserLogin(BaseModel):
    """Schema for user login"""
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    """Schema for updating a user"""
    email: Optional[EmailStr] = None
    workspace_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    role: Optional[UserRole] = None
    
    # BYOK Configuration
    api_key: Optional[str] = Field(default=None, max_length=500)
    provider: Optional[str] = Field(default=None, max_length=50)
    custom_endpoint: Optional[str] = Field(default=None, max_length=500)
    default_model: Optional[str] = Field(default=None, max_length=100)
    theme: Optional[str] = Field(default=None, max_length=50)


class UserResponse(UserBase):
    """Schema for user response"""
    id: str
    role: UserRole
    created_at: datetime
    updated_at: datetime
    
    # BYOK Configuration
    api_key: Optional[str] = None
    provider: Optional[str] = None
    custom_endpoint: Optional[str] = None
    default_model: Optional[str] = None
    theme: Optional[str] = None
    
    # Computed properties
    is_owner: bool
    is_admin: bool
    can_create_agents: bool
    can_configure_tokens: bool


class UserListResponse(BaseModel):
    """Schema for listing users"""
    users: List[UserResponse]
    total: int
    page: int
    page_size: int
