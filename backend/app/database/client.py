"""
Database client wrapper for connection management and utilities
"""

import asyncpg
import logging
from typing import Optional, Dict, Any, List
from contextlib import asynccontextmanager
from datetime import datetime

logger = logging.getLogger(__name__)

class DatabaseClient:
    """Database client with connection pooling and utility methods"""
    
    def __init__(self, database_url: str, **pool_kwargs):
        self.database_url = database_url
        self.pool_kwargs = pool_kwargs
        self.pool: Optional[asyncpg.Pool] = None
    
    async def initialize(self):
        """Initialize database connection pool"""
        try:
            self.pool = await asyncpg.create_pool(
                self.database_url,
                min_size=5,
                max_size=20,
                max_queries=50000,
                max_inactive_connection_lifetime=300,
                command_timeout=60,
                **self.pool_kwargs
            )
            logger.info("Database connection pool initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize database pool: {e}")
            raise
    
    async def close(self):
        """Close database connection pool"""
        if self.pool:
            await self.pool.close()
            self.pool = None
            logger.info("Database connection pool closed")
    
    @asynccontextmanager
    async def acquire(self):
        """Acquire database connection from pool"""
        if not self.pool:
            raise RuntimeError("Database pool not initialized")
        
        async with self.pool.acquire() as connection:
            yield connection
    
    async def health_check(self) -> bool:
        """Check database connectivity"""
        try:
            async with self.acquire() as conn:
                await conn.fetchval("SELECT 1")
            return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False
    
    async def execute_migration(self, migration_sql: str, version: str) -> bool:
        """Execute a database migration"""
        try:
            async with self.acquire() as conn:
                async with conn.transaction():
                    # Check if migration already applied
                    exists = await conn.fetchval("""
                        SELECT EXISTS(
                            SELECT 1 FROM schema_migrations 
                            WHERE version = $1
                        )
                    """, version)
                    
                    if exists:
                        logger.info(f"Migration {version} already applied")
                        return True
                    
                    # Execute migration
                    await conn.execute(migration_sql)
                    
                    # Record migration
                    await conn.execute("""
                        INSERT INTO schema_migrations (version, applied_at)
                        VALUES ($1, $2)
                    """, version, datetime.utcnow())
                    
                    logger.info(f"Migration {version} applied successfully")
                    return True
        
        except Exception as e:
            logger.error(f"Migration {version} failed: {e}")
            return False
    
    async def get_applied_migrations(self) -> List[str]:
        """Get list of applied migrations"""
        try:
            async with self.acquire() as conn:
                rows = await conn.fetch("""
                    SELECT version FROM schema_migrations 
                    ORDER BY applied_at
                """)
                return [row['version'] for row in rows]
        except Exception as e:
            logger.error(f"Error getting applied migrations: {e}")
            return []
    
    async def get_table_stats(self, table_name: str) -> Dict[str, Any]:
        """Get statistics for a table"""
        try:
            async with self.acquire() as conn:
                stats = await conn.fetchrow("""
                    SELECT 
                        schemaname,
                        tablename,
                        attname,
                        n_distinct,
                        correlation
                    FROM pg_stats 
                    WHERE tablename = $1
                    LIMIT 1
                """, table_name)
                
                count = await conn.fetchval(f"SELECT COUNT(*) FROM {table_name}")
                
                size_info = await conn.fetchrow("""
                    SELECT 
                        pg_size_pretty(pg_total_relation_size($1)) as total_size,
                        pg_size_pretty(pg_relation_size($1)) as table_size,
                        pg_size_pretty(pg_indexes_size($1)) as indexes_size
                """, table_name)
                
                return {
                    "table_name": table_name,
                    "row_count": count,
                    "total_size": size_info['total_size'] if size_info else None,
                    "table_size": size_info['table_size'] if size_info else None,
                    "indexes_size": size_info['indexes_size'] if size_info else None,
                    "has_stats": stats is not None
                }
        
        except Exception as e:
            logger.error(f"Error getting table stats for {table_name}: {e}")
            return {"table_name": table_name, "error": str(e)}
    
    async def analyze_table(self, table_name: str):
        """Run ANALYZE on a table to update statistics"""
        try:
            async with self.acquire() as conn:
                await conn.execute(f"ANALYZE {table_name}")
                logger.info(f"ANALYZE completed for table {table_name}")
        except Exception as e:
            logger.error(f"Error analyzing table {table_name}: {e}")
    
    async def vacuum_table(self, table_name: str, full: bool = False):
        """Run VACUUM on a table"""
        try:
            async with self.acquire() as conn:
                vacuum_cmd = f"VACUUM {'FULL' if full else ''} {table_name}"
                await conn.execute(vacuum_cmd)
                logger.info(f"VACUUM {'FULL' if full else ''} completed for table {table_name}")
        except Exception as e:
            logger.error(f"Error vacuuming table {table_name}: {e}")
    
    async def get_slow_queries(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get slow queries from pg_stat_statements (if enabled)"""
        try:
            async with self.acquire() as conn:
                # Check if pg_stat_statements is available
                extension_exists = await conn.fetchval("""
                    SELECT EXISTS(
                        SELECT 1 FROM pg_extension 
                        WHERE extname = 'pg_stat_statements'
                    )
                """)
                
                if not extension_exists:
                    return []
                
                rows = await conn.fetch("""
                    SELECT 
                        query,
                        calls,
                        total_exec_time,
                        mean_exec_time,
                        max_exec_time,
                        rows
                    FROM pg_stat_statements
                    ORDER BY total_exec_time DESC
                    LIMIT $1
                """, limit)
                
                return [dict(row) for row in rows]
        
        except Exception as e:
            logger.error(f"Error getting slow queries: {e}")
            return []
    
    async def get_connection_stats(self) -> Dict[str, Any]:
        """Get database connection statistics"""
        try:
            async with self.acquire() as conn:
                stats = await conn.fetchrow("""
                    SELECT 
                        sum(numbackends) as total_connections,
                        sum(xact_commit) as total_commits,
                        sum(xact_rollback) as total_rollbacks,
                        sum(blks_read) as blocks_read,
                        sum(blks_hit) as blocks_hit,
                        sum(tup_returned) as tuples_returned,
                        sum(tup_fetched) as tuples_fetched,
                        sum(tup_inserted) as tuples_inserted,
                        sum(tup_updated) as tuples_updated,
                        sum(tup_deleted) as tuples_deleted
                    FROM pg_stat_database
                    WHERE datname = current_database()
                """)
                
                return dict(stats) if stats else {}
        
        except Exception as e:
            logger.error(f"Error getting connection stats: {e}")
            return {}
    
    async def execute_function(self, function_name: str, *args) -> Any:
        """Execute a stored function"""
        try:
            async with self.acquire() as conn:
                placeholders = ', '.join(f'${i+1}' for i in range(len(args)))
                query = f"SELECT {function_name}({placeholders})"
                result = await conn.fetchval(query, *args)
                return result
        except Exception as e:
            logger.error(f"Error executing function {function_name}: {e}")
            raise
    
    async def bulk_insert(
        self, 
        table_name: str, 
        columns: List[str], 
        data: List[tuple],
        on_conflict: Optional[str] = None
    ) -> int:
        """Perform bulk insert operation"""
        try:
            async with self.acquire() as conn:
                # Build the INSERT query
                column_names = ', '.join(columns)
                placeholders = ', '.join(f'${i+1}' for i in range(len(columns)))
                
                query = f"""
                    INSERT INTO {table_name} ({column_names})
                    VALUES ({placeholders})
                """
                
                if on_conflict:
                    query += f" {on_conflict}"
                
                # Execute bulk insert
                result = await conn.executemany(query, data)
                
                # Parse result to get affected row count
                if isinstance(result, list):
                    return len(result)
                elif hasattr(result, 'split'):
                    # Parse "INSERT 0 N" format
                    parts = result.split()
                    return int(parts[-1]) if parts and parts[-1].isdigit() else len(data)
                
                return len(data)
        
        except Exception as e:
            logger.error(f"Error in bulk insert to {table_name}: {e}")
            raise
    
    async def refresh_materialized_view(self, view_name: str, concurrently: bool = True):
        """Refresh a materialized view"""
        try:
            async with self.acquire() as conn:
                refresh_cmd = f"REFRESH MATERIALIZED VIEW {'CONCURRENTLY' if concurrently else ''} {view_name}"
                await conn.execute(refresh_cmd)
                logger.info(f"Materialized view {view_name} refreshed")
        except Exception as e:
            logger.error(f"Error refreshing materialized view {view_name}: {e}")
            raise 