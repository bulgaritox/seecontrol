"""
Users API Router
Handles user authentication, registration, and management
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from datetime import datetime, timedelta
import logging

from ..models.user import User, UserRole
from ..schemas.user import UserCreate, UserUpdate, UserResponse, UserLogin, UserListResponse
from ..services.auth import auth_service
from ..config.database import get_db
from ..config.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users", "authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/login")


# ============================================
# USER REGISTRATION
# ============================================

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user"""
    # Check if email already exists
    result = await db.execute(
        select(User).where(User.email == user_data.email)
    )
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Hash password
    hashed_password = auth_service.hash_password(user_data.password)
    
    # Create user
    user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        workspace_name=user_data.workspace_name,
        role=user_data.role,
        api_key=user_data.api_key,
        provider=user_data.provider,
        custom_endpoint=user_data.custom_endpoint,
        default_model=user_data.default_model,
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Generate tokens
    access_token = auth_service.create_access_token(data={"sub": str(user.id)})
    refresh_token = auth_service.create_refresh_token(data={"sub": str(user.id)})
    
    logger.info(f"User registered: {user.email}")
    
    return UserResponse(
        id=str(user.id),
        email=user.email,
        workspace_name=user.workspace_name,
        role=user.role,
        created_at=user.created_at,
        updated_at=user.updated_at,
        api_key=user.api_key,
        provider=user.provider,
        custom_endpoint=user.custom_endpoint,
        default_model=user.default_model,
        theme=user.theme,
        is_owner=user.is_owner,
        is_admin=user.is_admin,
        can_create_agents=user.can_create_agents,
        can_configure_tokens=user.can_configure_tokens,
    )


# ============================================
# USER LOGIN
# ============================================

@router.post("/login", response_model=dict, tags=["authentication"])
async def login_user(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Login user and return access token"""
    # Find user
    result = await db.execute(
        select(User).where(User.email == form_data.username)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify password
    if not auth_service.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create tokens
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth_service.create_access_token(
        data={"sub": str(user.id)},
        expires_delta=access_token_expires
    )
    
    refresh_token_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    refresh_token = auth_service.create_refresh_token(
        data={"sub": str(user.id)},
        expires_delta=refresh_token_expires
    )
    
    logger.info(f"User logged in: {user.email}")
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": int(access_token_expires.total_seconds()),
        "user": UserResponse(
            id=str(user.id),
            email=user.email,
            workspace_name=user.workspace_name,
            role=user.role,
            created_at=user.created_at,
            updated_at=user.updated_at,
            api_key=user.api_key,
            provider=user.provider,
            custom_endpoint=user.custom_endpoint,
            default_model=user.default_model,
            theme=user.theme,
            is_owner=user.is_owner,
            is_admin=user.is_admin,
            can_create_agents=user.can_create_agents,
            can_configure_tokens=user.can_configure_tokens,
        ),
    }


# ============================================
# TOKEN REFRESH
# ============================================

@router.post("/refresh", response_model=dict, tags=["authentication"])
async def refresh_token(
    refresh_token: str,
    db: AsyncSession = Depends(get_db),
):
    """Refresh access token using refresh token"""
    # Verify refresh token
    payload = auth_service.verify_token(refresh_token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Find user
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Create new access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth_service.create_access_token(
        data={"sub": str(user.id)},
        expires_delta=access_token_expires
    )
    
    logger.info(f"Token refreshed for user: {user.email}")
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": int(access_token_expires.total_seconds()),
    }


# ============================================
# GET CURRENT USER
# ============================================

@router.get("/me", response_model=UserResponse, tags=["authentication"])
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Get current user information"""
    # Verify token
    payload = auth_service.verify_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    
    # Find user
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse(
        id=str(user.id),
        email=user.email,
        workspace_name=user.workspace_name,
        role=user.role,
        created_at=user.created_at,
        updated_at=user.updated_at,
        api_key=user.api_key,
        provider=user.provider,
        custom_endpoint=user.custom_endpoint,
        default_model=user.default_model,
        theme=user.theme,
        is_owner=user.is_owner,
        is_admin=user.is_admin,
        can_create_agents=user.can_create_agents,
        can_configure_tokens=user.can_configure_tokens,
    )


# ============================================
# LIST USERS (Admin only)
# ============================================

@router.get("/", response_model=UserListResponse, tags=["users"])
async def list_users(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
    page: int = 1,
    page_size: int = 50,
):
    """List all users (admin only)"""
    # Verify token and get user
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Check if user is admin
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    current_user = result.scalar_one_or_none()
    
    if not current_user or not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    # Get users
    result = await db.execute(
        select(User).offset((page - 1) * page_size).limit(page_size)
    )
    users = result.scalars().all()
    
    # Get total count
    result = await db.execute(
        select(User)
    )
    total = len(result.scalars().all())
    
    return UserListResponse(
        users=[
            UserResponse(
                id=str(u.id),
                email=u.email,
                workspace_name=u.workspace_name,
                role=u.role,
                created_at=u.created_at,
                updated_at=u.updated_at,
                is_owner=u.is_owner,
                is_admin=u.is_admin,
                can_create_agents=u.can_create_agents,
                can_configure_tokens=u.can_configure_tokens,
            )
            for u in users
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


# ============================================
# UPDATE USER
# ============================================

@router.put("/{user_id}", response_model=UserResponse, tags=["users"])
async def update_user(
    user_id: str,
    user_data: UserUpdate,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Update user information"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    current_user_id = payload.get("sub")
    
    # Check permissions (owner can update anyone, admin can update non-owners)
    result = await db.execute(
        select(User).where(User.id == current_user_id)
    )
    current_user = result.scalar_one_or_none()
    
    if not current_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Find user to update
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Check permissions
    if current_user_id != user_id and not current_user.is_owner:
        if current_user.is_admin and user.role == UserRole.OWNER:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    # Update user
    if user_data.email:
        user.email = user_data.email
    if user_data.workspace_name:
        user.workspace_name = user_data.workspace_name
    if user_data.role:
        user.role = user_data.role
    if user_data.api_key:
        user.api_key = user_data.api_key
    if user_data.provider:
        user.provider = user_data.provider
    if user_data.custom_endpoint:
        user.custom_endpoint = user_data.custom_endpoint
    if user_data.default_model:
        user.default_model = user_data.default_model
    if user_data.theme:
        user.theme = user_data.theme
    
    user.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(user)
    
    logger.info(f"User updated: {user.email}")
    
    return UserResponse(
        id=str(user.id),
        email=user.email,
        workspace_name=user.workspace_name,
        role=user.role,
        created_at=user.created_at,
        updated_at=user.updated_at,
        api_key=user.api_key,
        provider=user.provider,
        custom_endpoint=user.custom_endpoint,
        default_model=user.default_model,
        theme=user.theme,
        is_owner=user.is_owner,
        is_admin=user.is_admin,
        can_create_agents=user.can_create_agents,
        can_configure_tokens=user.can_configure_tokens,
    )


# ============================================
# DELETE USER
# ============================================

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["users"])
async def delete_user(
    user_id: str,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Delete a user"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    current_user_id = payload.get("sub")
    
    # Check permissions (only owner can delete users)
    result = await db.execute(
        select(User).where(User.id == current_user_id)
    )
    current_user = result.scalar_one_or_none()
    
    if not current_user or not current_user.is_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    # Find and delete user
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    await db.delete(user)
    await db.commit()
    
    logger.info(f"User deleted: {user.email}")
