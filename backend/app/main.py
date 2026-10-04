"""
SeeControl - Main FastAPI Application
Multi-Agent Orchestration Platform with Real-Time Office Visualization
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.lifespan import lifespan
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Dict, List
import asyncio
import json
import logging
from datetime import datetime

from .config.settings import settings
from .config.database import init_db, close_db
from .config.websocket import websocket_manager
from .api import users, agents, skills, tasks, missions, workspace, webhooks, office
from .services.auth import auth_service
from .services.llm import llm_service
from .services.orchestration import orchestration_service
from .services.token_manager import token_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# ============================================
# LIFESPAN MANAGER
# ============================================

@asynccontextmanager
async def lifespan_manager(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager for startup and shutdown events"""
    # Startup
    logger.info("Starting SeeControl application...")
    
    # Initialize database
    await init_db()
    logger.info("Database initialized")
    
    # Initialize LLM service
    await llm_service.initialize()
    logger.info("LLM service initialized")
    
    # Initialize token manager
    await token_manager.initialize()
    logger.info("Token manager initialized")
    
    # Initialize orchestration service
    await orchestration_service.initialize()
    logger.info("Orchestration service initialized")
    
    # Initialize WebSocket manager
    await websocket_manager.initialize()
    logger.info("WebSocket manager initialized")
    
    logger.info("SeeControl application started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down SeeControl application...")
    
    # Close WebSocket connections
    await websocket_manager.close_all()
    logger.info("WebSocket connections closed")
    
    # Close database
    await close_db()
    logger.info("Database closed")
    
    logger.info("SeeControl application shutdown complete")


# ============================================
# CREATE FASTAPI APP
# ============================================

app = FastAPI(
    title="SeeControl API",
    description="Multi-Agent Orchestration Platform with BYOK Support and Real-Time Pixel Art Office Visualization",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan_manager,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")


# ============================================
# INCLUDE API ROUTERS
# ============================================

# Authentication and Users
app.include_router(users.router, prefix="/api/users", tags=["users", "authentication"])

# Agents
app.include_router(agents.router, prefix="/api/agents", tags=["agents"])

# Skills
app.include_router(skills.router, prefix="/api/skills", tags=["skills"])

# Tasks
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])

# Missions
app.include_router(missions.router, prefix="/api/missions", tags=["missions"])

# Workspace
app.include_router(workspace.router, prefix="/api/workspace", tags=["workspace"])

# Webhooks
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["webhooks"])

# Office (Real-time state)
app.include_router(office.router, prefix="/api/office", tags=["office"])


# ============================================
# WEBSOCKET ENDPOINTS
# ============================================

@app.websocket("/ws/office")
async def websocket_office(websocket: WebSocket):
    """WebSocket endpoint for real-time office state updates"""
    await websocket_manager.connect(websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            if message.get("type") == "subscribe":
                workspace_id = message.get("workspace_id")
                await websocket_manager.subscribe(websocket, workspace_id)
            
            elif message.get("type") == "unsubscribe":
                workspace_id = message.get("workspace_id")
                await websocket_manager.unsubscribe(websocket, workspace_id)
            
            # Broadcast to all connected clients in the same workspace
            await websocket_manager.broadcast(message, workspace_id)
            
    except WebSocketDisconnect:
        await websocket_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket_manager.disconnect(websocket)


@app.websocket("/ws/tasks")
async def websocket_tasks(websocket: WebSocket):
    """WebSocket endpoint for real-time task updates"""
    await websocket_manager.connect(websocket, endpoint="tasks")
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            await websocket_manager.broadcast(message, workspace_id=None, endpoint="tasks")
            
    except WebSocketDisconnect:
        await websocket_manager.disconnect(websocket)


# ============================================
# HEALTH CHECK ENDPOINT
# ============================================

@app.get("/health", tags=["health"])
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "services": {
            "database": "connected",
            "llm": "initialized",
            "websocket": "active",
            "orchestration": "active",
        }
    }


@app.get("/", tags=["root"])
async def root():
    """Root endpoint with basic info"""
    return {
        "name": "SeeControl",
        "description": "Multi-Agent Orchestration Platform with BYOK Support",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }


# ============================================
# RUN WITH UVICORN
# ============================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.APP_HOST,
        port=settings.APP_PORT,
        reload=settings.APP_DEBUG,
        log_level="info",
    )
