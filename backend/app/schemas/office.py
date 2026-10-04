"""
Office Schemas
Pydantic schemas for office state and real-time updates
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

from .agent import AgentOfficeState


class OfficeState(BaseModel):
    """Schema for office state"""
    agents: List[AgentOfficeState]
    theme: str = "pixel"
    layout: Optional[Dict[str, Any]] = None
    decorations: Optional[List[str]] = None
    last_updated: datetime


class OfficeStateResponse(OfficeState):
    """Schema for office state response"""
    pass


class OfficeUpdate(BaseModel):
    """Schema for office state update"""
    type: str = "office.update"
    data: OfficeState
    timestamp: datetime
    workspace_id: Optional[str] = None


class AgentStatusUpdate(BaseModel):
    """Schema for updating agent status"""
    agent_id: str
    status: str
    progress: Optional[float] = None
    current_task: Optional[str] = None
    message: Optional[str] = None


class OfficeEvent(BaseModel):
    """Schema for office events"""
    type: str
    agent_id: Optional[str] = None
    agent_name: Optional[str] = None
    task_id: Optional[str] = None
    message: str
    timestamp: datetime
    data: Optional[Dict[str, Any]] = None


class OfficeConfig(BaseModel):
    """Schema for office configuration"""
    theme: str = "pixel"
    layout: Dict[str, Any] = Field(default_factory=dict)
    show_decorations: bool = True
    show_activity_feed: bool = True
    show_global_progress: bool = True
    cell_size: int = 40
