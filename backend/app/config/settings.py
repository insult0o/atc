"""
Configuration settings for the PDF Intelligence Platform API
Uses Pydantic for validation and environment variable loading
"""

from pydantic import BaseSettings, Field, validator
from typing import List, Optional
import os
from functools import lru_cache

class Settings(BaseSettings):
    # Application
    app_name: str = "PDF Intelligence Platform API"
    debug: bool = Field(default=False, env="DEBUG")
    environment: str = Field(default="development", env="ENVIRONMENT")
    
    # Security
    secret_key: str = Field(..., env="SECRET_KEY")
    allowed_hosts: List[str] = Field(
        default=["localhost", "127.0.0.1"], 
        env="ALLOWED_HOSTS"
    )
    allowed_origins: List[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"],
        env="ALLOWED_ORIGINS"
    )
    
    # Database
    database_url: str = Field(..., env="DATABASE_URL")
    database_pool_size: int = Field(default=20, env="DATABASE_POOL_SIZE")
    database_max_overflow: int = Field(default=0, env="DATABASE_MAX_OVERFLOW")
    
    # Supabase
    supabase_url: str = Field(..., env="SUPABASE_URL")
    supabase_key: str = Field(..., env="SUPABASE_ANON_KEY")
    supabase_service_key: str = Field(..., env="SUPABASE_SERVICE_KEY")
    
    # Redis
    redis_url: str = Field(default="redis://localhost:6379", env="REDIS_URL")
    
    # File Storage
    storage_bucket: str = Field(default="documents", env="STORAGE_BUCKET")
    max_file_size: int = Field(default=100 * 1024 * 1024, env="MAX_FILE_SIZE")  # 100MB
    allowed_file_types: List[str] = Field(
        default=["application/pdf"], 
        env="ALLOWED_FILE_TYPES"
    )
    
    # Processing
    max_concurrent_jobs: int = Field(default=10, env="MAX_CONCURRENT_JOBS")
    job_timeout: int = Field(default=3600, env="JOB_TIMEOUT")  # 1 hour
    
    # WebSocket
    websocket_heartbeat: int = Field(default=30, env="WEBSOCKET_HEARTBEAT")
    max_websocket_connections: int = Field(default=1000, env="MAX_WEBSOCKET_CONNECTIONS")
    
    # Logging
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    log_format: str = Field(default="json", env="LOG_FORMAT")
    
    @validator('allowed_hosts', 'allowed_origins', 'allowed_file_types', pre=True)
    def parse_list(cls, v):
        if isinstance(v, str):
            return [item.strip() for item in v.split(',')]
        return v
    
    @validator('environment')
    def validate_environment(cls, v):
        allowed_envs = ['development', 'staging', 'production']
        if v not in allowed_envs:
            raise ValueError(f'Environment must be one of {allowed_envs}')
        return v
    
    @validator('log_level')
    def validate_log_level(cls, v):
        allowed_levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
        if v.upper() not in allowed_levels:
            raise ValueError(f'Log level must be one of {allowed_levels}')
        return v.upper()
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False

@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()

# Development defaults
def get_development_settings() -> Settings:
    """Get settings for development environment"""
    os.environ.setdefault("SECRET_KEY", "development-secret-key-change-in-production")
    os.environ.setdefault("DATABASE_URL", "postgresql://localhost/pdf_platform_dev")
    os.environ.setdefault("SUPABASE_URL", "https://your-project.supabase.co")
    os.environ.setdefault("SUPABASE_ANON_KEY", "your-anon-key")
    os.environ.setdefault("SUPABASE_SERVICE_KEY", "your-service-key")
    
    return get_settings() 