"""
Webhook Schemas
Pydantic schemas for webhook validation
"""

from pydantic import BaseModel, Field, ConfigDict, HttpUrl
from typing import Optional, List
from datetime import datetime
from enum import Enum


class WebhookBase(BaseModel):
    """Base webhook schema"""
    name: str = Field(..., min_length=1, max_length=100)
    url: HttpUrl = Field(...)
    
    model_config = ConfigDict(from_attributes=True)


class WebhookCreate(WebhookBase):
    """Schema for creating a new webhook"""
    description: Optional[str] = Field(default=None, max_length=500)
    
    events: List[str] = Field(default=[], description="List of events to subscribe to")
    
    secret: Optional[str] = Field(default=None, max_length=200)
    
    is_active: bool = Field(default=True)
    
    metadata: Optional[dict] = None


class WebhookUpdate(BaseModel):
    """Schema for updating a webhook"""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    url: Optional[HttpUrl] = None
    
    description: Optional[str] = Field(default=None, max_length=500)
    
    events: Optional[List[str]] = None
    
    secret: Optional[str] = Field(default=None, max_length=200)
    
    is_active: Optional[bool] = None
    
    metadata: Optional[dict] = None


class WebhookResponse(WebhookBase):
    """Schema for webhook response"""
    id: str
    description: Optional[str]
    
    events: List[str]
    
    secret: Optional[str]
    
    is_active: bool
    
    user_id: str
    workspace_id: str
    created_at: datetime
    updated_at: datetime
    
    metadata: Optional[dict]


class WebhookListResponse(BaseModel):
    """Schema for listing webhooks"""
    webhooks: List[WebhookResponse]
    total: int
    page: int
    page_size: int


class WebhookEvent(BaseModel):
    """Schema for webhook event"""
    event_type: str
    data: dict
    timestamp: datetime
    webhook_id: str
    workspace_id: str


class WebhookPayload(BaseModel):
    """Schema for webhook payload"""
    event: str
    data: dict
    timestamp: str
    signature: Optional[str]


class WebhookTest(BaseModel):
    """Schema for testing a webhook"""
    url: HttpUrl
    secret: Optional[str] = None
    sample_event: str = Field(default="test")
