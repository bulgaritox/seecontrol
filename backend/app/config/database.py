"""
Database Configuration
Async PostgreSQL with SQLAlchemy 2.0
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from typing import AsyncGenerator
import logging
import os
from contextlib import asynccontextmanager

from .settings import settings

logger = logging.getLogger(__name__)

# Use shared Base from models so create_all sees all tables
from ..models.base import Base

# Database URL: Postgres por defecto; SQLite solo si USE_SQLITE=true (env o .env)
USE_SQLITE = os.getenv("USE_SQLITE", str(settings.USE_SQLITE)).lower() in ("1", "true", "yes")
if USE_SQLITE:
    SQLITE_PATH = os.getenv(
        "SQLITE_PATH",
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "seecontrol.db"),
    )
    DATABASE_URL = f"sqlite+aiosqlite:///{SQLITE_PATH}"
    engine = create_async_engine(
        DATABASE_URL,
        echo=settings.APP_DEBUG,
    )
else:
    DATABASE_URL = f"postgresql+asyncpg://{settings.DB_USER}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
    # Create async engine
    engine = create_async_engine(
        DATABASE_URL,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_pre_ping=True,
        echo=settings.APP_DEBUG,
    )

# Session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ============================================
# DATABASE UTILITIES
# ============================================

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get database session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Database error: {e}")
            raise
        finally:
            await session.close()


@asynccontextmanager
async def get_db_context():
    """Context manager for database session"""
    session = AsyncSessionLocal()
    try:
        yield session
        await session.commit()
    except Exception as e:
        await session.rollback()
        logger.error(f"Database error: {e}")
        raise
    finally:
        await session.close()


async def init_db():
    """Initialize database - create tables if not exist"""
    # Import models to register tables on shared Base metadata
    from .. import models  # noqa: F401
    async with engine.begin() as conn:
        if not USE_SQLITE:
            from sqlalchemy import text
            # Enable UUID extension (Postgres only)
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\""))
        
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
        
        logger.info("Database tables created/verified")


async def close_db():
    """Close database connections"""
    await engine.dispose()
    logger.info("Database connections closed")


# Enable asyncpg logging if debug (Postgres only)
if settings.APP_DEBUG and not USE_SQLITE:
    import asyncpg
    logging.getLogger("asyncpg").setLevel(logging.DEBUG)
