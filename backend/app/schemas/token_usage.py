"""
Token Usage Schemas
Pydantic schemas for token usage validation
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from enum import Enum


class TokenUsageBase(BaseModel):
    """Base token usage schema"""
    tokens_used: int = Field(..., ge=0)
    cost: float = Field(..., ge=0)
    
    model_config = ConfigDict(from_attributes=True)


class TokenUsageCreate(TokenUsageBase):
    """Schema for creating a new token usage record"""
    model: str = Field(..., max_length=100)
    provider: str = Field(..., max_length=50)
    endpoint: Optional[str] = Field(default=None, max_length=200)
    
    request_type: str = Field(default="completion", max_length=50)
    request_data: Optional[dict] = None
    
    agent_id: Optional[str] = Field(default=None, max_length=100)
    task_id: Optional[str] = Field(default=None, max_length=100)
    mission_id: Optional[str] = Field(default=None, max_length=100)
    
    metadata: Optional[dict] = None


class TokenUsageUpdate(BaseModel):
    """Schema for updating token usage"""
    tokens_used: Optional[int] = Field(default=None, ge=0)
    cost: Optional[float] = Field(default=None, ge=0)
    
    model: Optional[str] = Field(default=None, max_length=100)
    provider: Optional[str] = Field(default=None, max_length=50)
    endpoint: Optional[str] = Field(default=None, max_length=200)
    
    request_type: Optional[str] = Field(default=None, max_length=50)
    request_data: Optional[dict] = None
    
    agent_id: Optional[str] = Field(default=None, max_length=100)
    task_id: Optional[str] = Field(default=None, max_length=100)
    mission_id: Optional[str] = Field(default=None, max_length=100)
    
    metadata: Optional[dict] = None


class TokenUsageResponse(TokenUsageBase):
    """Schema for token usage response"""
    id: str
    model: str
    provider: str
    endpoint: Optional[str]
    
    request_type: str
    request_data: Optional[dict]
    
    agent_id: Optional[str]
    task_id: Optional[str]
    mission_id: Optional[str]
    
    user_id: str
    workspace_id: str
    created_at: datetime
    updated_at: datetime
    
    metadata: Optional[dict]


class TokenUsageListResponse(BaseModel):
    """Schema for listing token usage"""
    token_usages: List[TokenUsageResponse]
    total: int
    page: int
    page_size: int


class TokenUsageStats(BaseModel):
    """Schema for token usage statistics"""
    workspace_id: str
    total_tokens: int
    total_cost: float
    by_model: dict
    by_provider: dict
    by_agent: dict
    daily_usage: List[dict]
    weekly_usage: List[dict]
    monthly_usage: List[dict]


class TokenUsageFilter(BaseModel):
    """Schema for filtering token usage"""
    model: Optional[str] = None
    provider: Optional[str] = None
    agent_id: Optional[str] = None
    task_id: Optional[str] = None
    mission_id: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=100)


class BudgetAlert(BaseModel):
    """Schema for budget alert"""
    workspace_id: str
    current_usage: int
    budget: int
    percentage: float
    threshold: float
    message: str
