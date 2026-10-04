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

    # ============================================
    # DOMAIN HELPERS (usados por los routers)
    # ============================================

    @staticmethod
    def _status_value(status) -> str:
        return status.value if hasattr(status, "value") else str(status)

    async def broadcast_mission_update(self, mission) -> None:
        """Notify mission changes to its workspace"""
        try:
            await self.send_to_workspace(str(mission.workspace_id), {
                "type": "mission.updated",
                "mission_id": str(mission.id),
                "title": mission.title,
                "status": self._status_value(mission.status),
                "progress": float(mission.progress or 0),
                "timestamp": datetime.utcnow().isoformat(),
            })
        except Exception as e:
            logger.error(f"broadcast_mission_update error: {e}")

    async def broadcast_office_state(self, workspace_id: str) -> None:
        """Notify that the office state changed (clients refetch)"""
        try:
            await self.send_to_workspace(str(workspace_id), {
                "type": "office.refresh",
                "workspace_id": str(workspace_id),
                "timestamp": datetime.utcnow().isoformat(),
            })
        except Exception as e:
            logger.error(f"broadcast_office_state error: {e}")

    async def broadcast_skill_update(self, skill) -> None:
        """Notify skill changes to its workspace"""
        try:
            await self.send_to_workspace(str(skill.workspace_id), {
                "type": "skill.updated",
                "skill_id": str(skill.id),
                "name": skill.name,
                "timestamp": datetime.utcnow().isoformat(),
            })
        except Exception as e:
            logger.error(f"broadcast_skill_update error: {e}")

    async def broadcast_webhook_event(
        self,
        webhook_id: str,
        event_type: str,
        data: dict,
        workspace_id: str,
    ) -> None:
        """Notify webhook event to its workspace"""
        try:
            await self.send_to_workspace(str(workspace_id), {
                "type": "webhook.event",
                "webhook_id": str(webhook_id),
                "event": event_type,
                "data": data or {},
                "timestamp": datetime.utcnow().isoformat(),
            })
        except Exception as e:
            logger.error(f"broadcast_webhook_event error: {e}")


# Create global WebSocket manager instance
websocket_manager = WebSocketManager()

# Import json for message serialization
import json
from datetime import datetime
