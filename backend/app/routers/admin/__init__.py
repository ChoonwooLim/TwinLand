from fastapi import APIRouter

from .dashboard import router as dashboard_router
from .users import router as users_router
from .content import router as content_router
from .parcels import router as parcels_router
from .ai_logs import router as ai_logs_router
from .emails import router as emails_router
from .clones import router as clones_router
from .skills import router as skills_router
from .plugins import router as plugins_router
from .docs import router as docs_router
from .ops import router as ops_router


admin_router = APIRouter(prefix="/api/admin", tags=["admin"])
admin_router.include_router(dashboard_router)
admin_router.include_router(users_router)
admin_router.include_router(content_router)
admin_router.include_router(parcels_router)
admin_router.include_router(ai_logs_router)
admin_router.include_router(emails_router)
admin_router.include_router(clones_router)
admin_router.include_router(skills_router)
admin_router.include_router(plugins_router)
admin_router.include_router(docs_router)
admin_router.include_router(ops_router)
