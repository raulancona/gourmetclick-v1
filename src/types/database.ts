export type SessionStatus = 'abierta' | 'cerrada';

export interface CashSession {
    id: string;
    restaurante_id: string;
    empleado_id: string | null;
    estado: SessionStatus;
    fondo_inicial: number;
    monto_esperado: number | null;
    monto_real: number | null;
    diferencia: number | null;
    opened_at: string;
    closed_at: string | null;
    created_at: string;
    // Joined data
    empleado?: {
        nombre: string;
    };
}

export interface Order {
    id: string;
    user_id: string;
    sesion_caja_id: string | null;
    total: number;
    status: string;
    payment_method: string;
    items: any[];
    created_at: string;
}

export interface Gasto {
    id: string;
    sucursal_id: string;
    sesion_caja_id: string | null;
    monto: number;
    descripcion: string | null;
    categoria: string;
    created_at: string;
}
