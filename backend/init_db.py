"""
Script para inicializar la base de datos de desarrollo.
Este script crea todas las tablas necesarias en la base de datos especificada.
"""
import asyncio
import sys
import os

# Add parent directory to path to import backend modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from core.database import engine, Base
from core.config import settings

# Import all models to ensure they are registered with Base
from models.user import User
from models.rfp import RFPSubmission, RFPQuestion
from models.experience import Experience
from models.certification import Certification
from models.chapter import Chapter


async def init_database():
    """Initialize database by creating all tables."""
    print(f"🔧 Initializing database...")
    print(f"📊 Environment: {settings.ENV}")
    print(f"🗄️  Database URL: {settings.DATABASE_URL[:50]}...")
    
    try:
        # Test connection first
        async with engine.begin() as conn:
            result = await conn.execute(text("SELECT version();"))
            version = result.scalar()
            print(f"✅ Connected to PostgreSQL: {version}")
            
            # Create all tables
            print(f"📝 Creating tables...")
            await conn.run_sync(Base.metadata.create_all)
            
            # Verify tables were created
            result = await conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                ORDER BY table_name;
            """))
            tables = [row[0] for row in result.fetchall()]
            
            if tables:
                print(f"✅ Successfully created {len(tables)} tables:")
                for table in tables:
                    print(f"   - {table}")
            else:
                print(f"⚠️  No tables found. This might indicate an issue.")
        
        print(f"\n🎉 Database initialization completed successfully!")
        
    except Exception as e:
        print(f"❌ Error initializing database: {str(e)}")
        raise
    finally:
        await engine.dispose()


async def reset_database():
    """Drop all tables and recreate them (USE WITH CAUTION!)."""
    print(f"⚠️  WARNING: This will DROP ALL TABLES in the database!")
    print(f"📊 Environment: {settings.ENV}")
    print(f"🗄️  Database URL: {settings.DATABASE_URL[:50]}...")
    
    confirmation = input("\nType 'YES' to confirm: ")
    if confirmation != "YES":
        print("❌ Operation cancelled.")
        return
    
    try:
        async with engine.begin() as conn:
            print(f"🗑️  Dropping all tables...")
            await conn.run_sync(Base.metadata.drop_all)
            print(f"✅ All tables dropped.")
            
            print(f"📝 Creating tables...")
            await conn.run_sync(Base.metadata.create_all)
            print(f"✅ All tables created.")
        
        print(f"\n🎉 Database reset completed successfully!")
        
    except Exception as e:
        print(f"❌ Error resetting database: {str(e)}")
        raise
    finally:
        await engine.dispose()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Database initialization script")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Reset database (drop and recreate all tables)"
    )
    
    args = parser.parse_args()
    
    if args.reset:
        asyncio.run(reset_database())
    else:
        asyncio.run(init_database())
