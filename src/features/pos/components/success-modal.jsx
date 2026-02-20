import { Modal } from '../../../components/ui/modal'
import { Button } from '../../../components/ui/button'
import { CheckCircle2, Copy } from 'lucide-react'

export function SuccessModal({
    isOpen,
    onClose,
    createdOrder,
    onCopyTrackingLink
}) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="¡Venta Exitosa!"
        >
            <div className="space-y-6 text-center py-4">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-foreground mb-2">Orden Procesada</h3>
                    <p className="text-muted-foreground text-sm">El pedido se ha regitrado correctamente. Comparte el link de rastreo con tu cliente:</p>
                </div>

                <div className="flex items-center gap-2 bg-muted p-3 rounded-xl border border-border">
                    <input
                        readOnly
                        className="bg-transparent border-none text-xs flex-1 outline-none font-mono text-muted-foreground"
                        value={createdOrder ? `${window.location.origin}/rastreo/${createdOrder.tracking_id}` : ''}
                    />
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={onCopyTrackingLink}
                    >
                        <Copy className="w-4 h-4" />
                    </Button>
                </div>

                <div className="pt-4">
                    <Button className="w-full" onClick={onClose}>
                        Entendido
                    </Button>
                </div>
            </div>
        </Modal>
    )
}
