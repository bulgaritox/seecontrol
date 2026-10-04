"""
Orchestration Service
Master AI orchestrator that decomposes objectives and coordinates agents
"""

from typing import Optional, Dict, Any, List, Tuple
from enum import Enum
import json
import logging
from datetime import datetime
import asyncio
from sqlalchemy import select

from ..models.agent import Agent, AgentStatus
from ..models.task import Task, TaskStatus, TaskPriority
from ..models.workspace import Workspace, EscalationPolicy, MemoryScope
from ..services.llm import llm_service
from ..services.token_manager import token_manager
from ..config.database import AsyncSessionLocal
from ..config.settings import settings

logger = logging.getLogger(__name__)


class OrchestrationStrategy(str, Enum):
    """Orchestration strategies"""
    CENTRALIZED = "centralized"
    HIERARCHICAL = "hierarchical"
    HYBRID = "hybrid"


class OrchestrationService:
    """Service for orchestrating agents and tasks"""
    
    def __init__(self):
        self.initialized = False
        self.running_tasks: Dict[str, asyncio.Task] = {}
        self.workspace_configs: Dict[str, Dict[str, Any]] = {}
    
    async def initialize(self):
        """Initialize orchestration service"""
        if self.initialized:
            return
        
        self.initialized = True
        logger.info("Orchestration service initialized")
    
    async def close(self):
        """Clean up running tasks"""
        for task_id, task in self.running_tasks.items():
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        self.running_tasks.clear()
        logger.info("Orchestration service closed")
    
    async def plan_workflow(
        self,
        objective: str,
        workspace_id: str,
        user_id: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Plan a workflow based on the objective
        Uses the Master AI to decompose the objective into tasks
        """
        # Get workspace configuration
        workspace_config = await self._get_workspace_config(workspace_id)
        
        # Build prompt for workflow planning
        system_prompt = """
You are the Master AI Orchestrator. Your role is to decompose complex objectives into 
manageable tasks that can be executed by specialized AI agents.

Analyze the objective and break it down into:
1. A clear goal statement
2. A list of subtasks with dependencies
3. Required skills for each subtask
4. Suggested agent assignments
5. Estimated token usage for each subtask

Consider the following available agent types:
- Copywriter: Writing, editing, content creation, SEO
- Developer: Coding, debugging, system architecture
- Designer: Image generation, graphic design, UI/UX
- Data Analyst: Data analysis, statistics, visualization
- Researcher: Web search, information gathering, fact checking
- Layout Assistant: Organization, structure, visual layout
- Orchestrator: Coordination, strategy, management
- Generalist: Multi-purpose, adaptation, problem solving

Return your response in JSON format with the following structure:
{
    "goal": "string",
    "tasks": [
        {
            "id": "number",
            "title": "string",
            "description": "string",
            "priority": "low|medium|high|urgent",
            "required_skills": ["string"],
            "suggested_agent_type": "string",
            "estimated_tokens": number,
            "dependencies": [number]
        }
    ],
    "total_estimated_tokens": number,
    "suggested_workflow": "string"
}
"""
        
        user_prompt = f"Objective: {objective}\n\nPlease plan the workflow for achieving this objective."
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        
        try:
            # Use the configured master AI model
            model = workspace_config.get("master_ai_model", settings.MASTER_AI_MODEL)
            
            content, tokens, provider = await llm_service.chat(
                messages,
                model=model,
                temperature=0.3,  # More deterministic for planning
                max_tokens=4096,
            )
            
            # Parse the JSON response
            try:
                # Try to extract JSON from the response
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0]
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0]
                
                plan = json.loads(content)
                plan["provider"] = provider
                plan["tokens_used"] = tokens
                plan["planned_at"] = datetime.utcnow().isoformat()
                
                logger.info(f"Workflow planned: {objective[:50]}...")
                return plan
                
            except json.JSONDecodeError:
                logger.error(f"Failed to parse workflow plan: {content}")
                # Return a default plan
                return {
                    "goal": objective,
                    "tasks": [
                        {
                            "id": 1,
                            "title": "Analyze objective",
                            "description": "Analyze the objective and determine the best approach",
                            "priority": "high",
                            "required_skills": ["research"],
                            "suggested_agent_type": "researcher",
                            "estimated_tokens": 1000,
                            "dependencies": [],
                        }
                    ],
                    "total_estimated_tokens": 1000,
                    "suggested_workflow": "Sequential execution",
                    "provider": provider,
                    "tokens_used": tokens,
                    "planned_at": datetime.utcnow().isoformat(),
                }
                
        except Exception as e:
            logger.error(f"Error planning workflow: {e}")
            raise
    
    async def execute_workflow(
        self,
        workflow_plan: Dict[str, Any],
        workspace_id: str,
        user_id: str,
    ) -> Dict[str, Any]:
        """
        Execute a planned workflow
        Creates tasks and assigns them to appropriate agents
        """
        async with AsyncSessionLocal() as db:
            # Get available agents
            result = await db.execute(
                select(Agent).where(Agent.workspace_id == workspace_id)
            )
            agents = result.scalars().all()
            
            # Create tasks from the plan
            created_tasks = []
            for task_data in workflow_plan.get("tasks", []):
                task = Task(
                    title=task_data.get("title", "Untitled Task"),
                    description=task_data.get("description", ""),
                    priority=TaskPriority(task_data.get("priority", "medium")),
                    status=TaskStatus.PENDING,
                    progress=0.0,
                    dependencies=task_data.get("dependencies", []),
                    user_id=user_id,
                    workspace_id=workspace_id,
                    metadata={
                        "required_skills": task_data.get("required_skills", []),
                        "suggested_agent_type": task_data.get("suggested_agent_type", "generalist"),
                        "estimated_tokens": task_data.get("estimated_tokens", 0),
                        "workflow_id": workflow_plan.get("id", ""),
                    },
                )
                db.add(task)
                created_tasks.append(task)
            
            await db.commit()
            
            # Assign agents to tasks
            for task in created_tasks:
                await self._assign_agent_to_task(task, agents, db)
            
            await db.commit()
            
            logger.info(f"Workflow execution started: {len(created_tasks)} tasks created")
            
            return {
                "status": "started",
                "tasks_created": len(created_tasks),
                "task_ids": [str(t.id) for t in created_tasks],
                "workspace_id": workspace_id,
            }
    
    async def _assign_agent_to_task(
        self,
        task: Task,
        available_agents: List[Agent],
        db: AsyncSessionLocal,
    ):
        """Assign an appropriate agent to a task"""
        metadata = task.task_metadata or {}
        required_skills = metadata.get("required_skills", [])
        suggested_agent_type = metadata.get("suggested_agent_type", "generalist")
        
        # Find the best agent for this task
        best_agent = None
        best_score = -1
        
        for agent in available_agents:
            if not agent.is_available:
                continue
            
            score = 0
            
            # Check if agent has required skills
            for skill in required_skills:
                if skill in agent.skills:
                    score += 10
            
            # Check if agent matches suggested type
            if agent.character_type == suggested_agent_type:
                score += 5
            
            # Check if agent has any matching skills
            if set(agent.skills) & set(required_skills):
                score += 3
            
            if score > best_score:
                best_score = score
                best_agent = agent
        
        # If no agent found with skills, use any available agent
        if not best_agent:
            for agent in available_agents:
                if agent.is_available:
                    best_agent = agent
                    break
        
        if best_agent:
            task.agent_id = str(best_agent.id)
            task.status = TaskStatus.IN_PROGRESS
            best_agent.status = AgentStatus.WORKING
            best_agent.current_task = task.title
            best_agent.current_task_id = str(task.id)
            
            logger.info(f"Assigned task {task.id} to agent {best_agent.id}")
            
            # Start the agent execution
            asyncio.create_task(self._execute_agent(best_agent, task))
    
    async def _execute_agent(self, agent: Agent, task: Task):
        """Execute an agent on a task"""
        task_id = str(task.id)
        agent_id = str(agent.id)
        
        try:
            logger.info(f"Agent {agent_id} starting task {task_id}")
            
            # Update agent status
            agent.status = AgentStatus.WORKING
            agent.current_task = task.title
            
            # Execute the task using the agent executor
            # This would be implemented in agent_executor.py
            
            # For now, simulate work
            await asyncio.sleep(2)
            
            # Update progress
            agent.progress = 50
            task.progress = 50
            
            await asyncio.sleep(2)
            
            # Complete task
            agent.progress = 100
            task.progress = 100
            task.status = TaskStatus.COMPLETED
            agent.status = AgentStatus.IDLE
            agent.current_task = None
            agent.current_task_id = None
            
            logger.info(f"Agent {agent_id} completed task {task_id}")
            
        except Exception as e:
            logger.error(f"Agent {agent_id} failed task {task_id}: {e}")
            task.status = TaskStatus.FAILED
            agent.status = AgentStatus.FAILED
    
    async def _get_workspace_config(self, workspace_id: str) -> Dict[str, Any]:
        """Get workspace configuration"""
        if workspace_id in self.workspace_configs:
            return self.workspace_configs[workspace_id]
        
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Workspace).where(Workspace.id == workspace_id)
            )
            workspace = result.scalar_one_or_none()
            
            if workspace:
                config = {
                    "master_ai_model": workspace.master_ai_model or settings.MASTER_AI_MODEL,
                    "default_provider": workspace.default_provider or settings.DEFAULT_PROVIDER,
                    "strategy": workspace.strategy or "hierarchical",
                    "max_parallel_agents": workspace.max_parallel_agents or settings.MAX_PARALLEL_AGENTS,
                    "token_budget": workspace.token_budget or settings.TOKEN_BUDGET,
                    "escalation_policy": workspace.escalation_policy.value if workspace.escalation_policy else settings.ESCALATION_POLICY,
                    "heartbeat_interval": workspace.heartbeat_interval or settings.HEARTBEAT_INTERVAL,
                    "memory_scope": workspace.memory_scope.value if workspace.memory_scope else settings.MEMORY_SCOPE,
                }
                self.workspace_configs[workspace_id] = config
                return config
        
        return {
            "master_ai_model": settings.MASTER_AI_MODEL,
            "default_provider": settings.DEFAULT_PROVIDER,
            "strategy": "hierarchical",
            "max_parallel_agents": settings.MAX_PARALLEL_AGENTS,
            "token_budget": settings.TOKEN_BUDGET,
            "escalation_policy": settings.ESCALATION_POLICY,
            "heartbeat_interval": settings.HEARTBEAT_INTERVAL,
            "memory_scope": settings.MEMORY_SCOPE,
        }
    
    async def get_office_state(self, workspace_id: str) -> Dict[str, Any]:
        """Get the current state of the office (all agents and their status)"""
        async with AsyncSessionLocal() as db:
            # Get all agents in workspace
            result = await db.execute(
                select(Agent).where(Agent.workspace_id == workspace_id)
            )
            agents = result.scalars().all()
            
            # Get workspace theme
            result = await db.execute(
                select(Workspace).where(Workspace.id == workspace_id)
            )
            workspace = result.scalar_one_or_none()
            
            return {
                "agents": [agent.to_office_state() for agent in agents],
                "theme": workspace.theme if workspace else "pixel",
                "workspace_id": workspace_id,
                "last_updated": datetime.utcnow().isoformat(),
            }


# Create singleton instance
orchestration_service = OrchestrationService()
