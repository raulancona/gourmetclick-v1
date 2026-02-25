# PLAN: Global KPIs y Optimización de Paginación

## 🎯 Objetivo de Negocio
Convertir todos los KPIs de la aplicación (Órdenes, Reportes, Dashboard) en elementos interactivos que al dar clic muestren un desglose transparente de los datos que los componen. Al mismo tiempo, asegurar de manera estricta que el consumo de recursos de base de datos (Supabase) sea mínimo mediante una estrategia de paginación dura (Server-Side Pagination) y cargas bajo demanda (Lazy Loading).

## 🛑 Socratic Gate (Pendiente de Respuesta)
Antes de proceder con código, necesitamos definir 3 reglas de negocio para el ahorro de costos en el servidor:
1. **Paginación Visual:** ¿Prefieres mantener el botón "Cargar Más" (que va sumando resultados hacia abajo) o prefieres botones numéricos `<< 1 2 3 >>` para cambiar de página limpiamente y mantener el consumo de RAM bajo?
2. **Carga Diferida de Detalles:** Para no saturar el servidor buscando el detalle de 2,000 órdenes de un reporte inmenso, la lista detallada de un KPI solo se descargará de internet *hasta el segundo en que el usuario le dé clic a la tarjeta*. ¿Es aceptable una demora natural de red de ~0.5s a 1s cuando le den clic a un KPI histórico gigante?
3. **Profundidad del Historial:** Para los dashboards históricos o de reportes, ¿quieres limitar la búsqueda por defecto al "Mes Actual" (o últimos 30 días), obligando al usuario a usar un selector de fechas si realmente quiere buscar datos de hace 6 meses? Recomiendo mucho esto para ahorrar lecturas masivas a la base de datos.

## 📐 Estrategia Técnica y Arquitectura (Costos Optimizados)
1. **Server-Side Pagination (Supabase `range`)**
   - Actualmente algunas vistas descargan gran parte de la información localmente.
   - Las consultas usarán estrictamente `.range(from, to)` en el backend de Supabase.
   - Solo transitarán por la red exactamente 50 filas a la vez.

2. **Fetching Dinámico Bajo Demanda (On-Demand KPI Drilldown)**
   - Para reportes masivos (`/dashboard`, `/reportes`), las sumatorias (el número del KPI) las hará directamente **PostgreSQL** usando `.select('monto.sum()', { head: true })` u RPCs rápidos. No se descargarán filas, solo la suma final.
   - Al hacer clic en la tarjeta del KPI, se invocará un componente global modal que hará el `fetch` fresco y paginado usando *exclusivamente* los filtros de ese KPI.

## 📋 Task Breakdown (Checklist de Implementación)

### Fase 1: Optimización de Base de Datos y Supabase
- [ ] Revisar que las tablas principales (`orders`, `gastos`, `sesiones_caja`) tengan los índices adecuados en `created_at` y `status`.
- [ ] Auditar `getOrders` y similares para asegurar el uso estricto de Server-Side Pagination.

### Fase 2: Componente Reusable `KpiDrilldownModal`
- [ ] Crear el componente transversal `<KpiDrilldownModal />`.
- [ ] El componente recibirá los parámetros de filtro (ej. `{ status: 'delivered', range: 'thisMonth' }`) y gestionará su propia descarga y paginación interna.

### Fase 3: Refactorización Estricta de Órdenes (`/orders`)
- [ ] Desacoplar la query de órdenes históricas (usar estrictamente bloques de 50 reemplazables, no acumulativos si así lo prefieres).
- [ ] Reemplazar el modal de KPIs simulado por el nuevo componente que efectúa peticiones bajo demanda con seguridad.

### Fase 4: Refactorización de Reportes, Dashboards y Caja
- [ ] Auditar el Dashboard (`/dashboard`) para que todos los números llamen al `KpiDrilldownModal`.
- [ ] Auditar la sección de Operaciones Financieras / Reportes para reemplazar conteos masivos locales por consultas sumarizadas remotas (bajando a 0 el consumo de RAM de las tablas).

## 🧪 Plan de Verificación de Rendimiento
- **Network Tab:** Ninguna carga inicial de página web en el historial debe superar los 50kb de JSON ni tardar más de 800ms.
- **Supabase Quota Check:** Asegurar que las lecturas totales por click de expansión solo cobren 50 `Row Reads` y no el total histórico.
- **UX Check:** Evitar parpadeos infilitos al cambiar de páginas y retener filtros activos.
