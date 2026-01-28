
import asyncio
from sqlalchemy import text
from core.database import engine

async def fix_schema():
    async with engine.begin() as conn:
        print("Altering table archivo to make carpeta_id nullable...")
        await conn.execute(text("ALTER TABLE archivo ALTER COLUMN carpeta_id DROP NOT NULL;"))
        print("Done.")

if __name__ == "__main__":
    asyncio.run(fix_schema())
