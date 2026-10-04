# API Routers
from .users import router as users_router
from .agents import router as agents_router
from .skills import router as skills_router
from .tasks import router as tasks_router
from .missions import router as missions_router
from .workspace import router as workspace_router
from .webhooks import router as webhooks_router
from .office import router as office_router

__all__ = [
    "users_router",
    "agents_router",
    "skills_router",
    "tasks_router",
    "missions_router",
    "workspace_router",
    "webhooks_router",
    "office_router",
]

# Import all routers to ensure they are registered
def register_all_routers(app):
    """Helper function to register all API routers"""
    from . import users, agents, skills, tasks, missions, workspace, webhooks, office
    return [
        users.router,
        agents.router,
        skills.router,
        tasks.router,
        missions.router,
        workspace.router,
        webhooks.router,
        office.router,
    ]
