"""
Agent Schemas
Pydantic schemas for agent validation
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from enum import Enum

from ..models.agent import AgentStatus


class AgentBase(BaseModel):
    """Base agent schema"""
    name: str = Field(..., min_length=1, max_length=100)
    role: str = Field(..., min_length=1, max_length=100)
    
    model_config = ConfigDict(from_attributes=True)


class AgentCreate(AgentBase):
    """Schema for creating a new agent"""
    description: Optional[str] = Field(default=None, max_length=500)
    character_type: str = Field(default="custom", max_length=50)
    status: AgentStatus = Field(default=AgentStatus.IDLE)
    progress: float = Field(default=0.0, ge=0, le=100)
    current_task: Optional[str] = Field(default=None, max_length=500)
    
    # Skills and tools
    skills: List[str] = Field(default=[])
    tools: List[str] = Field(default=[])
    disallowed_tools: List[str] = Field(default=[])
    
    # Personality and configuration
    personality: Optional[str] = Field(default=None, max_length=500)
    memory: Optional[str] = Field(default=None, max_length=1000)
    
    # LLM Configuration
    model: Optional[str] = Field(default=None, max_length=100)
    provider: Optional[str] = Field(default=None, max_length=50)
    temperature: float = Field(default=0.7, ge=0, le=2)
    max_tokens: int = Field(default=4096, ge=1, le=32768)
    
    # Dependencies
    dependencies: List[str] = Field(default=[])
    handoff_to: List[str] = Field(default=[])
    
    # Limits
    max_turns: int = Field(default=50, ge=1, le=500)
    token_budget: int = Field(default=10000, ge=1)


class AgentUpdate(BaseModel):
    """Schema for updating an agent"""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    role: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    character_type: Optional[str] = Field(default=None, max_length=50)
    status: Optional[AgentStatus] = None
    progress: Optional[float] = Field(default=None, ge=0, le=100)
    current_task: Optional[str] = Field(default=None, max_length=500)
    
    # Skills and tools
    skills: Optional[List[str]] = None
    tools: Optional[List[str]] = None
    disallowed_tools: Optional[List[str]] = None
    
    # Personality and configuration
    personality: Optional[str] = Field(default=None, max_length=500)
    memory: Optional[str] = Field(default=None, max_length=1000)
    
    # LLM Configuration
    model: Optional[str] = Field(default=None, max_length=100)
    provider: Optional[str] = Field(default=None, max_length=50)
    temperature: Optional[float] = Field(default=None, ge=0, le=2)
    max_tokens: Optional[int] = Field(default=None, ge=1, le=32768)
    
    # Dependencies
    dependencies: Optional[List[str]] = None
    handoff_to: Optional[List[str]] = None
    
    # Limits
    max_turns: Optional[int] = Field(default=None, ge=1, le=500)
    token_budget: Optional[int] = Field(default=None, ge=1)


class AgentResponse(AgentBase):
    """Schema for agent response"""
    id: str
    character_type: str
    status: AgentStatus
    progress: float
    current_task: Optional[str]
    
    # Skills and tools
    skills: List[str]
    tools: List[str]
    disallowed_tools: List[str]
    
    # Personality and configuration
    personality: Optional[str]
    memory: Optional[str]
    
    # LLM Configuration
    model: Optional[str]
    provider: Optional[str]
    temperature: float
    max_tokens: int
    
    # Dependencies
    dependencies: List[str]
    handoff_to: List[str]
    
    # Limits
    max_turns: int
    token_budget: int
    
    # Metadata
    user_id: str
    workspace_id: str
    created_at: datetime
    updated_at: datetime
    
    # Computed properties
    is_available: bool
    is_busy: bool
    is_blocked: bool


class AgentListResponse(BaseModel):
    """Schema for listing agents"""
    agents: List[AgentResponse]
    total: int
    page: int
    page_size: int


class AgentAssign(BaseModel):
    """Schema for assigning a task to an agent"""
    task_id: str
    priority: Optional[str] = None
    instructions: Optional[str] = None


class AgentOfficeState(BaseModel):
    """Schema for agent state in office"""
    id: str
    name: str
    role: str
    character_type: str
    status: str
    progress: int
    current_task: Optional[str]
