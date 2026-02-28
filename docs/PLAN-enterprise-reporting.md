# Plan: Enterprise Reporting (Refactoring)

## 🎯 Objetivo Fundamental
Optimizar drásticamente el rendimiento del sistema de reportes y dashboard moviendo el cálculo matemático a la base de datos (PostgreSQL/Supabase) y eliminando la sobrecarga de memoria en el cliente web/móvil, aplicando además paginación y virtualización.

## 👥 Agentes Involucrados
- **`@backend-specialist` / `@database-design`**: Creación de Funciones SQL (RPCs) y optimización en Postgres.
- **`@frontend-specialist` / `@performance-profiling`**: Refactorización de queries en el cliente (`order-service.js`) y aplicación de virtualización (`@tanstack/react-virtual`).

## 📋 Desglose de Tareas

### Fase 1: Mudar el "cerebro" a la base de datos (Backend)
- [ ] Auditar los cálculos actuales de KPI en `getOrderStats` y `getSalesAnalytics`.
- [ ] Escribir Migración SQL con una función genérica (`get_financial_summary(start_date, end_date, restaurant_id)`) para retornar Ventas Brutas, Gastos Totales, Ticket Promedio y Método de pago más usado calculados en DB.
- [ ] Escribir Migración SQL con función (`get_top_products(start_date, end_date, restaurant_id)`) para hacer el cálculo ABC y Ranking desde la base de datos.
- [ ] Aplicar las migraciones a Supabase.

### Fase 2: Aligerar tus pantallas (Frontend Ligero)
- [ ] Modificar `src/lib/order-service.js` para que `getOrderStats` y `getSalesAnalytics` invoquen a las nuevas funciones RPC (`supabase.rpc(...)`).
- [ ] Eliminar los `.select('*')` o cargas masivas de ítems en memoria utilizados para reportes históricos.
- [ ] Adaptar el `DashboardPage` y `ReportsPage` para procesar la nueva estructura aligerada de datos sin hacer `Array.reduce()` en el frontend.

### Fase 3: Mostrar de "poquitos" (Paginación y Virtualización)
- [ ] Añadir paginación nativa basada en cursores o índices numéricos (`page`, `pageSize`) a la consulta de `getOrders` mode `historial`.
- [ ] Implementar `@tanstack/react-virtual` en las listas del Historial de Órdenes (`OrdersPage` y vistas de Corte de Caja) para que el DOM sólo renderice 10-20 filas simultáneamente.
- [ ] Validar que el scroll y renderizado sea fluido bajo la simulación de miles de filas en la tabla principal.

---

## 🛑 Socratic Gate (Preguntas de Validación del Entorno)
Antes de proceder con la "Orchestration" y escritura de código (comando `/create` o de ejecución), necesitamos clarificar estos detalles operativos:

1. **Gestión de Fechas y Cálculos Flexibles:** ¿Es correcto asumir que en lugar de **Vistas (Views) estáticas**, usaremos **Postgres RPC functions (Funciones)** que puedan recibir el `startDate` y `endDate` seleccionados por el iPad para calcular el rango en vivo en el Backend?
2. **Descarga de Reportes:** Cuando el administrador exporta su historial a CSV, ¿es aceptable que esta acción también se procese trayendo páginas de la base de datos limitadas en background en vez de todo de golpe, para evitar crashes de memoria?
3. **React-Query e Invalidation:** Hoy el dashboard refresca todo con webhooks de supabase (`postgres_changes` en orders). ¿Continuamos invalidando el RPC y permitiendo que la BD recalcule el resumen total en cada nueva venta enviada, considerando que en Postgres esto toma milisegundos?

---
> **Estado:** Creado. Pendiente de revisión y aprobación del usuario.
