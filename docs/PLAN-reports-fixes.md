# Plan: Fix Reports Module & Order Lock Visibility

## 1. Context & Objectives
**Goal:** Restore functionality to the Reports Module (Gastos and Auditorías are failing), revive the order lock icon (candado) logic, and implement a clickable view to see Order Details via a modal within the Reports screen.

**Reported Issues:**
1. Error returning "Gastos" and "Reporte de Auditorias" inside the Analytics Tab.
2. Lock icon (`cash_cut_id` or `sesion_caja_id`) is still not rendering correctly for closed orders.
3. Users cannot click on orders in the Sales Report to view the detailed modal.

---

## 2. Root Cause Analysis
### Expenses and Audits Failure
- The backend fetch in `reports-service.js` for `sesiones_caja` uses `.eq('restaurant_id', id)`. However, the DB table specifically uses the legacy column name `restaurante_id`.
- Both `getExpensesAnalytics` and `getCashCutAnalytics` attempt to join using `.select('..., empleado:empleados(nombre)')`. Since the `empleado_id` foreign key points to `auth.users`, not a `public.empleados` table (or the relation syntax is incorrectly configured), REST queries to Supabase terminate abruptly with a relationship error, breaking the components entirely.

### Missing Lock Icon
- In the previous session, we shifted the dependency from `sesion_caja_id` exclusively to `cash_cut_id`. Some instances of "Cierre de Caja" do not effectively timestamp `cash_cut_id` depending on how the session is closed.
- We must make the lock inclusive: `if (order.cash_cut_id || order.sesion_caja_id)` BUT additionally verify if that `sesion_caja_id` points to a *closed* session. For frontend simplicity, just displaying the lock if either ID is present and the order is `delivered`/`cancelled`.

### Missing Modal on Reports
- `sales-tab.jsx` merely loops over orders and prints a standard HTML `<tr>`. It lacks the React state `[selectedOrder, setSelectedOrder]` and the `<OrderDetailModal />` component inclusion that `dashboard.jsx` has.

---

## 3. Implementation Steps

### Phase 1: Fix Database Queries in Reports Service
- **Target:** `src/lib/reports-service.js`
- **Action:**
  - Update `getCashCutAnalytics`: Change `.eq('restaurant_id', ...)` to `.eq('restaurante_id', ...)`.
  - Remove the unstable `empleado:empleados(nombre)` relationship fetch from both `getExpensesAnalytics` and `getCashCutAnalytics`. Fetch the raw `empleado_id` and rely on `nombre_cajero` (for sessions) instead to avoid query crashes.
  - Make sure `getSalesAnalytics` queries both `cash_cut_id` and `sesion_caja_id`.

### Phase 2: Reactify the Sales Table
- **Target:** `src/features/reports/sales-tab.jsx`
- **Action:**
  - Import `OrderDetailModal`.
  - Add `selectedOrder` state.
  - Add `onClick={() => setSelectedOrder(order)}` on table rows (`<tr>`), styling them with `cursor-pointer`.
  - Conditional lock rendering: Display 🔒 if `order.cash_cut_id` exists OR `order.sesion_caja_id` exists + `status === delivered`.

### Phase 3: Socratic Verification
(Skipping Socratic gate as per agent rules to wait for user clearance before coding)
- **Check 1:** Should the modal allow edits to the order (re-opening, refunding) inside the report, or should it be Read-Only?
- **Check 2:** Is the lock expected for ANY closed order or strictly ones cut inside a explicit Blind Cash Cut logic?

---

## 4. Agent Assignments
- **Backend Specialist:** Execute Phase 1 (Data Fetch & Column resolution).
- **Frontend Specialist:** Execute Phase 2 (Modal injection & UI logic implementation).
- **Project Planner:** Monitor step progression.
