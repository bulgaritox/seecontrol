"""
Tasks API Router
Handles CRUD operations for tasks
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select, count
from sqlalchemy import or_, and_, desc
from typing import List, Optional
from datetime import datetime
import logging

from ..models.task import Task, TaskStatus, TaskPriority
from ..models.agent import Agent, AgentStatus
from ..models.user import User
from ..models.workspace import Workspace
from ..schemas.task import TaskCreate, TaskUpdate, TaskResponse, TaskListResponse
from ..services.auth import auth_service
from ..services.orchestration import orchestration_service
from ..services.token_manager import token_manager
from ..config.database import get_db
from ..config.websocket import websocket_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tasks", tags=["tasks"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="users/login")


# ============================================
# LIST TASKS
# ============================================

@router.get("/", response_model=TaskListResponse)
async def list_tasks(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
    workspace_id: Optional[str] = None,
    status: Optional[TaskStatus] = None,
    priority: Optional[TaskPriority] = None,
    agent_id: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
):
    """List all tasks with optional filtering"""
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
    query = select(Task)
    
    # Filter by workspace
    if workspace_id:
        query = query.where(Task.workspace_id == workspace_id)
    else:
        # Only show tasks from user's workspaces
        result = await db.execute(
            select(Workspace.id).where(Workspace.user_id == user_id)
        )
        workspace_ids = [row.id for row in result.scalars().all()]
        if workspace_ids:
            query = query.where(Task.workspace_id.in_(workspace_ids))
    
    # Filter by status
    if status:
        query = query.where(Task.status == status)
    
    # Filter by priority
    if priority:
        query = query.where(Task.priority == priority)
    
    # Filter by agent
    if agent_id:
        query = query.where(Task.agent_id == agent_id)
    
    # Order by created_at descending
    query = query.order_by(desc(Task.created_at))
    
    # Get total count
    count_query = select(count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar_one()
    
    # Get paginated results
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    tasks = result.scalars().all()
    
    return TaskListResponse(
        tasks=[
            TaskResponse(
                id=str(t.id),
                title=t.title,
                description=t.description,
                priority=t.priority,
                status=t.status,
                progress=t.progress,
                agent_id=t.agent_id,
                dependencies=t.dependencies,
                result=t.result,
                tokens_used=t.tokens_used,
                cost=t.cost,
                started_at=t.started_at,
                completed_at=t.completed_at,
                user_id=str(t.user_id),
                workspace_id=str(t.workspace_id),
                created_at=t.created_at,
                updated_at=t.updated_at,
                is_complete=t.is_complete,
                is_in_progress=t.is_in_progress,
                is_blocked=t.is_blocked,
                has_dependencies=t.has_dependencies,
            )
            for t in tasks
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


# ============================================
# GET TASK BY ID
# ============================================

@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific task by ID"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get task
    result = await db.execute(
        select(Task).where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Check permissions
    if task.user_id != user_id:
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user or not user.is_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    return TaskResponse(
        id=str(task.id),
        title=task.title,
        description=task.description,
        priority=task.priority,
        status=task.status,
        progress=task.progress,
        agent_id=task.agent_id,
        dependencies=task.dependencies,
        result=task.result,
        tokens_used=task.tokens_used,
        cost=task.cost,
        started_at=task.started_at,
        completed_at=task.completed_at,
        user_id=str(task.user_id),
        workspace_id=str(task.workspace_id),
        created_at=task.created_at,
        updated_at=task.updated_at,
        is_complete=task.is_complete,
        is_in_progress=task.is_in_progress,
        is_blocked=task.is_blocked,
        has_dependencies=task.has_dependencies,
    )


# ============================================
# CREATE TASK
# ============================================

@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_data: TaskCreate,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Create a new task"""
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
    
    # Get default workspace
    result = await db.execute(
        select(Workspace).where(Workspace.user_id == user_id).limit(1)
    )
    workspace = result.scalar_one_or_none()
    
    if not workspace:
        # Create default workspace
        workspace = Workspace(
            name=f"{user.workspace_name}-workspace",
            user_id=user_id,
        )
        db.add(workspace)
        await db.commit()
        await db.refresh(workspace)
    
    # Create task
    task = Task(
        title=task_data.title,
        description=task_data.description,
        priority=task_data.priority or TaskPriority.MEDIUM,
        status=TaskStatus.PENDING,
        progress=0.0,
        agent_id=task_data.agent_id,
        dependencies=task_data.dependencies or [],
        user_id=user_id,
        workspace_id=str(workspace.id),
    )
    
    db.add(task)
    await db.commit()
    await db.refresh(task)
    
    # If agent_id is provided, assign to agent
    if task_data.agent_id:
        result = await db.execute(
            select(Agent).where(Agent.id == task_data.agent_id)
        )
        agent = result.scalar_one_or_none()
        
        if agent:
            task.agent_id = task_data.agent_id
            agent.status = AgentStatus.WORKING
            agent.current_task = task.title
            agent.current_task_id = str(task.id)
            
            await db.commit()
            
            # Start execution in background
            background_tasks = BackgroundTasks()
            background_tasks.add_task(
                orchestration_service.execute_workflow,
                {"tasks": [{
                    "id": 1,
                    "title": task.title,
                    "description": task.description,
                    "priority": task.priority.value,
                }]},
                str(workspace.id),
                user_id,
            )
    
    logger.info(f"Task created: {task.title} (ID: {task.id})")
    
    return TaskResponse(
        id=str(task.id),
        title=task.title,
        description=task.description,
        priority=task.priority,
        status=task.status,
        progress=task.progress,
        agent_id=task.agent_id,
        dependencies=task.dependencies,
        result=task.result,
        tokens_used=task.tokens_used,
        cost=task.cost,
        started_at=task.started_at,
        completed_at=task.completed_at,
        user_id=str(task.user_id),
        workspace_id=str(task.workspace_id),
        created_at=task.created_at,
        updated_at=task.updated_at,
        is_complete=task.is_complete,
        is_in_progress=task.is_in_progress,
        is_blocked=task.is_blocked,
        has_dependencies=task.has_dependencies,
    )


# ============================================
# UPDATE TASK
# ============================================

@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    task_data: TaskUpdate,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing task"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get task
    result = await db.execute(
        select(Task).where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Check permissions
    if task.user_id != user_id:
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user or not user.is_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    # Update task
    if task_data.title:
        task.title = task_data.title
    if task_data.description:
        task.description = task_data.description
    if task_data.priority:
        task.priority = task_data.priority
    if task_data.status:
        task.status = task_data.status
    if task_data.progress is not None:
        task.progress = task_data.progress
    if task_data.agent_id is not None:
        task.agent_id = task_data.agent_id
    if task_data.dependencies is not None:
        task.dependencies = task_data.dependencies
    
    task.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(task)
    
    # Update agent if assigned
    if task.agent_id:
        result = await db.execute(
            select(Agent).where(Agent.id == task.agent_id)
        )
        agent = result.scalar_one_or_none()
        
        if agent:
            agent.current_task = task.title
            agent.current_task_id = str(task.id)
            
            if task.status == TaskStatus.COMPLETED:
                agent.status = AgentStatus.IDLE
                agent.current_task = None
                agent.current_task_id = None
            elif task.status == TaskStatus.IN_PROGRESS:
                agent.status = AgentStatus.WORKING
            elif task.status == TaskStatus.BLOCKED:
                agent.status = AgentStatus.BLOCKED
            
            await db.commit()
    
    # Broadcast update
    office_state = await orchestration_service.get_office_state(task.workspace_id)
    await websocket_manager.send_to_workspace(
        task.workspace_id,
        {
            "type": "task.update",
            "data": task.to_office_update(),
            "timestamp": datetime.utcnow().isoformat(),
        }
    )
    
    logger.info(f"Task updated: {task.title} (ID: {task.id})")
    
    return TaskResponse(
        id=str(task.id),
        title=task.title,
        description=task.description,
        priority=task.priority,
        status=task.status,
        progress=task.progress,
        agent_id=task.agent_id,
        dependencies=task.dependencies,
        result=task.result,
        tokens_used=task.tokens_used,
        cost=task.cost,
        started_at=task.started_at,
        completed_at=task.completed_at,
        user_id=str(task.user_id),
        workspace_id=str(task.workspace_id),
        created_at=task.created_at,
        updated_at=task.updated_at,
        is_complete=task.is_complete,
        is_in_progress=task.is_in_progress,
        is_blocked=task.is_blocked,
        has_dependencies=task.has_dependencies,
    )


# ============================================
# DELETE TASK
# ============================================

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: str,
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
):
    """Delete a task"""
    # Verify token
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    user_id = payload.get("sub")
    
    # Get task
    result = await db.execute(
        select(Task).where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    
    # Check permissions
    if task.user_id != user_id:
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user or not user.is_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    
    # If task has an assigned agent, clear the assignment
    if task.agent_id:
        result = await db.execute(
            select(Agent).where(Agent.id == task.agent_id)
        )
        agent = result.scalar_one_or_none()
        
        if agent:
            agent.status = AgentStatus.IDLE
            agent.current_task = None
            agent.current_task_id = None
            await db.commit()
    
    await db.delete(task)
    await db.commit()
    
    logger.info(f"Task deleted: {task.title} (ID: {task.id})")
