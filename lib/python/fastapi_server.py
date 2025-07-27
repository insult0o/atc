#!/usr/bin/env python3
"""
High-Performance FastAPI server for GPU-accelerated unstructured document processing
"""

import tempfile
import os
import asyncio
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

from fastapi import FastAPI, File, UploadFile, HTTPException, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import uvicorn

# Import our high-performance processor
from enhanced_unstructured_processor import HighPerformanceUnstructuredProcessor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ProcessingResult(BaseModel):
    filename: str
    total_elements: int
    processing_time_seconds: float
    strategy: str
    cached: bool
    quality_score: float
    gpu_enabled: bool = False
    parallel_workers: int = 1
    performance_gain: str = "1x"
    elements: List[Dict[str, Any]] = Field(default_factory=list, description="Sample elements (first 10)")
    file_info: Optional[Dict[str, Any]] = None

class ProcessingStats(BaseModel):
    parallel_workers: int
    gpu_enabled: bool
    batch_size: int
    streaming_enabled: bool
    performance_mode: str
    estimated_speedup: str
    cache_dir: str

class HealthCheck(BaseModel):
    status: str
    gpu_available: bool
    parallel_workers: int
    version: str
    timestamp: datetime

# Initialize the high-performance processor
processor_config = {
    "strategy": "hi_res_gpu",
    "temp_dir": "/tmp/unstructured_gpu",
    "log_level": "INFO",
    "enable_gpu": True,
    "parallel_workers": 8,
    "batch_size": 32,
    "streaming": True,
    "languages": ["eng"]
}

processor = HighPerformanceUnstructuredProcessor(processor_config)

# Create FastAPI app
app = FastAPI(
    title="High-Performance Unstructured Document Processor",
    description="GPU-accelerated document processing with parallel execution",
    version="3.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", response_model=HealthCheck)
async def health_check():
    """Enhanced health check with GPU and performance info"""
    stats = processor.get_processing_stats()
    return HealthCheck(
        status="healthy",
        gpu_available=stats.get("gpu_enabled", False),
        parallel_workers=stats.get("parallel_workers", 1),
        version="3.0.0-gpu",
        timestamp=datetime.now()
    )

@app.get("/stats", response_model=ProcessingStats)
async def get_processing_stats():
    """Get detailed processing statistics"""
    stats = processor.get_processing_stats()
    return ProcessingStats(**stats)

@app.post("/process", response_model=ProcessingResult)
async def process_document_gpu(
    file: UploadFile = File(...),
    strategy: str = Form(default="fast"),
    chunking_strategy: str = Form(default="by_title"),
    max_characters: int = Form(default=500),
    languages: str = Form(default="eng"),
    parallel_workers: Optional[int] = Form(default=None),
    enable_gpu: bool = Form(default=True),
    batch_size: int = Form(default=32),
    streaming: bool = Form(default=True)
):
    """High-performance document processing with GPU acceleration"""
    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_filename = temp_file.name

        # Configure processor for this request
        dynamic_config = {
            "strategy": strategy,
            "chunking_strategy": chunking_strategy,
            "max_characters": max_characters,
            "languages": languages.split(",") if isinstance(languages, str) else languages,
            "enable_gpu": enable_gpu,
            "parallel_workers": parallel_workers or processor.parallel_workers,
            "batch_size": batch_size,
            "streaming": streaming,
            "temp_dir": processor.temp_dir,
            "log_level": "INFO"
        }
        
        # Create a new processor instance for this request with optimized config
        request_processor = HighPerformanceUnstructuredProcessor(dynamic_config)
        
        logger.info(f"Processing {file.filename} with GPU: {enable_gpu}, Workers: {dynamic_config['parallel_workers']}")
        
        # Process with progress tracking
        progress_updates = []
        
        async def progress_callback(progress: float):
            progress_updates.append(progress)
            logger.info(f"Processing progress: {progress:.1f}%")
        
        # Run high-performance processing
        result = await request_processor.process_document_async(temp_filename, progress_callback)
        
        # Cleanup
        os.unlink(temp_filename)
        
        # Extract metadata with safe defaults
        metadata = result.get("processing_metadata", {})
        file_info = metadata.get("file_info", {})
        
        return ProcessingResult(
            filename=file.filename,
            total_elements=len(result.get("elements", [])),
            processing_time_seconds=metadata.get("processing_time_seconds", 0.0),
            strategy=metadata.get("strategy", strategy),
            cached=metadata.get("cached", False),
            quality_score=metadata.get("avg_quality", 0.0),
            gpu_enabled=metadata.get("gpu_enabled", enable_gpu),
            parallel_workers=metadata.get("parallel_workers", 1),
            performance_gain=metadata.get("performance_gain", "1x"),
            elements=result.get("elements", [])[:10],  # Return first 10 elements
            file_info=file_info
        )
        
    except Exception as e:
        logger.error(f"GPU processing failed for {file.filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"GPU processing failed: {str(e)}")

@app.post("/process/batch")
async def process_batch_documents(
    files: List[UploadFile] = File(...),
    strategy: str = Form(default="hi_res"),
    enable_gpu: bool = Form(default=True),
    parallel_workers: int = Form(default=8)
):
    """Process multiple documents in parallel"""
    try:
        if len(files) > 10:
            raise HTTPException(status_code=400, detail="Maximum 10 files per batch")
        
        results = []
        temp_files = []
        
        # Save all files temporarily
        for file in files:
            with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as temp_file:
                content = await file.read()
                temp_file.write(content)
                temp_files.append((temp_file.name, file.filename))
        
        # Process all files concurrently
        async def process_single_file(temp_path: str, filename: str):
            try:
                config = {
                    "strategy": strategy,
                    "enable_gpu": enable_gpu,
                    "parallel_workers": max(1, parallel_workers // len(files)),  # Distribute workers
                    "temp_dir": processor.temp_dir,
                    "log_level": "INFO"
                }
                
                file_processor = HighPerformanceUnstructuredProcessor(config)
                result = await file_processor.process_document_async(temp_path)
                
                metadata = result.get("processing_metadata", {})
                return {
                    "filename": filename,
                    "success": True,
                    "total_elements": len(result.get("elements", [])),
                    "processing_time": metadata.get("processing_time_seconds", 0.0),
                    "quality_score": metadata.get("avg_quality", 0.0)
                }
            except Exception as e:
                logger.error(f"Error processing {filename}: {e}")
                return {
                    "filename": filename,
                    "success": False,
                    "error": str(e)
                }
        
        # Process all files concurrently
        tasks = [process_single_file(temp_path, filename) for temp_path, filename in temp_files]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Cleanup temporary files
        for temp_path, _ in temp_files:
            try:
                os.unlink(temp_path)
            except:
                pass
        
        return {
            "batch_id": f"batch_{datetime.now().timestamp()}",
            "total_files": len(files),
            "results": results,
            "processing_mode": "gpu_parallel" if enable_gpu else "cpu_parallel"
        }
        
    except Exception as e:
        logger.error(f"Batch processing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Batch processing failed: {str(e)}")

@app.get("/cache/stats")
async def get_cache_stats():
    """Get cache statistics"""
    try:
        cache_dir = processor.cache_dir
        cache_files = list(cache_dir.glob("*.pkl"))
        total_size = sum(f.stat().st_size for f in cache_files)
        
        return {
            "cache_files": len(cache_files),
            "total_size_mb": total_size / (1024 * 1024),
            "cache_directory": str(cache_dir),
            "cache_enabled": True
        }
    except Exception as e:
        return {
            "cache_files": 0,
            "total_size_mb": 0.0,
            "error": str(e)
        }

@app.delete("/cache/clear")
async def clear_cache():
    """Clear processing cache"""
    try:
        cache_dir = processor.cache_dir
        cleared = 0
        for cache_file in cache_dir.glob("*.pkl"):
            cache_file.unlink()
            cleared += 1
        
        return {
            "status": "success",
            "files_cleared": cleared,
            "message": f"Cleared {cleared} cache files"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cache clear failed: {str(e)}")

@app.get("/performance/benchmark")
async def run_performance_benchmark():
    """Run a performance benchmark"""
    try:
        # Create a test file
        test_content = "This is a performance test document. " * 100
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(test_content)
            test_file = f.name
        
        # Benchmark different configurations
        configs = [
            {"enable_gpu": False, "parallel_workers": 1, "name": "baseline"},
            {"enable_gpu": False, "parallel_workers": 4, "name": "cpu_parallel"},
            {"enable_gpu": True, "parallel_workers": 4, "name": "gpu_parallel"},
            {"enable_gpu": True, "parallel_workers": 8, "name": "gpu_max"}
        ]
        
        results = []
        
        for config in configs:
            try:
                test_config = {**processor_config, **config}
                test_processor = HighPerformanceUnstructuredProcessor(test_config)
                
                start_time = asyncio.get_event_loop().time()
                await test_processor.process_document_async(test_file)
                end_time = asyncio.get_event_loop().time()
                
                processing_time = end_time - start_time
                results.append({
                    "config": config["name"],
                    "processing_time": processing_time,
                    "speedup": f"{results[0]['processing_time'] / processing_time:.1f}x" if results else "1x"
                })
                
            except Exception as e:
                results.append({
                    "config": config["name"],
                    "error": str(e)
                })
        
        # Cleanup
        os.unlink(test_file)
        
        return {
            "benchmark_results": results,
            "timestamp": datetime.now(),
            "test_description": "Performance comparison across different configurations"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Benchmark failed: {str(e)}")

if __name__ == "__main__":
    # Start the high-performance server
    uvicorn.run(
        "fastapi_server:app",
        host="0.0.0.0",
        port=8001,
        log_level="info",
        workers=1,  # Use 1 worker to maintain state
        loop="asyncio"
    ) 