-- init.sql - Inicialización de la base de datos PostgreSQL
-- Este script se ejecuta automáticamente al crear el contenedor

-- Extensiones útiles
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Añadir columna preferences si no existe (para migración)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'preferences'
    ) THEN
        ALTER TABLE users ADD COLUMN preferences JSONB DEFAULT '{"analysis_mode": "balanced"}';
        RAISE NOTICE 'Added preferences column to users table';
    END IF;
EXCEPTION WHEN others THEN
    -- La tabla puede no existir aún, ignorar
    NULL;
END $$;

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE 'Database initialized successfully for RFP Analyzer!';
END $$;
