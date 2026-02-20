# PLAN-order-visibility-fix.md

## Objetivo
Las órdenes antiguas (de sesiones ya cerradas) siguen apareciendo en la vista de Órdenes con el badge "Por Cortar". Esto ocurre porque existen **órdenes huérfanas** — órdenes sin `sesion_caja_id` o de sesiones ya `cerrada` que nunca fueron marcadas como `completed`.

---

## Diagnóstico Técnico Completo

### Root Cause #1 — Órdenes sin `sesion_caja_id` (Históricas)
Órdenes creadas antes de implementar el sistema de sesiones no tienen `sesion_caja_id`. `closeSession` filtra por `sesion_caja_id`, por lo tanto **nunca las tocó**.

### Root Cause #2 — Filtro de `getOrders` incompleto
`getOrders({ includeClosed: false })` filtra:
```js
query.is('cash_cut_id', null).neq('status', 'completed')
```
Esto deja pasar órdenes `status=delivered` sin `cash_cut_id`, aunque pertenezcan a sesiones ya cerradas.

### Root Cause #3 — Badge "Por Cortar" condición incorrecta
El badge muestra "Por Cortar" si `!order.cash_cut_id`. Esto es el sistema legado — debería mostrar el badge solo si la sesión actual está abierta.

---

## Plan de Implementación (4 fases)

### Fase 1 — Migración / Limpieza BD (Una vez)
**Objetivo:** Marcar como `completed` todas las órdenes de sesiones ya cerradas.

```sql
-- Marcar como completed todas las delivered de sesiones cerradas
UPDATE orders o
SET status = 'completed', fecha_cierre = sc.closed_at
FROM sesiones_caja sc
WHERE o.sesion_caja_id = sc.id
  AND sc.estado = 'cerrada'
  AND o.status = 'delivered';

-- Opcional: orders antiguas sin sesion_caja_id (antes del sistema)
-- Marcarlas como completed con fecha de hoy si fueron creadas hace más de 24h
UPDATE orders
SET status = 'completed', fecha_cierre = NOW()
WHERE sesion_caja_id IS NULL
  AND status = 'delivered'
  AND created_at < NOW() - INTERVAL '24 hours';
```

**Agente:** `backend-specialist`  
**Archivo:** Ejecutar en Supabase SQL Editor

---

### Fase 2 — Refactorizar `getOrders` (Backend)
**Archivo:** `src/lib/order-service.js`

**Cambio:** Cuando `includeClosed = false`, filtrar TAMBIÉN por:
- La sesión activa actual (si existe enlazarla)
- O, alternativamente, excluir órdenes de sesiones en estado `cerrada`

```js
// Nueva lógica de getOrders cuando includeClosed = false:
if (!includeClosed) {
  // Obtener sesiones cerradas del restaurante
  const { data: closedSessions } = await supabase
    .from('sesiones_caja')
    .select('id')
    .eq('restaurante_id', userId)
    .eq('estado', 'cerrada')
  
  const closedIds = (closedSessions || []).map(s => s.id)

  query = query.neq('status', 'completed')
               .neq('status', 'cancelled')
  
  // Excluir órdenes de sesiones cerradas
  if (closedIds.length > 0) {
    query = query.not('sesion_caja_id', 'in', `(${closedIds.join(',')})`)
  }
  
  // Excluir también las huérfanas antiguas (> 24h sin sesión)
  query = query.or(`sesion_caja_id.not.is.null,created_at.gte.${yesterday}`)
}
```

**Agente:** `backend-specialist`

---

### Fase 3 — Corregir Badge "Por Cortar" (Frontend)
**Archivo:** `src/pages/orders.jsx`

El badge "Por Cortar" aparece si `!order.cash_cut_id`. Cambiar condición a:
- Mostrar badge solo si la orden tiene `status === 'delivered'` y pertenece a la sesión activa.
- Cambiar label de "Por Cortar" a "Pendiente Corte" si aplica.

**Agente:** `frontend-specialist`

---

### Fase 4 — Script SQL de Supabase (Prevención futura)
Crear Supabase function que auto-marca órdenes huérfanas cada vez que se cierra una sesión:

```sql
CREATE OR REPLACE FUNCTION close_session_orders(p_session_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE orders
  SET status = 'completed', fecha_cierre = NOW()
  WHERE sesion_caja_id = p_session_id
    AND status NOT IN ('completed', 'cancelled');
END;
$$ LANGUAGE plpgsql;
```

**Agente:** `backend-specialist`

---

## Checklist de Verificación

- [ ] Ejecutar SQL de migración en Supabase para órdenes históricas
- [ ] Implementar nueva lógica de filtrado en `getOrders`  
- [ ] Corregir badge "Por Cortar" en vista de Órdenes
- [ ] Probar cierre de turno y verificar que la lista de Órdenes se vacía
- [ ] Verificar que el historial de cortes muestra datos correctos
- [ ] Probar que dos empleados (cajero + mesero) pueden usar el POS simultáneamente sin errores de conexión

---

## Prioridad de Ejecución

| # | Tarea | Impacto | Esfuerzo | Prioridad |
|---|-------|---------|----------|-----------|
| 1 | SQL Migración BD | 🔴 Crítico | Bajo | P0 |
| 2 | Refactorizar `getOrders` | 🔴 Crítico | Medio | P0 |
| 3 | Corregir Badge | 🟡 Medio | Bajo | P1 |
| 4 | Supabase Function | 🟢 Prevención | Medio | P2 |
