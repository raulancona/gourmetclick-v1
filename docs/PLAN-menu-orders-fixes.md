# Project Plan: Menu & Orders Fixes

## Overview
This plan outlines the required fixes for three critical bugs reported in the Gourmet Click Pro application:
1.  **Public Menu Invisibility**: End customers (unauthenticated users) cannot see the public restaurant menu.
2.  **Missing Staff Section**: The "Staff" section has disappeared from the navigation menu/sidebar.
3.  **Order Logic & Statuses**: Orders are missing from the list, and some incorrectly show "Cerrada en Turno". Orders should only be closed via "corte de caja".

## Project Type
WEB (React, Supabase)

## Success Criteria
*   [ ] Unauthenticated users can successfully view all active categories and products on the public menu page.
*   [ ] The "Staff" management section is fully visible and accessible in the sidebar for users with appropriate roles (e.g., Owner/Admin).
*   [ ] All active/pending orders are correctly displayed on the orders screen without filtering out valid records.
*   [ ] The incorrect "Cerrada en Turno" status is eliminated from regular order workflows, and orders are only marked as processed during the "corte de caja" (cash cut) procedure.

## Tech Stack
*   **Frontend**: React (Vite), Tailwind CSS, React Router
*   **Backend/Data**: Supabase (PostgreSQL, Row Level Security)
*   **State Management**: Context API / Supabase Hooks

## File Structure & Affected Components
*   `src/pages/public-menu.jsx` (Frontend public view)
*   `src/features/dashboard/sidebar.jsx` (Navigation rendering & role checks)
*   `src/pages/orders.jsx` & `src/features/orders/order-list.jsx` (Order fetching and display logic)
*   Supabase SQL / RLS Policies (Potential changes to allow public SELECT on `categories` and `products`)

## Task Breakdown

### Task 1: Fix Public Menu Access (RLS & Fetch Logic)
*   **Agent**: `backend-specialist` + `frontend-specialist`
*   **Skills**: `database-design`, `react-best-practices`
*   **Description**: Ensure that the Supabase policies for `categories` and `products` allow unauthenticated reads (anon) for public menus, and verify the frontend fetches without requiring a user session.
*   **INPUT**: `src/pages/public-menu.jsx` and Supabase RLS.
*   **OUTPUT**: Working public menu loading items.
*   **VERIFY**: Load the public menu in an incognito window without logging in and verify data appears.

### Task 2: Restore Staff Section in Sidebar
*   **Agent**: `frontend-specialist`
*   **Skills**: `react-best-practices`
*   **Description**: Check `sidebar.jsx` for missing role checks or disabled links. Restore the "Staff" menu item for Admins/Owners.
*   **INPUT**: `src/features/dashboard/sidebar.jsx` and the user session context.
*   **OUTPUT**: Sidebar rendering the Staff section correctly based on permissions.
*   **VERIFY**: Log in as an owner/admin and successfully see and click the Staff menu item.

### Task 3: Correct Order Query Logic and Missing Orders
*   **Agent**: `backend-specialist`
*   **Skills**: `api-patterns`
*   **Description**: Review the Supabase query in the Orders page to ensure it correctly fetches all pending and completed orders for the current shift without dropping records due to incorrect filters or joins.
*   **INPUT**: `src/pages/orders.jsx` and order fetching hooks.
*   **OUTPUT**: Updated query correctly returning all orders.
*   **VERIFY**: Compare the real-time order feed with the database to confirm no orders are hidden.

### Task 4: Fix Invalid "Cerrada en Turno" Order Status
*   **Agent**: `backend-specialist`
*   **Skills**: `clean-code`
*   **Description**: Prevent the system from applying "Cerrada en Turno" directly to individual orders. Disconnect this state from the order flow and ensure orders are only considered "closed" during the final cash cut operation (`corte_caja`).
*   **INPUT**: `src/features/orders/` mutation logic and corresponding backend service.
*   **OUTPUT**: Order status flow that only uses valid states (Pending, Preparing, Ready, Delivered, Cancelled) and handles shift closure separately.
*   **VERIFY**: Process an order fully and verify it goes to "Delivered", then verify a cash cut correctly flags it as cut without corrupting the standard order UI status limit.

## ✅ PHASE X: Verification Checklist
*   [ ] No purple/violet hex codes used in any UI updates.
*   [ ] No standard template layouts used blindly.
*   [ ] Socratic Gate was respected.
*   [ ] `npm run lint && npx tsc --noEmit` passes.
*   [ ] `python .agent/skills/vulnerability-scanner/scripts/security_scan.py .` passes without criticals.
*   [ ] Full end-to-end test manually verified on local server (`npm run dev`).
