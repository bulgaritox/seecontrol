"""
Agent Executor Service
Execution kernel for agents with reasoning loop
"""

from typing import Optional, Dict, Any, List, Tuple
import asyncio
import logging
from datetime import datetime

from ..models.agent import Agent, AgentStatus
from ..models.task import Task, TaskStatus
from ..services.llm import llm_service
from ..services.token_manager import token_manager
from ..config.database import AsyncSessionLocal
from ..config.llm import llm_config

logger = logging.getLogger(__name__)


class AgentExecutor:
    """Execution kernel for agents"""
    
    def __init__(self):
        self.initialized = False
        self.running_agents: Dict[str, bool] = {}  # agent_id -> is_running
    
    async def initialize(self):
        """Initialize agent executor"""
        if self.initialized:
            return
        
        self.initialized = True
        logger.info("Agent executor initialized")
    
    async def execute(
        self,
        agent: Agent,
        task: Task,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Execute an agent on a task
        Implements the reasoning loop with tool usage
        """
        agent_id = str(agent.id)
        task_id = str(task.id)
        
        # Mark agent as running
        self.running_agents[agent_id] = True
        
        try:
            logger.info(f"Agent {agent_id} executing task {task_id}")
            
            # Update agent status
            agent.status = AgentStatus.WORKING
            agent.current_task = task.title
            agent.current_task_id = task_id
            
            # Build the execution context
            execution_context = {
                "agent": {
                    "id": agent_id,
                    "name": agent.name,
                    "role": agent.role,
                    "skills": agent.skills,
                    "tools": agent.tools,
                    "personality": agent.personality or "",
                    "memory": agent.memory or "",
                },
                "task": {
                    "id": task_id,
                    "title": task.title,
                    "description": task.description,
                    "priority": task.priority.value,
                },
                "context": context or {},
                "workspace_id": agent.workspace_id,
                "timestamp": datetime.utcnow().isoformat(),
            }
            
            # Build the reasoning loop
            reasoning_steps = []
            total_tokens = 0
            total_cost = 0.0
            
            # Step 1: Understand the task
            understanding = await self._understand_task(agent, task, execution_context)
            reasoning_steps.append(understanding)
            total_tokens += understanding.get("tokens", 0)
            total_cost += understanding.get("cost", 0.0)
            
            # Update progress
            agent.progress = 25
            task.progress = 25
            
            # Step 2: Plan the approach
            plan = await self._plan_approach(agent, task, execution_context, understanding)
            reasoning_steps.append(plan)
            total_tokens += plan.get("tokens", 0)
            total_cost += plan.get("cost", 0.0)
            
            # Update progress
            agent.progress = 50
            task.progress = 50
            
            # Step 3: Execute the plan
            execution = await self._execute_plan(agent, task, execution_context, plan)
            reasoning_steps.append(execution)
            total_tokens += execution.get("tokens", 0)
            total_cost += execution.get("cost", 0.0)
            
            # Update progress
            agent.progress = 75
            task.progress = 75
            
            # Step 4: Review and refine
            review = await self._review_results(agent, task, execution_context, execution)
            reasoning_steps.append(review)
            total_tokens += review.get("tokens", 0)
            total_cost += review.get("cost", 0.0)
            
            # Update progress
            agent.progress = 100
            task.progress = 100
            
            # Track token usage
            await token_manager.track_usage(
                workspace_id=agent.workspace_id,
                agent_id=agent_id,
                model=agent.model or "",
                provider=agent.provider or "",
                tokens_used=total_tokens,
                cost=total_cost,
                task_id=task_id,
                user_id=agent.user_id,
                metadata={
                    "reasoning_steps": len(reasoning_steps),
                    "execution_time": str(datetime.utcnow() - execution_context["timestamp"]),
                },
            )
            
            # Mark task as completed
            task.status = TaskStatus.COMPLETED
            task.completed_at = datetime.utcnow()
            task.result = review.get("final_answer", "")
            task.tokens_used = total_tokens
            task.cost = total_cost
            
            # Mark agent as available
            agent.status = AgentStatus.IDLE
            agent.current_task = None
            agent.current_task_id = None
            
            logger.info(f"Agent {agent_id} completed task {task_id}")
            
            return {
                "status": "completed",
                "result": review.get("final_answer", ""),
                "tokens_used": total_tokens,
                "cost": total_cost,
                "reasoning_steps": reasoning_steps,
                "execution_time": str(datetime.utcnow() - execution_context["timestamp"]),
            }
            
        except Exception as e:
            logger.error(f"Agent {agent_id} failed task {task_id}: {e}")
            
            # Mark task as failed
            task.status = TaskStatus.FAILED
            task.failed_at = datetime.utcnow()
            task.result = str(e)
            
            # Mark agent as failed
            agent.status = AgentStatus.FAILED
            
            return {
                "status": "failed",
                "error": str(e),
                "tokens_used": total_tokens,
                "cost": total_cost,
            }
        
        finally:
            self.running_agents.pop(agent_id, None)
    
    async def _understand_task(
        self,
        agent: Agent,
        task: Task,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Understand the task and its requirements"""
        system_prompt = f"""
You are {agent.name}, a {agent.role} with the following personality: {agent.personality or ''}

Your skills: {', '.join(agent.skills) if agent.skills else 'None'}
Your tools: {', '.join(agent.tools) if agent.tools else 'None'}

Analyze the following task and provide:
1. A clear understanding of what needs to be done
2. The key requirements
3. Any assumptions you're making
4. Potential challenges

Task: {task.title}
Description: {task.description}

Respond in JSON format:
{{
    "understanding": "string",
    "requirements": ["string"],
    "assumptions": ["string"],
    "challenges": ["string"],
    "needs_clarification": boolean
}}
"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "Please analyze this task and provide your understanding."},
        ]
        
        model = agent.model or llm_config.default_provider
        content, tokens, provider = await llm_service.chat(
            messages,
            model=model,
            temperature=0.3,
            max_tokens=2048,
        )
        
        cost = token_manager.calculate_cost(model, provider, tokens)
        
        try:
            # Parse JSON response
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            result = json.loads(content)
            return {
                "step": "understand",
                "result": result,
                "tokens": tokens,
                "cost": cost,
                "timestamp": datetime.utcnow().isoformat(),
            }
        except:
            return {
                "step": "understand",
                "result": {"understanding": content},
                "tokens": tokens,
                "cost": cost,
                "timestamp": datetime.utcnow().isoformat(),
            }
    
    async def _plan_approach(
        self,
        agent: Agent,
        task: Task,
        context: Dict[str, Any],
        understanding: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Plan the approach to solve the task"""
        system_prompt = f"""
You are {agent.name}, a {agent.role}.

Based on your understanding of the task, plan your approach:
1. Break down the task into steps
2. Identify which tools you'll use
3. Estimate the resources needed
4. Identify any dependencies

Understanding: {understanding.get('result', {}).get('understanding', '')}

Respond in JSON format:
{{
    "steps": [
        {{
            "id": number,
            "description": "string",
            "tool": "string or null",
            "estimated_tokens": number
        }}
    ],
    "total_steps": number,
    "estimated_total_tokens": number
}}
"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "Please plan your approach to solve this task."},
        ]
        
        model = agent.model or llm_config.default_provider
        content, tokens, provider = await llm_service.chat(
            messages,
            model=model,
            temperature=0.3,
            max_tokens=2048,
        )
        
        cost = token_manager.calculate_cost(model, provider, tokens)
        
        try:
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            result = json.loads(content)
            return {
                "step": "plan",
                "result": result,
                "tokens": tokens,
                "cost": cost,
                "timestamp": datetime.utcnow().isoformat(),
            }
        except:
            return {
                "step": "plan",
                "result": {"plan": content},
                "tokens": tokens,
                "cost": cost,
                "timestamp": datetime.utcnow().isoformat(),
            }
    
    async def _execute_plan(
        self,
        agent: Agent,
        task: Task,
        context: Dict[str, Any],
        plan: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Execute the planned approach"""
        # This would implement the actual execution with tool usage
        # For now, simulate execution
        
        steps = plan.get("result", {}).get("steps", [])
        execution_results = []
        total_tokens = 0
        total_cost = 0.0
        
        for step in steps:
            step_result = await self._execute_step(agent, task, context, step)
            execution_results.append(step_result)
            total_tokens += step_result.get("tokens", 0)
            total_cost += step_result.get("cost", 0.0)
        
        return {
            "step": "execute",
            "result": {
                "step_results": execution_results,
                "completed_steps": len(execution_results),
            },
            "tokens": total_tokens,
            "cost": total_cost,
            "timestamp": datetime.utcnow().isoformat(),
        }
    
    async def _execute_step(
        self,
        agent: Agent,
        task: Task,
        context: Dict[str, Any],
        step: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Execute a single step in the plan"""
        # Simulate step execution
        await asyncio.sleep(0.5)
        
        return {
            "step_id": step.get("id", 0),
            "description": step.get("description", ""),
            "status": "completed",
            "result": f"Executed: {step.get('description', '')}",
            "tokens": step.get("estimated_tokens", 100),
            "cost": 0.0,
        }
    
    async def _review_results(
        self,
        agent: Agent,
        task: Task,
        context: Dict[str, Any],
        execution: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Review and refine the results"""
        system_prompt = f"""
You are {agent.name}, a {agent.role}.

Review the execution results and provide:
1. A summary of what was accomplished
2. Whether the task is complete
3. Any follow-up actions needed
4. The final answer or deliverable

Execution Results: {json.dumps(execution.get('result', {}), indent=2)}

Respond in JSON format:
{{
    "summary": "string",
    "is_complete": boolean,
    "follow_up_actions": ["string"],
    "final_answer": "string",
    "quality_score": number
}}
"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "Please review the execution results and provide your final assessment."},
        ]
        
        model = agent.model or llm_config.default_provider
        content, tokens, provider = await llm_service.chat(
            messages,
            model=model,
            temperature=0.3,
            max_tokens=2048,
        )
        
        cost = token_manager.calculate_cost(model, provider, tokens)
        
        try:
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            result = json.loads(content)
            return {
                "step": "review",
                "result": result,
                "tokens": tokens,
                "cost": cost,
                "timestamp": datetime.utcnow().isoformat(),
            }
        except:
            return {
                "step": "review",
                "result": {"final_answer": content},
                "tokens": tokens,
                "cost": cost,
                "timestamp": datetime.utcnow().isoformat(),
            }


# Import json for JSON parsing
import json

# Create singleton instance
agent_executor = AgentExecutor()
