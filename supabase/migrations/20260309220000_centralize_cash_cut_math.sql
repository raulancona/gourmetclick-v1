CREATE OR REPLACE FUNCTION public.stamp_cash_cut_orders(
    p_session_id uuid,
    p_restaurant_id uuid,
    p_user_id uuid,
    p_monto_real numeric,
    p_closed_by_name text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cut_id UUID;
    v_total_cash NUMERIC := 0;
    v_total_card NUMERIC := 0;
    v_total_transfer NUMERIC := 0;
    v_total_amount NUMERIC := 0;
    v_order_count INTEGER := 0;
    v_total_gastos NUMERIC := 0;
    v_fondo_inicial NUMERIC := 0;
    v_monto_esperado NUMERIC := 0;
    v_diferencia NUMERIC := 0;
    v_opened_by_user_name TEXT := 'Desconocido';
BEGIN
    -- Verify the session belongs to this restaurant and get metadata
    SELECT fondo_inicial, opened_by_user_name 
    INTO v_fondo_inicial, v_opened_by_user_name
    FROM sesiones_caja
    WHERE id = p_session_id
      AND restaurante_id = p_restaurant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session does not belong to this restaurant';
    END IF;

    -- Calculate totals from uncut delivered orders
    -- We do this centrally here because SECURITY DEFINER ignores RLS,
    -- allowing us to see all orders from all staff members.
    SELECT
        COALESCE(SUM(CASE WHEN payment_method = 'cash' OR payment_method IS NULL THEN total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN payment_method = 'transfer' THEN total ELSE 0 END), 0),
        COALESCE(SUM(total), 0),
        COUNT(*)
    INTO v_total_cash, v_total_card, v_total_transfer, v_total_amount, v_order_count
    FROM orders
    WHERE (restaurant_id = p_restaurant_id OR user_id = p_restaurant_id)
      AND status = 'delivered'
      AND cash_cut_id IS NULL;

    -- Calculate total expenses for this session
    SELECT COALESCE(SUM(monto), 0) INTO v_total_gastos
    FROM gastos
    WHERE sesion_caja_id = p_session_id;

    -- Perform authoritative Math on the Server
    v_monto_esperado := v_fondo_inicial + v_total_cash - v_total_gastos;
    v_diferencia := p_monto_real - v_monto_esperado;

    -- 1. Create the cash_cuts record safely with mathematical truth
    INSERT INTO cash_cuts (
        restaurant_id, user_id, cut_date, 
        total_cash, total_card, total_transfer, total_amount, order_count,
        fondo_inicial, monto_esperado, monto_real, diferencia,
        opened_by_user_name, closed_by_user_name, nombre_cajero
    )
    VALUES (
        p_restaurant_id, 
        COALESCE(p_user_id, p_restaurant_id), 
        NOW(),
        v_total_cash, v_total_card, v_total_transfer, v_total_amount, v_order_count,
        v_fondo_inicial, v_monto_esperado, p_monto_real, v_diferencia,
        v_opened_by_user_name, p_closed_by_name, p_closed_by_name
    )
    RETURNING id INTO v_cut_id;

    -- 2. Update and Close the Session linking it mathematically
    UPDATE sesiones_caja
    SET estado = 'cerrada',
        monto_esperado = v_monto_esperado,
        monto_real = p_monto_real,
        diferencia = v_diferencia,
        closed_at = NOW(),
        cerrado_por = p_user_id,
        nombre_cajero = p_closed_by_name,
        closed_by_user_name = p_closed_by_name
    WHERE id = p_session_id;

    -- 3. Stamp ALL uncut Por Liquidar orders (delivered + cancelled) with the new cut ID
    UPDATE orders
    SET cash_cut_id = v_cut_id
    WHERE (restaurant_id = p_restaurant_id OR user_id = p_restaurant_id)
      AND status IN ('delivered', 'cancelled')
      AND cash_cut_id IS NULL;

    RETURN v_cut_id;
END;
$$;
