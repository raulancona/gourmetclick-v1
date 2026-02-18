import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getLinkCardBySlug } from '../lib/link-card-service'
import { ExternalLink, Loader2, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export function PublicLinkCardPage() {
    const { slug } = useParams()
    const [loading, setLoading] = useState(true)
    const [config, setConfig] = useState(null)
    const [notFound, setNotFound] = useState(false)

    useEffect(() => {
        loadConfig()
    }, [slug])

    const loadConfig = async () => {
        try {
            setLoading(true)
            const data = await getLinkCardBySlug(slug)
            if (data) {
                setConfig(data)
            } else {
                setNotFound(true)
            }
        } catch (error) {
            console.error('Error loading LinkCard:', error)
            setNotFound(true)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#0a0a0a] text-white">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-sm font-medium animate-pulse">Cargando perfil...</p>
            </div>
        )
    }

    if (notFound || !config) {
        return (
            <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#0a0a0a] text-white p-6 text-center">
                <AlertCircle className="w-16 h-16 text-muted-foreground mb-6 opacity-30" />
                <h1 className="text-2xl font-black mb-2">Página no encontrada</h1>
                <p className="text-muted-foreground mb-8">El perfil que buscas no existe o ha sido modificado.</p>
                <a href="/" className="px-8 py-3 bg-white text-black rounded-full font-bold">Ir al Inicio</a>
            </div>
        )
    }

    const { theme } = config

    return (
        <div
            className="min-h-screen w-full flex flex-col items-center"
            style={{ background: theme.background, color: theme.textColor }}
        >
            <div className="w-full max-w-md px-6 py-12 md:py-20 flex flex-col items-center">
                {/* Profile Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="flex flex-col items-center text-center mb-10"
                >
                    {config.restaurant_logo_url ? (
                        <div className="relative mb-6">
                            <motion.div
                                className="absolute inset-0 rounded-full blur-xl opacity-20"
                                style={{ background: theme.textColor }}
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 4, repeat: Infinity }}
                            />
                            <img
                                src={config.restaurant_logo_url}
                                className="w-28 h-28 rounded-full border-4 border-white/10 shadow-2xl relative z-10 object-cover"
                                alt="logo"
                            />
                        </div>
                    ) : (
                        <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mb-6 shadow-xl border border-white/5">
                            <span className="text-3xl font-black opacity-30">{config.title?.[0]}</span>
                        </div>
                    )}

                    <h1 className="text-2xl font-black mb-2 tracking-tight">{config.title}</h1>
                    {config.bio && (
                        <p className="text-base opacity-75 font-medium leading-relaxed max-w-[280px]">
                            {config.bio}
                        </p>
                    )}
                </motion.div>

                {/* Links Section */}
                <div className="w-full flex flex-col gap-4">
                    <AnimatePresence>
                        {config.links?.map((link, idx) => (
                            <motion.a
                                key={link.id || idx}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.2 + idx * 0.1 }}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full p-4 rounded-2xl shadow-lg flex items-center justify-between gap-4 backdrop-blur-md transition-all group"
                                style={{
                                    background: theme.cardColor,
                                    border: theme.borderColor ? `1px solid ${theme.borderColor}` : '1px solid rgba(255,255,255,0.08)'
                                }}
                            >
                                <span className="font-bold text-lg flex-1">{link.title}</span>
                                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                                    <ExternalLink className="w-5 h-5 opacity-50" />
                                </div>
                            </motion.a>
                        ))}
                    </AnimatePresence>

                    {(!config.links || config.links.length === 0) && (
                        <p className="text-center opacity-30 py-10">Sin enlaces configurados</p>
                    )}
                </div>

                {/* Footer */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.4 }}
                    transition={{ delay: 1, duration: 1 }}
                    className="mt-20 flex flex-col items-center gap-1"
                >
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Powered by</span>
                    <span className="font-black text-xs tracking-tighter">GOURMET CLICK PRO</span>
                </motion.div>
            </div>
        </div>
    )
}
