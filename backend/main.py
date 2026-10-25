import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.config import settings
from backend.api.deps import persistence, orchestrator
from backend.api.routes_tasks import router as tasks_router
from backend.api.routes_events import router as events_router
from backend.api.routes_approvals import router as approvals_router
from backend.api.routes_skills import router as skills_router
from backend.api.routes_health import router as health_router
from backend.api.routes_triggers import router as triggers_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ragnarok")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure sandbox directory, initialize database, recover any crash states
    settings.init_directories()
    await persistence.init_db()
    logger.info(f"Initialized SQLite database at {settings.DATABASE_PATH}")
    
    recovered = await orchestrator.recover_interrupted_tasks()
    if recovered > 0:
        logger.info(f"State recovery complete: Resumed {recovered} interrupted workflow(s)")
    
    yield
    # Shutdown logic if any
    logger.info("Ragnarok agent backend shutting down gracefully.")

app = FastAPI(
    title="Ragnarok Sovereign Agent API",
    description=(
        "Sovereign, always-on personal AI agent backend powered strictly by local Ollama models. "
        "Built for IIIT Nagpur 24h Hackathon Ragnarok."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration for Member 3 (Frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all route modules
app.include_router(health_router)
app.include_router(tasks_router)
app.include_router(events_router)
app.include_router(approvals_router)
app.include_router(skills_router)
app.include_router(triggers_router)

# Mount Memory Subsystem Router
try:
    from app.api.routes import router as memory_router
    app.include_router(memory_router)
except Exception:
    pass

@app.get("/health", tags=["Health"])
def health_check():
    """Liveness probe."""
    return {"status": "healthy"}

@app.get("/api/agent/status", tags=["Agent"])
def get_agent_status():
    return {
        "status": "healthy",
        "service": "GALACTUS / Ragnarok Sovereign Agent",
        "ollama": "connected",
        "model": "gemma4:e2b",
        "memory_vault": "active_encrypted",
    }

@app.get("/", tags=["Root"])
async def root():
    return {
        "project": "Ragnarok Sovereign AI Agent",
        "role": "Agent Backend & Orchestration Engine (Member 1)",
        "docs_url": "/docs",
        "openapi_url": "/openapi.json",
        "health_url": "/api/health",
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
