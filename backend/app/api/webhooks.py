"""
Webhooks API Router
Handles CRUD operations for webhooks
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy import or_, and_, desc
from typing import List, Optional
from datetime import datetime
import logging
import hmac
import hashlib
import json

from ..models.webhook import Webhook
from ..models.user import User
from ..models.workspace import Workspace
from ..schemas.webhook import (
    WebhookCreate, 
    WebhookUpdate, 
    WebhookResponse, 
    WebhookListResponse,
    WebhookEvent,
    WebhookPayload,
    WebhookTest
)
from ..services.auth import auth_service
from ..config.database import get_db
from ..config.websocket import websocket_manager
from ..config.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["webhooks"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/login")


# ============================================
# LIST WEBHOOKS
# ============================================

@router.get("/", response_model=WebhookListResponse)
async def list_webhooks(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
    workspace_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    page: int = 1,
    page_size: int = 50,
):
    """List all webhooks with optional filtering"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get user
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Build query
    query = select(Webhook)
    
    # Filter by workspace
    if workspace_id:
        query = query.where(Webhook.workspace_id == workspace_id)
    else:
        # Only show webhooks from user's workspaces
        result = await db.execute(
            select(Workspace.id).where(Workspace.user_id == user_id)
        )
        workspace_ids = list(result.scalars().all())
        if workspace_ids:
            query = query.where(Webhook.workspace_id.in_(workspace_ids))
    
    # Filter by active
    if is_active is not None:
        query = query.where(Webhook.is_active == is_active)
    
    # Order by created_at descending
    query = query.order_by(desc(Webhook.created_at))
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar_one()
    
    # Get paginated results
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    webhooks = result.scalars().all()
    
    return WebhookListResponse(
        webhooks=[
            WebhookResponse(
                id=str(w.id),
                name=w.name,
                url=str(w.url),
                description=w.description,
                events=w.events,
                secret=w.secret,
                is_active=w.is_active,
                user_id=str(w.user_id),
                workspace_id=str(w.workspace_id),
                created_at=w.created_at,
                updated_at=w.updated_at,
                metadata=w.metadata,
            )
            for w in webhooks
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


# ============================================
# GET WEBHOOK
# ============================================

@router.get("/{webhook_id}", response_model=WebhookResponse)
async def get_webhook(
    webhook_id: str,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific webhook by ID"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get webhook
    result = await db.execute(
        select(Webhook).where(Webhook.id == webhook_id)
    )
    webhook = result.scalar_one_or_none()
    
    if not webhook:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Verify access
    result = await db.execute(
        select(Workspace).where(
            Workspace.id == webhook.workspace_id,
            Workspace.user_id == user_id
        )
    )
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    return WebhookResponse(
        id=str(webhook.id),
        name=webhook.name,
        url=str(webhook.url),
        description=webhook.description,
        events=webhook.events,
        secret=webhook.secret,
        is_active=webhook.is_active,
        user_id=str(webhook.user_id),
        workspace_id=str(webhook.workspace_id),
        created_at=webhook.created_at,
        updated_at=webhook.updated_at,
        metadata=webhook.metadata,
    )


# ============================================
# CREATE WEBHOOK
# ============================================

@router.post("/", response_model=WebhookResponse, status_code=status.HTTP_201_CREATED)
async def create_webhook(
    webhook_data: WebhookCreate,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Create a new webhook"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get user's default workspace
    result = await db.execute(
        select(Workspace).where(Workspace.user_id == user_id).limit(1)
    )
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No workspace found. Please create a workspace first."
        )
    
    # Create webhook
    webhook = Webhook(
        name=webhook_data.name,
        url=webhook_data.url,
        description=webhook_data.description,
        events=webhook_data.events,
        secret=webhook_data.secret,
        is_active=webhook_data.is_active,
        metadata=webhook_data.metadata,
        user_id=user_id,
        workspace_id=str(workspace.id),
    )
    
    db.add(webhook)
    await db.commit()
    await db.refresh(webhook)
    
    logger.info(f"Webhook created: {webhook.name} (id={webhook.id})")
    
    return WebhookResponse(
        id=str(webhook.id),
        name=webhook.name,
        url=str(webhook.url),
        description=webhook.description,
        events=webhook.events,
        secret=webhook.secret,
        is_active=webhook.is_active,
        user_id=str(webhook.user_id),
        workspace_id=str(webhook.workspace_id),
        created_at=webhook.created_at,
        updated_at=webhook.updated_at,
        metadata=webhook.metadata,
    )


# ============================================
# UPDATE WEBHOOK
# ============================================

@router.patch("/{webhook_id}", response_model=WebhookResponse)
async def update_webhook(
    webhook_id: str,
    webhook_data: WebhookUpdate,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Update a webhook"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get webhook
    result = await db.execute(
        select(Webhook).where(Webhook.id == webhook_id)
    )
    webhook = result.scalar_one_or_none()
    
    if not webhook:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Verify access
    result = await db.execute(
        select(Workspace).where(
            Workspace.id == webhook.workspace_id,
            Workspace.user_id == user_id
        )
    )
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    # Update webhook
    update_data = webhook_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(webhook, key, value)
    
    webhook.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(webhook)
    
    logger.info(f"Webhook updated: {webhook.name} (id={webhook.id})")
    
    return WebhookResponse(
        id=str(webhook.id),
        name=webhook.name,
        url=str(webhook.url),
        description=webhook.description,
        events=webhook.events,
        secret=webhook.secret,
        is_active=webhook.is_active,
        user_id=str(webhook.user_id),
        workspace_id=str(webhook.workspace_id),
        created_at=webhook.created_at,
        updated_at=webhook.updated_at,
        metadata=webhook.metadata,
    )


# ============================================
# DELETE WEBHOOK
# ============================================

@router.delete("/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webhook(
    webhook_id: str,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Delete a webhook"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get webhook
    result = await db.execute(
        select(Webhook).where(Webhook.id == webhook_id)
    )
    webhook = result.scalar_one_or_none()
    
    if not webhook:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Verify access
    result = await db.execute(
        select(Workspace).where(
            Workspace.id == webhook.workspace_id,
            Workspace.user_id == user_id
        )
    )
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    await db.delete(webhook)
    await db.commit()
    
    logger.info(f"Webhook deleted: {webhook.name} (id={webhook.id})")


# ============================================
# TEST WEBHOOK
# ============================================

@router.post("/test", response_model=dict)
async def test_webhook(
    test_data: WebhookTest,
    token: str = Depends(oauth2_scheme),
):
    """Test a webhook URL"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    import httpx
    
    # Create test payload
    test_payload = {
        "event": test_data.sample_event,
        "data": {"test": True, "timestamp": datetime.utcnow().isoformat()},
        "timestamp": datetime.utcnow().isoformat(),
    }
    
    # Add signature if secret provided
    if test_data.secret:
        signature = hmac.new(
            test_data.secret.encode(),
            json.dumps(test_payload).encode(),
            hashlib.sha256
        ).hexdigest()
        test_payload["signature"] = signature
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                str(test_data.url),
                json=test_payload,
                timeout=10.0
            )
        
        return {
            "success": response.status_code == 200,
            "status_code": response.status_code,
            "response": response.text[:500] if response.text else None,
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }


# ============================================
# WEBHOOK RECEIVER
# ============================================

@router.post("/receive/{webhook_id}", status_code=status.HTTP_200_OK)
async def receive_webhook(
    webhook_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Receive webhook from external service"""
    # Get webhook
    result = await db.execute(
        select(Webhook).where(Webhook.id == webhook_id)
    )
    webhook = result.scalar_one_or_none()
    
    if not webhook:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    if not webhook.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Webhook is inactive")
    
    # Verify signature if secret provided
    if webhook.secret:
        body = await request.body()
        signature = request.headers.get("X-Signature")
        
        if not signature:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing signature")
        
        expected_signature = hmac.new(
            webhook.secret.encode(),
            body,
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(signature, expected_signature):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")
    
    # Parse payload
    payload = await request.json()
    event_type = payload.get("event")
    
    # Process event
    if event_type in webhook.events:
        # Broadcast event to WebSocket
        await websocket_manager.broadcast_webhook_event(
            webhook_id=webhook_id,
            event_type=event_type,
            data=payload.get("data", {}),
            workspace_id=webhook.workspace_id
        )
        
        logger.info(f"Webhook received: {event_type} for webhook {webhook_id}")
    
    return {"status": "received", "event": event_type}
