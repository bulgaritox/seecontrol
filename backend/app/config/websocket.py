"""
WebSocket Configuration
Real-time communication for office state updates
"""

from pydantic import BaseModel
from typing import Dict, Set, Optional
from collections import defaultdict
import asyncio
import logging
from fastapi import WebSocket

from .settings import settings

logger = logging.getLogger(__name__)


class WebSocketConfig(BaseModel):
    """WebSocket configuration"""
    host: str = settings.WS_HOST
    port: int = settings.WS_PORT
    ping_interval: int = settings.WS_PING_INTERVAL
    max_connections: int = settings.WS_MAX_CONNECTIONS


websocket_config = WebSocketConfig()


class WebSocketManager:
    """Manager for WebSocket connections and broadcasting"""
    
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = defaultdict(set)
        self.endpoint_connections: Dict[str, Set[WebSocket]] = defaultdict(set)
        self.lock = asyncio.Lock()
        self.running = False
        self.ping_task: Optional[asyncio.Task] = None
    
    async def initialize(self):
        """Initialize WebSocket manager"""
        self.running = True
        self.ping_task = asyncio.create_task(self._ping_connections())
        logger.info("WebSocket manager initialized")
    
    async def close_all(self):
        """Close all WebSocket connections"""
        self.running = False
        if self.ping_task:
            self.ping_task.cancel()
            try:
                await self.ping_task
            except asyncio.CancelledError:
                pass
        
        async with self.lock:
            all_connections = set()
            for connections in self.active_connections.values():
                all_connections.update(connections)
            for connections in self.endpoint_connections.values():
                all_connections.update(connections)
            
            for websocket in all_connections:
                try:
                    await websocket.close(code=1001)
                except Exception as e:
                    logger.error(f"Error closing WebSocket: {e}")
            
            self.active_connections.clear()
            self.endpoint_connections.clear()
        
        logger.info("All WebSocket connections closed")
    
    async def _ping_connections(self):
        """Send ping to all connections periodically"""
        while self.running:
            await asyncio.sleep(websocket_config.ping_interval)
            async with self.lock:
                for workspace_id, connections in self.active_connections.items():
                    for websocket in list(connections):
                        try:
                            await websocket.send_text(json.dumps({
                                "type": "ping",
                                "timestamp": datetime.utcnow().isoformat(),
                            }))
                        except Exception as e:
                            logger.error(f"Ping error: {e}")
                            connections.discard(websocket)
    
    async def connect(self, websocket: WebSocket, workspace_id: Optional[str] = None, endpoint: str = "office"):
        """Add a new WebSocket connection"""
        await websocket.accept()
        
        async with self.lock:
            if workspace_id:
                self.active_connections[workspace_id].add(websocket)
            self.endpoint_connections[endpoint].add(websocket)
        
        logger.info(f"WebSocket connected: {workspace_id or 'no workspace'}, endpoint: {endpoint}")
    
    async def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection"""
        async with self.lock:
            for workspace_id, connections in self.active_connections.items():
                if websocket in connections:
                    connections.discard(websocket)
                    if not connections:
                        del self.active_connections[workspace_id]
            
            for endpoint, connections in self.endpoint_connections.items():
                if websocket in connections:
                    connections.discard(websocket)
                    if not connections:
                        del self.endpoint_connections[endpoint]
        
        logger.info("WebSocket disconnected")
    
    async def subscribe(self, websocket: WebSocket, workspace_id: str):
        """Subscribe to a workspace"""
        async with self.lock:
            self.active_connections[workspace_id].add(websocket)
        logger.info(f"Subscribed to workspace: {workspace_id}")
    
    async def unsubscribe(self, websocket: WebSocket, workspace_id: str):
        """Unsubscribe from a workspace"""
        async with self.lock:
            if workspace_id in self.active_connections:
                self.active_connections[workspace_id].discard(websocket)
        logger.info(f"Unsubscribed from workspace: {workspace_id}")
    
    async def broadcast(self, message: dict, workspace_id: Optional[str] = None, endpoint: str = "office"):
        """Broadcast message to all connections in a workspace or endpoint"""
        async with self.lock:
            targets = set()
            
            if workspace_id:
                targets.update(self.active_connections.get(workspace_id, set()))
            else:
                targets.update(self.endpoint_connections.get(endpoint, set()))
            
            for websocket in targets:
                try:
                    await websocket.send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Broadcast error: {e}")
                    # Remove failed connection
                    if workspace_id:
                        self.active_connections[workspace_id].discard(websocket)
                    self.endpoint_connections[endpoint].discard(websocket)
        
        logger.debug(f"Broadcast message to {len(targets)} connections")
    
    async def send_to_workspace(self, workspace_id: str, message: dict):
        """Send message to all connections in a workspace"""
        await self.broadcast(message, workspace_id=workspace_id)
    
    async def send_to_endpoint(self, endpoint: str, message: dict):
        """Send message to all connections in an endpoint"""
        await self.broadcast(message, endpoint=endpoint)


# Create global WebSocket manager instance
websocket_manager = WebSocketManager()

# Import json for message serialization
import json
from datetime import datetime
