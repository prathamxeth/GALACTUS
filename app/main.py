"""
Main entry point for Project Ragnarok & GALACTUS Backend.
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
    from backend.main import validate_local_only_binding
    raw_host = os.environ.get("MEMORAG_HOST") or os.environ.get("RAGNAROK_HOST") or "127.0.0.1"
    host = validate_local_only_binding(raw_host)
    port = int(os.environ.get("MEMORAG_PORT") or os.environ.get("RAGNAROK_PORT") or 8000)
    uvicorn.run("app.main:app", host=host, port=port, reload=True)
