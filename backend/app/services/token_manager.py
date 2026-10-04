"""
Token Manager Service
Tracks token usage and manages budgets
"""

from typing import Optional, Dict, Any, List
import logging
from datetime import datetime, timedelta

from ..models.token_usage import TokenUsage
from ..models.workspace import Workspace
from ..models.agent import Agent
from ..config.database import AsyncSessionLocal
from ..services.llm import llm_service

logger = logging.getLogger(__name__)


class TokenManager:
    """Service for managing token usage and budgets"""
    
    def __init__(self):
        self.initialized = False
        self.usage_cache: Dict[str, int] = {}  # workspace_id -> tokens used
        self.budget_alerts: Dict[str, bool] = {}  # workspace_id -> alert sent
    
    async def initialize(self):
        """Initialize token manager"""
        if self.initialized:
            return
        
        self.initialized = True
        logger.info("Token manager initialized")
    
    async def track_usage(
        self,
        workspace_id: str,
        agent_id: Optional[str] = None,
        model: str = "",
        provider: str = "",
        tokens_used: int = 0,
        cost: float = 0.0,
        task_id: Optional[str] = None,
        user_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """Track token usage"""
        async with AsyncSessionLocal() as db:
            # Create token usage record
            usage = TokenUsage(
                workspace_id=workspace_id,
                agent_id=agent_id,
                model=model,
                provider=provider,
                tokens_used=tokens_used,
                cost=cost,
                task_id=task_id,
                user_id=user_id,
                metadata=metadata,
            )
            db.add(usage)
            await db.commit()
            
            # Update cache
            self.usage_cache[workspace_id] = self.usage_cache.get(workspace_id, 0) + tokens_used
            
            # Check budget
            await self._check_budget(workspace_id)
            
            logger.info(f"Token usage tracked: {tokens_used} tokens, ${cost:.4f}")
            
            return usage
    
    async def _check_budget(self, workspace_id: str):
        """Check if workspace is approaching or exceeding budget"""
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Workspace).where(Workspace.id == workspace_id)
            )
            workspace = result.scalar_one_or_none()
            
            if not workspace or not workspace.token_budget:
                return
            
            # Get total tokens used
            result = await db.execute(
                select(TokenUsage.tokens_used).where(TokenUsage.workspace_id == workspace_id)
            )
            total_used = sum(row.tokens_used for row in result.scalars().all())
            
            # Check thresholds
            threshold_80 = workspace.token_budget * 0.8
            threshold_95 = workspace.token_budget * 0.95
            
            if total_used >= workspace.token_budget:
                # Budget exceeded
                if not self.budget_alerts.get(workspace_id):
                    logger.warning(f"Workspace {workspace_id} exceeded budget: {total_used}/{workspace.token_budget}")
                    self.budget_alerts[workspace_id] = True
                    # Trigger alert
                    await self._send_budget_alert(workspace_id, total_used, workspace.token_budget)
            elif total_used >= threshold_95:
                # 95% warning
                if not self.budget_alerts.get(workspace_id):
                    logger.warning(f"Workspace {workspace_id} at 95% budget: {total_used}/{workspace.token_budget}")
                    self.budget_alerts[workspace_id] = True
            elif total_used >= threshold_80:
                # 80% warning
                if not self.budget_alerts.get(workspace_id):
                    logger.warning(f"Workspace {workspace_id} at 80% budget: {total_used}/{workspace.token_budget}")
    
    async def _send_budget_alert(self, workspace_id: str, used: int, budget: int):
        """Send budget alert notification"""
        # This would send an email, webhook, or other notification
        logger.warning(f"BUDGET ALERT: Workspace {workspace_id} used {used}/{budget} tokens")
    
    async def get_usage_stats(self, workspace_id: str) -> Dict[str, Any]:
        """Get token usage statistics for a workspace"""
        async with AsyncSessionLocal() as db:
            # Get total tokens used
            result = await db.execute(
                select(TokenUsage.tokens_used).where(TokenUsage.workspace_id == workspace_id)
            )
            total_tokens = sum(row.tokens_used for row in result.scalars().all())
            
            # Get tokens by provider
            result = await db.execute(
                select(TokenUsage.provider, TokenUsage.tokens_used)
                .where(TokenUsage.workspace_id == workspace_id)
                .group_by(TokenUsage.provider)
            )
            by_provider = {row.provider: row.tokens_used for row in result.all()}
            
            # Get tokens by model
            result = await db.execute(
                select(TokenUsage.model, TokenUsage.tokens_used)
                .where(TokenUsage.workspace_id == workspace_id)
                .group_by(TokenUsage.model)
            )
            by_model = {row.model: row.tokens_used for row in result.all()}
            
            # Get total cost
            result = await db.execute(
                select(TokenUsage.cost).where(TokenUsage.workspace_id == workspace_id)
            )
            total_cost = sum(row.cost for row in result.scalars().all())
            
            # Get workspace budget
            result = await db.execute(
                select(Workspace.token_budget).where(Workspace.id == workspace_id)
            )
            budget = result.scalar_one_or_none() or 0
            
            return {
                "workspace_id": workspace_id,
                "total_tokens": total_tokens,
                "total_cost": total_cost,
                "budget": budget,
                "budget_percentage": (total_tokens / budget * 100) if budget > 0 else 0,
                "by_provider": by_provider,
                "by_model": by_model,
            }
    
    async def get_recent_usage(self, workspace_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get recent token usage records"""
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(TokenUsage)
                .where(TokenUsage.workspace_id == workspace_id)
                .order_by(TokenUsage.created_at.desc())
                .limit(limit)
            )
            usages = result.scalars().all()
            
            return [
                {
                    "id": str(u.id),
                    "model": u.model,
                    "provider": u.provider,
                    "tokens_used": u.tokens_used,
                    "cost": u.cost,
                    "created_at": u.created_at.isoformat(),
                }
                for u in usages
            ]
    
    async def reset_usage(self, workspace_id: str) -> None:
        """Reset token usage for a workspace (for billing cycles)"""
        async with AsyncSessionLocal() as db:
            await db.execute(
                delete(TokenUsage).where(TokenUsage.workspace_id == workspace_id)
            )
            await db.commit()
            
            # Clear cache
            self.usage_cache.pop(workspace_id, None)
            self.budget_alerts.pop(workspace_id, None)
            
            logger.info(f"Token usage reset for workspace {workspace_id}")
    
    def calculate_cost(
        self,
        model: str,
        provider: str,
        tokens: int,
    ) -> float:
        """Calculate cost for a given model and token count"""
        return llm_service.get_provider_cost(provider, model, tokens)


# Create singleton instance
token_manager = TokenManager()
