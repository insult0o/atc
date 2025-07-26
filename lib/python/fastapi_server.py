#!/usr/bin/env python3
"""
FastAPI server for Enhanced Unstructured Processor
"""

import os
import json
import asyncio
import tempfile
from pathlib import Path
from typing import Dict, Any, Optional

from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Import our enhanced processor
from enhanced_unstructured_processor import EnhancedUnstructuredProcessor

app = FastAPI(
    title="Enhanced Unstructured Processor API",
    description="Advanced PDF processing with caching and parallel processing",
    version="1.0.0"
)

# Global processor instance
processor = None

class ProcessingRequest(BaseModel):
    filename: str
    strategy: str = "hi_res"
    chunking_strategy: str = "by_title"
    max_characters: int = 1000
    languages: Optional[list] = ["eng"]

class ProcessingResult(BaseModel):
    filename: str
    total_elements: int
    processing_time_seconds: float
    strategy: str
    cached: bool
    quality_score: float
    elements: list

@app.on_event("startup")
async def startup_event():
    """Initialize the processor on startup"""
    global processor
    try:
        # Create default config for the processor
        default_config = {
            "strategy": "hi_res",
            "chunking_strategy": "by_title", 
            "max_characters": 1000,
            "languages": ["eng"],
            "log_level": "INFO"
        }
        processor = EnhancedUnstructuredProcessor(default_config)
        print("✅ Enhanced Unstructured Processor initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize processor: {e}")
        raise e

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Test with a simple text file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("Health check test")
            test_file = f.name
        
        # Quick test
        result = processor.process_document(test_file)
        os.unlink(test_file)
        
        return {
            "status": "healthy",
            "processor_ready": True,
            "test_result": {
                "elements_found": len(result["elements"]),
                "processing_time": result["processing_metadata"]["processing_time_seconds"]
            }
        }
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "error": str(e)}
        )

@app.post("/process", response_model=ProcessingResult)
async def process_document(
    file: UploadFile = File(...),
    strategy: str = "hi_res",
    chunking_strategy: str = "by_title",
    max_characters: int = 1000,
    languages: str = "eng"
):
    """Process a document"""
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_filename = temp_file.name

        # Update processor config for this request
        processor.config.update({
            "strategy": strategy,
            "chunking_strategy": chunking_strategy,
            "max_characters": max_characters,
            "languages": languages.split(",") if isinstance(languages, str) else languages
        })
        
        result = processor.process_document(temp_filename)
        
        # Cleanup
        os.unlink(temp_filename)
        
        # Extract metadata with safe defaults
        metadata = result.get("processing_metadata", {})
        
        return ProcessingResult(
            filename=file.filename,
            total_elements=len(result.get("elements", [])),
            processing_time_seconds=metadata.get("processing_time_seconds", 0.0),
            strategy=metadata.get("strategy", strategy),
            cached=metadata.get("cached", False),
            quality_score=metadata.get("avg_quality", 0.0),
            elements=result.get("elements", [])[:10]  # Return first 10 elements for API response
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

@app.get("/stats")
async def get_stats():
    """Get processor statistics"""
    try:
        stats = processor.get_processing_stats()
        cache_stats = await processor.get_cache_stats()
        
        return {
            "processing_stats": stats,
            "cache_stats": cache_stats,
            "status": "active"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stats unavailable: {str(e)}")

@app.post("/cache/clear")
async def clear_cache():
    """Clear processor cache"""
    try:
        await processor.clear_cache()
        return {"message": "Cache cleared successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cache clear failed: {str(e)}")

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Enhanced Unstructured Processor API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "process": "/process (POST)",
            "stats": "/stats",
            "clear_cache": "/cache/clear (POST)"
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000,
        log_level="info"
    ) 