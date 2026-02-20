-- Migration: Add Folio and Cash Closing Info
-- Run this in your Supabase SQL Editor

-- 1. Add auto-incrementing FOLIO to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS folio SERIAL;

-- 2. Add Closing Information to sesion_caja
ALTER TABLE sesiones_caja ADD COLUMN IF NOT EXISTS cerrado_por UUID REFERENCES auth.users(id);
ALTER TABLE sesiones_caja ADD COLUMN IF NOT EXISTS nombre_cajero TEXT;

-- 3. (Optional) Backfill existing closed sessions if needed (defaulting to system/admin if unknown)
-- UPDATE sesiones_caja SET nombre_cajero = 'Admin' WHERE estado = 'cerrada' AND nombre_cajero IS NULL;
