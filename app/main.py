"""
Main entry point for Project Ragnarok & MEMORAG Backend.
Exposes the unified FastAPI application with:
- Milestone 5: Memory Handshake & Task Planner (gemma4:e2b)
- Milestone 6: CORSMiddleware, Real-time SSE event stream, and DAG approval resumption
"""

from backend.main import (
    app,
    get_orchestrator,
    get_planner,
    orchestrator,
    planner,
)


__all__ = [
    "app",
    "get_orchestrator",
    "get_planner",
    "orchestrator",
    "planner",
]

if __name__ == "__main__":
    import os
    import uvicorn
    host = os.environ.get("RAGNAROK_HOST", "0.0.0.0")
    port = int(os.environ.get("RAGNAROK_PORT", "8000"))
    uvicorn.run("app.main:app", host=host, port=port, reload=True)
