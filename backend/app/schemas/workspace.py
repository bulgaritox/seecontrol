"""
Workspace Schemas
Pydantic schemas for workspace validation
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

from ..models.workspace import WorkspacePlan, MemoryScope, EscalationPolicy


class WorkspaceBase(BaseModel):
    """Base workspace schema"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(default=None)
    
    model_config = ConfigDict(from_attributes=True)


class WorkspaceCreate(WorkspaceBase):
    """Schema for creating a new workspace"""
    plan: WorkspacePlan = Field(default=WorkspacePlan.FREE)
    
    theme: str = Field(default="pixel", max_length=50)
    layout: Optional[dict] = None
    
    master_ai_model: Optional[str] = Field(default=None, max_length=100)
    default_provider: Optional[str] = Field(default=None, max_length=50)
    strategy: Optional[str] = Field(default="hierarchical", max_length=50)
    escalation_policy: EscalationPolicy = Field(default=EscalationPolicy.NOTIFY_USER)
    heartbeat_interval: int = Field(default=1500, ge=500, le=10000)
    memory_scope: MemoryScope = Field(default=MemoryScope.SESSION)
    
    notifications: Optional[dict] = None


class WorkspaceUpdate(BaseModel):
    """Schema for updating a workspace"""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = None
    
    plan: Optional[WorkspacePlan] = None
    
    theme: Optional[str] = Field(default=None, max_length=50)
    layout: Optional[dict] = None
    
    master_ai_model: Optional[str] = Field(default=None, max_length=100)
    default_provider: Optional[str] = Field(default=None, max_length=50)
    strategy: Optional[str] = Field(default=None, max_length=50)
    escalation_policy: Optional[EscalationPolicy] = None
    heartbeat_interval: Optional[int] = Field(default=None, ge=500, le=10000)
    memory_scope: Optional[MemoryScope] = None
    
    notifications: Optional[dict] = None


class WorkspaceResponse(WorkspaceBase):
    """Schema for workspace response"""
    id: str
    plan: WorkspacePlan
    credits: float
    
    max_agents: int
    max_parallel_agents: int
    max_tasks: int
    max_concurrent_tasks: int
    max_automations: int
    max_scheduled_automations: int
    max_workflows: int
    max_saved_workflows: int
    max_task_runtime_minutes: int
    web_research_limit: int
    file_analysis_limit_mb: int
    token_budget: int
    
    theme: str
    layout: Optional[dict]
    
    master_ai_model: Optional[str]
    default_provider: Optional[str]
    strategy: Optional[str]
    escalation_policy: EscalationPolicy
    heartbeat_interval: int
    memory_scope: MemoryScope
    
    notifications: Optional[dict]
    
    user_id: str
    created_at: datetime
    updated_at: datetime
    
    # Computed properties
    is_free_plan: bool
    can_create_agents: bool
    can_run_parallel: bool


class WorkspaceListResponse(BaseModel):
    """Schema for listing workspaces"""
    workspaces: List[WorkspaceResponse]
    total: int
    page: int
    page_size: int


class WorkspaceSettings(BaseModel):
    """Schema for workspace settings"""
    workspace_id: str
    workspace_name: str
    plan: str
    max_agents: int
    max_parallel_agents: int
    max_tasks: int
    max_concurrent_tasks: int
    theme: str
    master_ai_model: Optional[str]
    default_provider: Optional[str]
    strategy: Optional[str]
    escalation_policy: str
    heartbeat_interval: int
    memory_scope: str


class WorkspaceStats(BaseModel):
    """Schema for workspace statistics"""
    workspace_id: str
    total_agents: int
    total_tasks: int
    total_skills: int
    total_missions: int
    active_tasks: int
    completed_tasks: int
    token_usage: int
    cost: float
