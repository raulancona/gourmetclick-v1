# PLAN: Dashboard & Caja Data Integrity Overhaul

**Agent:** `@[business-analyst]` + `@[frontend-specialist]` + `@[backend-specialist]`
**Slug:** `dashboard-caja-overhaul`
**Date:** 2026-02-24

---

## 🔍 Root Cause Analysis (Pre-Execution)

| # | Bug | Root Cause | File |
|---|-----|-----------|------|
| 1 | Gastos $0 en dashboard | Dashboard queries `gastos` with `.eq('restaurant_id', user.id)` — debe ser `restaurante_id` O usar `tenant.id` | `dashboard.jsx` |
| 2 | "Más Vendidos" muestra 0x | `getSalesAnalytics` exporta `topProducts` sin el campo `quantity` (stripped en línea 378-381) | `order-service.js` line 378 |
| 3 | Caja muestra órdenes ya cortadas | `getUnclosedOrders` filtra por `sesion_caja_id` pero **NO excluye** órdenes con `cash_cut_id` | `order-service.js` line 415 |
| 4 | Cajero muestra email | `nombre_cajero` se guarda como email en `createCashCut`. Debe guardarse el nombre del `empleado` o del user | `order-service.js` createCashCut |
| 5 | Reportes "Analíticas" duplica dashboard | Tab "Analíticas de Negocio" es placeholder, información incorrecta. Eliminar | `reports.jsx` |

---

## 📋 Task Breakdown

### FASE 1: Data Integrity (Backend / Services)

#### 1A — Fix `getUnclosedOrders` (CRÍTICO)
- Agregar `.is('cash_cut_id', null)` al query para excluir órdenes ya cortadas
- Esto asegura que el panel de Caja solo muestre órdenes del turno actual NO cortadas

#### 1B — Fix `getSalesAnalytics.topProducts`
- Incluir `quantity` en el array `topProducts` exportado
- Permite que "Más Vendidos" muestre cantidades reales

#### 1C — Fix `createCashCut` nombre_cajero
- Cuando se crea el corte, buscar el `empleado.nombre` si existe, sino usar `user.email` como fallback limpio
- Agregar `cajero_nombre` y `cajero_email` separados para trazabilidad

#### 1D — Fix Dashboard gastos query
- Cambiar `.eq('restaurant_id', user.id)` a `.eq('restaurante_id', tenant.id)` en el query de gastos del dashboard
- Verificar nombre real de la columna consultando Supabase

---

### FASE 2: Reports Page Simplification

#### 2A — Eliminar tab "Analíticas de Negocio"
- Solo dejar la tab "Auditoría de Caja"
- Renombrar página a "Auditoría de Caja"
- Limpiar imports no utilizados

#### 2B — Mejorar display de cajero en `cortes-history.jsx`
- Mostrar nombre legible del cajero (no email)
- Si es owner: "Administrador"
- Si es staff: usar `nombre` del empleado
- Mostrar badge visual de rol (Admin/Staff)

---

### FASE 3: Dashboard UX/UI Overhaul

#### 3A — Business KPI cards
- **Ventas Brutas**: suma de órdenes entregadas en el período
- **Gastos Operativos**: gastos reales del período (fix DB column)
- **Utilidad Neta** = Ventas − Gastos (nota visual: no incluye COGS)
- **Ticket Promedio**: revenue / total orders
- **Órdenes hoy**: conteo del período
- Nota: COGS solo si producto tiene `costo` definido (campo opcional)

#### 3B — Top Products avec quantity
- "Más Vendidos" → usar `quantity` del analytics fix
- "Más Rentables" → usar `revenue` 
- Rankings con medallas visuales

#### 3C — Visual polish premium
- Cards con gradientes sutiles
- Estado "vacío" mejorado con emptystates
- Skeleton loading states
- Tendencia vs período anterior (si datos permiten)

---

### FASE 4: Caja — Limpieza de órdenes

#### 4A — Panel "Revisión de Órdenes"
- Aplicar fix de `getUnclosedOrders` para que solo muestre las realmente sin corte

#### 4B — Saldo Esperado
- Verificar que la fórmula: `Fondo + Ventas − Gastos` use gastos reales del session

---

## ✅ Verification Checklist

- [ ] Crear gasto en sesión activa → aparece en dashboard, se descuenta en caja
- [ ] Hacer corte → órdenes cortadas NO aparecen en "Revisión" de siguiente turno  
- [ ] Dashboard "Más Vendidos" muestra cantidades reales (ej: 3x, 5x)
- [ ] Reportes solo muestra "Auditoría de Caja"
- [ ] Cajero en historial muestra nombre (no email)
- [ ] Utilidad Neta = Ventas − Gastos (con nota de que COGS no está incluido)

---

## ⚠️ Notas de Negocio

> **COGS (Costo de producto):** No todos los productos tienen costo registrado. La "Utilidad Neta" del dashboard = Ventas - Gastos Operativos (no incluye COGS si no está configurado). Agregar tooltip/disclaimer visual en el KPI.

> **Auditoría vs Analíticas:** El Dashboard es para analítica de negocio (tendencias, KPIs). Reportes es para auditoría financiera (quién cerró, cuánto había, diferencias). Mantener esta separación clara.
