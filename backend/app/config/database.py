"""
Database Configuration
Async PostgreSQL with SQLAlchemy 2.0
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import event
from typing import AsyncGenerator
import logging
from contextlib import asynccontextmanager

from .settings import settings

logger = logging.getLogger(__name__)

# SQLAlchemy Base
Base = declarative_base()

# Database URL
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
    async with engine.begin() as conn:
        # Enable UUID extension
        await conn.execute("CREATE EXTENSION IF NOT EXISTS uuid-ossp")
        
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
        
        logger.info("Database tables created/verified")


async def close_db():
    """Close database connections"""
    await engine.dispose()
    logger.info("Database connections closed")


# Enable asyncpg logging if debug
if settings.APP_DEBUG:
    import asyncpg
    logging.getLogger("asyncpg").setLevel(logging.DEBUG)
