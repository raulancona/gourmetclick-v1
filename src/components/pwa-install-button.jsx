import { useState } from 'react'
import { Download, X, CheckCircle2, Share, PlusSquare, Info } from 'lucide-react'
import { usePwaInstall } from '../hooks/use-pwa-install'

/**
 * Floating PWA install button with animated prompt.
 * Now handles iOS and unsupported browsers gracefully by showing instructions.
 */
export function PwaInstallButton() {
    const {
        isInstallable,
        isInstalled,
        triggerInstall,
        isIOS,
        isFirefox,
        isSafari,
        supportsNativePrompt
    } = usePwaInstall()

    const [dismissed, setDismissed] = useState(false)
    const [installing, setInstalling] = useState(false)
    const [success, setSuccess] = useState(false)
    const [showInstructions, setShowInstructions] = useState(false)

    // Solo ocultamos de base si está instalada o descartada
    // Si estamos en iOS, forzamos mostrarla (isInstallable a true desde el hook)
    if (isInstalled || dismissed) return null
    if (!isInstallable && !isIOS && !isFirefox && !showInstructions) return null

    const handleInstallClick = async () => {
        if (supportsNativePrompt) {
            setInstalling(true)
            const accepted = await triggerInstall()
            setInstalling(false)
            if (accepted) {
                setSuccess(true)
                setTimeout(() => setDismissed(true), 2000)
            }
        } else {
            // No soporta prompt nativo, mostrar instrucciones
            setShowInstructions(true)
        }
    }

    if (showInstructions) {
        return (
            <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white dark:bg-zinc-900 border border-border rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="relative p-6">
                        <button
                            onClick={() => {
                                setShowInstructions(false)
                                setDismissed(true)
                            }}
                            className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-black border border-primary/30 p-1">
                                <img src="/pwa-icon.svg" alt="App Icon" className="w-full h-full object-cover" />
                            </div>

                            <div>
                                <h3 className="text-lg font-semibold text-foreground">Instalar Gourmet Click</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Instala la aplicación para un acceso rápido y una mejor experiencia.
                                </p>
                            </div>

                            <div className="w-full bg-secondary/50 rounded-lg p-4 mt-2 text-left space-y-3">
                                {isIOS ? (
                                    <>
                                        <p className="text-sm font-medium text-foreground flex items-center gap-2">
                                            <Info size={16} className="text-primary" />
                                            En tu iPhone o iPad:
                                        </p>
                                        <ol className="text-sm text-muted-foreground space-y-2 pl-6 list-decimal marker:text-primary marker:font-bold">
                                            <li>Toca el botón compartir <Share size={14} className="inline mx-1" /> en la barra inferior.</li>
                                            <li>Desliza hacia abajo y toca <strong>"Agregar a inicio"</strong> <PlusSquare size={14} className="inline mx-1" />.</li>
                                            <li>Toca <strong>"Agregar"</strong> en la esquina superior derecha.</li>
                                        </ol>
                                        {!isSafari && (
                                            <p className="text-xs text-amber-600 dark:text-amber-500 mt-3 pt-3 border-t border-border/50">
                                                Nota: Debes abrir esta página en <strong>Safari</strong> para ver la opción de instalar.
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <p className="text-sm font-medium text-foreground flex items-center gap-2">
                                            <Info size={16} className="text-primary" />
                                            En {isFirefox ? 'Firefox' : 'tu navegador'}:
                                        </p>
                                        <ul className="text-sm text-muted-foreground space-y-2 pl-4 list-disc marker:text-primary">
                                            <li>Abre el menú de tu navegador (los tres puntos o líneas).</li>
                                            <li>Selecciona <strong>"Instalar aplicación"</strong> o <strong>"Añadir a pantalla de inicio"</strong>.</li>
                                            <li>Sigue las instrucciones en pantalla.</li>
                                        </ul>
                                    </>
                                )}
                            </div>

                            <button
                                onClick={() => {
                                    setShowInstructions(false)
                                    setDismissed(true)
                                }}
                                className="w-full mt-2 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="pwa-install-banner">
            <div className="pwa-install-icon-wrap">
                <img src="/pwa-icon.svg" alt="Gourmet Click" className="pwa-install-app-icon" />
            </div>

            <div className="pwa-install-text">
                <span className="pwa-install-title">Instalar Gourmet Click</span>
                <span className="pwa-install-subtitle">Acceso rápido desde tu pantalla de inicio</span>
            </div>

            <div className="pwa-install-actions">
                {success ? (
                    <div className="pwa-install-success">
                        <CheckCircle2 size={20} />
                        <span>¡Listo!</span>
                    </div>
                ) : (
                    <button
                        onClick={handleInstallClick}
                        disabled={installing}
                        className="pwa-install-btn"
                        aria-label="Instalar aplicación"
                    >
                        {installing ? (
                            <span className="pwa-install-spinner" />
                        ) : (
                            <>
                                <Download size={16} />
                                <span>Instalar</span>
                            </>
                        )}
                    </button>
                )}

                <button
                    onClick={() => setDismissed(true)}
                    className="pwa-install-dismiss"
                    aria-label="Cerrar"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    )
}
