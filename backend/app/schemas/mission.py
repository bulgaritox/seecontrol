"""
Mission Schemas
Pydantic schemas for mission validation
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from enum import Enum

from ..models.mission import MissionDifficulty, MissionStatus


class MissionBase(BaseModel):
    """Base mission schema"""
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1)
    
    model_config = ConfigDict(from_attributes=True)


class MissionCreate(MissionBase):
    """Schema for creating a new mission"""
    difficulty: MissionDifficulty = Field(default=MissionDifficulty.MEDIUM)
    reward: float = Field(default=0.0, ge=0)
    reward_currency: str = Field(default="USD", max_length=10)
    
    required_skills: List[str] = Field(default=[])
    required_agents: int = Field(default=1, ge=1)
    
    agent_team: List[str] = Field(default=[])
    assigned_agent_ids: List[str] = Field(default=[])
    
    deadline: Optional[datetime] = None
    
    auto_accept: bool = Field(default=False)
    
    tags: List[str] = Field(default=[])


class MissionUpdate(BaseModel):
    """Schema for updating a mission"""
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, min_length=1)
    difficulty: Optional[MissionDifficulty] = None
    reward: Optional[float] = Field(default=None, ge=0)
    reward_currency: Optional[str] = Field(default=None, max_length=10)
    
    required_skills: Optional[List[str]] = None
    required_agents: Optional[int] = Field(default=None, ge=1)
    
    status: Optional[MissionStatus] = None
    progress: Optional[float] = Field(default=None, ge=0, le=100)
    
    agent_team: Optional[List[str]] = None
    assigned_agent_ids: Optional[List[str]] = None
    
    deadline: Optional[datetime] = None
    
    delivered_at: Optional[datetime] = None
    delivered_by: Optional[str] = Field(default=None, max_length=100)
    delivery_notes: Optional[str] = None
    
    result: Optional[str] = None
    result_data: Optional[dict] = None
    
    feedback: Optional[str] = None
    rating: Optional[float] = Field(default=None, ge=0, le=5)
    
    auto_accept: Optional[bool] = None
    
    tags: Optional[List[str]] = None


class MissionResponse(MissionBase):
    """Schema for mission response"""
    id: str
    difficulty: MissionDifficulty
    reward: float
    reward_currency: str
    
    required_skills: List[str]
    required_agents: int
    
    status: MissionStatus
    progress: float
    
    agent_team: List[str]
    assigned_agent_ids: List[str]
    
    deadline: Optional[datetime]
    
    delivered_at: Optional[datetime]
    delivered_by: Optional[str]
    delivery_notes: Optional[str]
    
    result: Optional[str]
    result_data: Optional[dict]
    
    feedback: Optional[str]
    rating: Optional[float]
    
    auto_accept: bool
    
    user_id: str
    workspace_id: str
    created_at: datetime
    updated_at: datetime
    
    tags: List[str]
    
    # Computed properties
    is_open: bool
    is_in_progress: bool
    is_completed: bool
    is_expired: bool


class MissionListResponse(BaseModel):
    """Schema for listing missions"""
    missions: List[MissionResponse]
    total: int
    page: int
    page_size: int


class MissionCard(BaseModel):
    """Schema for mission center card"""
    id: str
    title: str
    description: str
    difficulty: str
    reward: float
    reward_currency: str
    required_skills: List[str]
    status: str
    progress: int
    deadline: Optional[datetime]


class MissionAccept(BaseModel):
    """Schema for accepting a mission"""
    agent_ids: List[str] = Field(..., min_length=1)
