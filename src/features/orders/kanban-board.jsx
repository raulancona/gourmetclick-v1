import React, { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Clock, MessageCircle, ChevronRight, GripVertical } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import { ORDER_STATUSES, getNextStatuses } from '../../lib/order-service'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

const ACTION_LABELS = {
    pending: 'Aceptar',
    confirmed: 'Preparar',
    preparing: 'Listo',
    ready: 'En Camino',
    on_the_way: 'Entregar',
    delivered: 'Cobrar'
}

// Format the time since creation in mm:ss or hh:mm
function ElapsedTime({ createdAt }) {
    const [elapsed, setElapsed] = useState({ mins: 0, text: '0m' })

    useEffect(() => {
        const update = () => {
            const diffMs = Date.now() - new Date(createdAt).getTime()
            const mins = Math.floor(diffMs / 60000)
            const hrs = Math.floor(mins / 60)

            let text = `${mins}m`
            if (hrs > 0) text = `${hrs}h ${mins % 60}m`

            setElapsed({ mins, text })
        }

        update()
        const interval = setInterval(update, 60000)
        return () => clearInterval(interval)
    }, [createdAt])

    const isLate = elapsed.mins > 20
    const isWarning = elapsed.mins > 15 && !isLate

    return (
        <span className={`inline-flex items-center gap-1 font-black text-[10px] px-1.5 py-0.5 rounded shadow-sm border ${isLate ? 'bg-red-600 text-white border-red-700 animate-pulse' :
            isWarning ? 'bg-amber-500 text-white border-amber-600' :
                'bg-emerald-500 text-white border-emerald-600'
            }`}>
            <Clock className="w-3 h-3" /> {elapsed.text}
        </span>
    )
}

function KanbanCard({ order, onClick, onAdvanceStatus, index }) {
    const items = Array.isArray(order.items) ? order.items : []
    const [isAdvancing, setIsAdvancing] = useState(false)

    const diffMs = Date.now() - new Date(order.created_at).getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const isLate = diffMins > 20

    const nextStatuses = getNextStatuses(order.status)
    const nextStatusId = nextStatuses.length > 0 ? nextStatuses[0] : null
    const nextStatusInfo = nextStatusId ? ORDER_STATUSES[nextStatusId] : null

    const handleAdvance = async (e) => {
        e.stopPropagation()
        if (!nextStatusId || isAdvancing) return
        setIsAdvancing(true)
        try {
            await onAdvanceStatus(order.id, nextStatusId)
        } finally {
            setIsAdvancing(false)
        }
    }

    const openWhatsApp = (e) => {
        e.stopPropagation()
        if (!order.phone) return alert('No hay teléfono registrado para esta orden.')
        const encoded = encodeURIComponent(`Hola ${order.customer_name}, te escribimos de Gourmet Click. ¡Tu orden va en camino!`)
        window.open(`https://wa.me/${order.phone}?text=${encoded}`, '_blank')
    }

    return (
        <Draggable draggableId={String(order.id)} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    onClick={() => onClick(order)}
                    className={`bg-card rounded-xl p-3 mb-3 cursor-pointer transition-all border-l-4 ${isLate ? 'border-l-red-500 shadow-red-500/10' : 'border-l-primary/60'
                        } border-t border-r border-b border-border/50 ${snapshot.isDragging ? 'shadow-2xl scale-[1.02] z-50 ring-2 ring-primary/40 rotate-1' : 'hover:-translate-y-1 hover:shadow-lg shadow-sm'}`}
                >
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-start gap-2">
                            <div {...provided.dragHandleProps} className="mt-0.5 text-muted-foreground/30 hover:text-foreground cursor-grab active:cursor-grabbing">
                                <GripVertical className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-black text-sm text-foreground leading-tight">{order.customer_name || 'Cliente'}</h4>
                                <span className="text-[10px] text-muted-foreground font-bold">#{order.folio || String(order.id).slice(0, 5)}</span>
                            </div>
                        </div>
                        <ElapsedTime createdAt={order.created_at} />
                    </div>

                    <div className="bg-muted/40 rounded-lg p-2 mb-2 max-h-24 overflow-y-auto custom-scrollbar text-xs">
                        {items.slice(0, 3).map((item, i) => (
                            <div key={i} className="flex justify-between items-start mb-1 last:mb-0">
                                <span className="font-semibold truncate pr-2"><span className="text-primary mr-1">{item.quantity}x</span>{item.product?.name || item.name}</span>
                            </div>
                        ))}
                        {items.length > 3 && <span className="text-[10px] text-muted-foreground font-bold">+ {items.length - 3} más</span>}
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
                        <span className="font-black text-sm text-foreground">{formatCurrency(order.total)}</span>

                        <div className="flex gap-1.5">
                            {(order.order_type === 'delivery' || order.phone) && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg shadow-sm"
                                    onClick={openWhatsApp}
                                    title="Avisar por WhatsApp"
                                >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                </Button>
                            )}

                            {nextStatusInfo && (
                                <button
                                    onClick={handleAdvance}
                                    disabled={isAdvancing}
                                    className="h-7 px-2.5 rounded-lg text-[10px] font-black text-white flex items-center gap-1 shadow-sm transition-all active:scale-95 hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
                                    style={{ background: nextStatusInfo.color }}
                                    title={`Avanzar a: ${nextStatusInfo.label}`}
                                >
                                    {isAdvancing ? (
                                        <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <span>{nextStatusInfo.emoji}</span>
                                            <span className="hidden sm:inline">{ACTION_LABELS[nextStatusId] || nextStatusInfo.label}</span>
                                            <ChevronRight className="w-3 h-3" />
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Draggable>
    )
}

function KanbanColumn({ colId, title, emoji, color, orders, onClickOrder, onAdvanceStatus }) {
    return (
        <div className="flex flex-col flex-1 min-w-[280px] max-w-[320px] bg-muted/20 rounded-2xl p-2 border border-border/40 shrink-0 h-full">
            <div className="flex items-center justify-between px-3 py-2 mb-2 rounded-xl border border-white/10" style={{ background: color }}>
                <h3 className="font-black text-white text-sm flex items-center gap-2">
                    <span>{emoji}</span> {title}
                </h3>
                <span className="bg-white/20 text-white text-xs font-black px-2 py-0.5 rounded-full shadow-inner">
                    {orders.length}
                </span>
            </div>

            <Droppable droppableId={colId}>
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 overflow-y-auto custom-scrollbar p-1 rounded-xl transition-colors ${snapshot.isDraggingOver ? 'bg-muted/50 border-2 border-dashed border-primary/50' : ''}`}
                    >
                        {orders.length === 0 ? (
                            <div className="h-24 flex items-center justify-center border-2 border-dashed border-border/50 rounded-xl m-2">
                                <span className="text-xs font-bold text-muted-foreground">Columna vacía</span>
                            </div>
                        ) : (
                            orders.map((order, index) => (
                                <KanbanCard
                                    key={order.id}
                                    order={order}
                                    index={index}
                                    onClick={onClickOrder}
                                    onAdvanceStatus={onAdvanceStatus}
                                />
                            ))
                        )}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
        </div>
    )
}

export function KanbanBoard({ orders, onOrderClick, onAdvanceStatus }) {
    const [localOrders, setLocalOrders] = useState(orders)

    useEffect(() => {
        setLocalOrders(orders)
    }, [orders])

    const columns = [
        { id: 'pending', title: 'Recibidas', emoji: '🕐', color: ORDER_STATUSES.pending.color, statuses: ['pending'] },
        { id: 'preparing', title: 'En Preparación', emoji: '👨‍🍳', color: ORDER_STATUSES.preparing.color, statuses: ['confirmed', 'preparing'] },
        { id: 'ready', title: 'Listas', emoji: '📦', color: ORDER_STATUSES.ready.color, statuses: ['ready'] },
        { id: 'on_the_way', title: 'En Camino', emoji: '🛵', color: ORDER_STATUSES.on_the_way.color, statuses: ['on_the_way'] },
    ]

    // Shared optimistic update — used by BOTH drag AND button
    const handleAdvanceOptimistic = useCallback((orderId, newStatus) => {
        // 1. Move card locally right away
        setLocalOrders(prev => prev.map(o =>
            String(o.id) === String(orderId) ? { ...o, status: newStatus } : o
        ))
        // 2. Fire server mutation (parent handles invalidation/rollback on error)
        onAdvanceStatus(orderId, newStatus)
    }, [onAdvanceStatus])

    const onDragEnd = (result) => {
        const { destination, source, draggableId } = result
        if (!destination) return
        if (destination.droppableId === source.droppableId && destination.index === source.index) return

        const targetCol = columns.find(c => c.id === destination.droppableId)
        if (!targetCol) return

        handleAdvanceOptimistic(draggableId, targetCol.statuses[0])
    }

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-4 h-full min-h-[500px]">
                {columns.map(col => {
                    const colOrders = localOrders.filter(o => col.statuses.includes(o.status))
                    return (
                        <KanbanColumn
                            key={col.id}
                            colId={col.id}
                            title={col.title}
                            emoji={col.emoji}
                            color={col.color}
                            orders={colOrders}
                            onClickOrder={onOrderClick}
                            onAdvanceStatus={handleAdvanceOptimistic}
                        />
                    )
                })}
            </div>
        </DragDropContext>
    )
}
