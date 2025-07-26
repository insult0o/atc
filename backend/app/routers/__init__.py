"""
API routers for the PDF Intelligence Platform
"""

from .documents import router as documents_router
from .processing import router as processing_router  
from .export import router as export_router
from .websocket import router as websocket_router

__all__ = [
    "documents_router",
    "processing_router", 
    "export_router",
    "websocket_router"
] 