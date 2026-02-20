# Plan: Bug Fixes (Roles & Filters)

## Overview
Los usuarios no pueden ver reportes anteriores, el menú o productos muestran errores/pantalla negra, y no pueden abrir turno en la caja. Esto fue causado por la migración del rol a `app_metadata`, la cual dejó obsoletas las funciones PostgreSQL (`is_superadmin()`) y filtros en el frontend que aún dependían de comportamientos anteriores o de la tabla `profiles`.

## Project Type
WEB

## Success Criteria
- Restaurantes pueden iniciar turno y ver la caja sin problemas.
- Los reportes históricos cargan correctamente.
- El menú y productos se visualizan sin errores ni pantallas negras.
- El rol *superadmin* sigue funcionando exclusivamente para `raulanconaa@gmail.com` globalmente a través del JWT sin romper el acceso de los dueños (`owner`).

## Tech Stack
- **PostgreSQL / Supabase RLS:** Para corregir las funciones RPC y las políticas.
- **React / Vite:** Para remover los filtros rígidos en el frontend.

## File Structure (Files to touch)
- Base de datos (SQL)
- `src/lib/analytics-service.js` (u otros servicios similares como `cash-cuts` o `categories`) si tienen `.eq('restaurant_id', ...)` rígido.
- Componentes de UI que estén rompiendo por falta de datos.

## Task Breakdown

### 1. Fix PostgreSQL Roles Functions
- **Agent:** `backend-specialist` 
- **Skill:** `database-design`
- **INPUT:** Funciones `is_superadmin()` y `has_restaurant_access()` actuales.
- **OUTPUT:** Funciones SQL actualizadas que lean `(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role')` en lugar de la tabla `profiles`.
- **VERIFY:** Ejecutar la migración SQL y probar si RLS de `sesiones_caja`, `gastos`, etc. se desbloquean.

### 2. Frontend Filters Bypass
- **Agent:** `frontend-specialist`
- **Skill:** `react-best-practices`
- **INPUT:** `analytics-service.js`, `category-service.js` y componentes de caja/menú.
- **OUTPUT:** Cambio de `.eq('restaurant_id', restaurantId)` por `.or('restaurant_id.eq..., user_id.eq...')` u omitir filtro basado en el diseño RLS.
- **VERIFY:** Comprobar que los menús y la vista de reportes/caja cargan sin error en la interfaz.

## ✅ PHASE X: Verification Checklist
- [ ] Ejecutar lint y pruebas básicas del frontend (`npm run build`).
- [ ] Revisión visual del sistema (`npm run dev`) para asegurar que el Dashboard carga correctamente para un usuario *owner*.
- [ ] Simular carga de reportes históricos y apertura de caja.
