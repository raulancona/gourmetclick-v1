import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useTenant } from '../auth/tenant-context'
import { Monitor, Copy, Check, ExternalLink, QrCode, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { toast } from 'sonner'

export function TerminalAccessCard() {
    const { tenant } = useTenant()
    const [copied, setCopied] = useState(false)
    const [showQR, setShowQR] = useState(false)

    if (!tenant?.slug) return null

    const terminalUrl = `${window.location.origin}/t/${tenant.slug}`

    const handleCopy = () => {
        navigator.clipboard.writeText(terminalUrl)
        setCopied(true)
        toast.success('URL copiada al portapapeles')
        setTimeout(() => setCopied(false), 2000)
    }

    const handleOpen = () => window.open(terminalUrl, '_blank')

    return (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <Monitor className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-black text-foreground">Acceso al Terminal</h3>
                    <p className="text-xs text-muted-foreground font-medium">URL para que tu equipo ingrese</p>
                </div>
            </div>

            <div className="p-5 space-y-4">
                {/* URL Display */}
                <div className="bg-muted/40 rounded-xl p-3 flex items-center gap-3">
                    <code className="flex-1 text-sm font-mono text-primary truncate">{terminalUrl}</code>
                    <button
                        onClick={handleCopy}
                        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                    >
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                </div>

                {/* Instructions */}
                <p className="text-xs text-muted-foreground leading-relaxed">
                    Comparte esta URL con tu equipo o ábrela en la tablet del negocio.
                    Cada empleado entra con su PIN personal. No necesitan contraseña del dueño.
                </p>

                {/* Actions */}
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpen}
                        className="flex-1 rounded-xl font-bold gap-2 h-10"
                    >
                        <ExternalLink className="w-4 h-4" />
                        Abrir Terminal
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowQR(!showQR)}
                        className="flex-1 rounded-xl font-bold gap-2 h-10"
                    >
                        <QrCode className="w-4 h-4" />
                        {showQR ? 'Ocultar QR' : 'Ver QR'}
                        {showQR ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </Button>
                </div>

                {/* QR Code */}
                {showQR && (
                    <div className="flex flex-col items-center gap-3 pt-2 border-t border-border">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                            Escanea para abrir el terminal
                        </p>
                        <div className="p-4 bg-white rounded-2xl shadow-inner border border-border">
                            <QRCodeSVG
                                value={terminalUrl}
                                size={180}
                                level="H"
                                includeMargin={false}
                                fgColor="#09090b"
                                bgColor="#ffffff"
                            />
                        </div>
                        <p className="text-[10px] text-muted-foreground text-center">
                            Imprime o muestra este QR en tu negocio.
                            <br />
                            Cada empleado entra con su PIN único.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
