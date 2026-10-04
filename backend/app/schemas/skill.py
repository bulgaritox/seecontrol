"""
Skill Schemas
Pydantic schemas for skill validation
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from enum import Enum

from ..models.skill import SkillCategory


class SkillBase(BaseModel):
    """Base skill schema"""
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1)
    category: SkillCategory
    
    model_config = ConfigDict(from_attributes=True)


class SkillCreate(SkillBase):
    """Schema for creating a new skill"""
    instructions: str = Field(..., min_length=1)
    examples: List[str] = Field(default=[])
    
    version: str = Field(default="1.0.0", max_length=20)
    
    author: str = Field(..., max_length=100)
    author_id: str = Field(..., max_length=100)
    
    marketplace: bool = Field(default=False)
    price: Optional[float] = Field(default=None, ge=0)
    
    triggers: List[str] = Field(default=[])
    dependencies: List[str] = Field(default=[])
    
    is_active: bool = Field(default=True)
    is_certified: bool = Field(default=False)
    
    tags: List[str] = Field(default=[])


class SkillUpdate(BaseModel):
    """Schema for updating a skill"""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, min_length=1)
    category: Optional[SkillCategory] = None
    
    instructions: Optional[str] = Field(default=None, min_length=1)
    examples: Optional[List[str]] = None
    
    version: Optional[str] = Field(default=None, max_length=20)
    
    author: Optional[str] = Field(default=None, max_length=100)
    author_id: Optional[str] = Field(default=None, max_length=100)
    
    marketplace: Optional[bool] = None
    price: Optional[float] = Field(default=None, ge=0)
    
    triggers: Optional[List[str]] = None
    dependencies: Optional[List[str]] = None
    
    is_active: Optional[bool] = None
    is_certified: Optional[bool] = None
    
    tags: Optional[List[str]] = None


class SkillResponse(SkillBase):
    """Schema for skill response"""
    id: str
    instructions: str
    examples: List[str]
    
    version: str
    
    author: str
    author_id: str
    
    marketplace: bool
    price: Optional[float]
    rating: Optional[float]
    downloads: int
    
    triggers: List[str]
    dependencies: List[str]
    
    is_active: bool
    is_certified: bool
    
    user_id: str
    workspace_id: str
    created_at: datetime
    updated_at: datetime
    
    tags: List[str]
    
    # Computed properties
    display_name: str


class SkillListResponse(BaseModel):
    """Schema for listing skills"""
    skills: List[SkillResponse]
    total: int
    page: int
    page_size: int


class SkillCard(BaseModel):
    """Schema for marketplace card"""
    id: str
    name: str
    description: str
    category: str
    version: str
    author: str
    price: Optional[float]
    rating: Optional[float]
    downloads: int
    is_certified: bool


class SkillTrigger(BaseModel):
    """Schema for skill trigger"""
    trigger_type: str
    condition: str
    action: str
