"""
Main entry point for GALACTUS / Ragnarok Memory & Security Service.
Runs as a local-only daemon bound strictly to 127.0.0.1 by default.
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router, SubsystemContainer


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database and encryption on startup if not already initialized
    if SubsystemContainer.db is None:
        db_path = os.environ.get("GALACTUS_DB_PATH", "galactus_memory.db")
        SubsystemContainer.initialize(db_path=db_path)
    yield
    # Cleanup / flush WAL on shutdown if needed
    if SubsystemContainer.db:
        SubsystemContainer.db.checkpoint_wal()


app = FastAPI(
    title="GALACTUS Sovereign Memory & Security API",
    description=(
        "Local-first, encrypted persistent memory and authorization subsystem for Project Ragnarok. "
        "Provides episodic event logging, semantic structured facts, task crash recovery, and human-in-the-loop authorization."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Localhost CORS policy (restricting origins to localhost dev servers)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/", tags=["Health"])
def root_info():
    """Service status and component metadata."""
    return {
        "service": "GALACTUS Memory & Security Subsystem",
        "version": "1.0.0",
        "status": "online",
        "storage": "SQLite WAL (local-first)",
        "encryption": "Fernet Authenticated (AES-128-CBC + HMAC-SHA256)",
        "security_policy": "Default-Deny with Human Approval Barrier",
        "docs_url": "/docs",
    }


@app.get("/health", tags=["Health"])
def health_check():
    """Liveness probe."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    # Enforce local bind address: never bind to 0.0.0.0 by default
    host = os.environ.get("GALACTUS_HOST", "127.0.0.1")
    port = int(os.environ.get("GALACTUS_PORT", "8000"))
    uvicorn.run("app.main:app", host=host, port=port, reload=True)
