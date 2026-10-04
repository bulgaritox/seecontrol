"""
Task Schemas
Pydantic schemas for task validation
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from enum import Enum

from ..models.task import TaskPriority, TaskStatus


class TaskBase(BaseModel):
    """Base task schema"""
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1)
    
    model_config = ConfigDict(from_attributes=True)


class TaskCreate(TaskBase):
    """Schema for creating a new task"""
    priority: TaskPriority = Field(default=TaskPriority.MEDIUM)
    
    agent_id: Optional[str] = Field(default=None, max_length=100)
    
    dependencies: List[str] = Field(default=[])
    
    max_retries: int = Field(default=3, ge=0, le=10)
    estimated_duration: Optional[int] = Field(default=None, ge=1, le=180)
    
    subtasks: List[dict] = Field(default=[])
    
    metadata: Optional[dict] = None


class TaskUpdate(BaseModel):
    """Schema for updating a task"""
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, min_length=1)
    
    priority: Optional[TaskPriority] = None
    status: Optional[TaskStatus] = None
    progress: Optional[float] = Field(default=None, ge=0, le=100)
    
    agent_id: Optional[str] = Field(default=None, max_length=100)
    
    dependencies: Optional[List[str]] = None
    
    result: Optional[str] = None
    result_data: Optional[dict] = None
    
    tokens_used: Optional[int] = Field(default=None, ge=0)
    cost: Optional[float] = Field(default=None, ge=0)
    
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    estimated_duration: Optional[int] = Field(default=None, ge=1, le=180)
    
    max_retries: Optional[int] = Field(default=None, ge=0, le=10)
    retry_count: Optional[int] = Field(default=None, ge=0)
    
    subtasks: Optional[List[dict]] = None
    completed_subtasks: Optional[List[str]] = None
    
    metadata: Optional[dict] = None


class TaskResponse(TaskBase):
    """Schema for task response"""
    id: str
    priority: TaskPriority
    status: TaskStatus
    progress: float
    
    agent_id: Optional[str]
    
    dependencies: List[str]
    
    result: Optional[str]
    result_data: Optional[dict]
    
    tokens_used: int
    cost: float
    
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    estimated_duration: Optional[int]
    
    max_retries: int
    retry_count: int
    
    user_id: str
    workspace_id: str
    created_at: datetime
    updated_at: datetime
    
    subtasks: List[dict]
    completed_subtasks: List[str]
    
    metadata: Optional[dict]
    
    # Computed properties
    is_complete: bool
    is_in_progress: bool
    is_blocked: bool
    has_dependencies: bool
    all_dependencies_complete: bool


class TaskListResponse(BaseModel):
    """Schema for listing tasks"""
    tasks: List[TaskResponse]
    total: int
    page: int
    page_size: int


class TaskFilter(BaseModel):
    """Schema for filtering tasks"""
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    agent_id: Optional[str] = None
    workspace_id: Optional[str] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=100)


class TaskAssign(BaseModel):
    """Schema for assigning task to agent"""
    agent_id: str
    priority: Optional[TaskPriority] = None
    instructions: Optional[str] = None
