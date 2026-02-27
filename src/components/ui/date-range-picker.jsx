import { useState, useEffect } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import { Button } from './button'

const PRESETS = [
    { label: 'Hoy', days: 0 },
    { label: 'Ayer', days: 1, exact: true },
    { label: 'Últimos 7 días', days: 7 },
    { label: 'Últimos 30 días', days: 30 },
    { label: 'Este mes', type: 'month' }
]

export function DateRangePicker({ dateRange, onChange }) {
    const [isOpen, setIsOpen] = useState(false)
    const [customMode, setCustomMode] = useState(false)
    const [tempStart, setTempStart] = useState('')
    const [tempEnd, setTempEnd] = useState('')

    // Set initial custom dates if provided
    useEffect(() => {
        if (dateRange?.start && dateRange?.end) {
            setTempStart(dateRange.start.toISOString().split('T')[0])
            setTempEnd(dateRange.end.toISOString().split('T')[0])
        }
    }, [dateRange])

    const handlePresetClick = (preset) => {
        const end = new Date()
        let start = new Date()

        if (preset.type === 'month') {
            start = new Date(end.getFullYear(), end.getMonth(), 1)
        } else if (preset.exact) {
            start.setDate(start.getDate() - preset.days)
            end.setDate(end.getDate() - preset.days)
        } else {
            start.setDate(start.getDate() - preset.days)
        }

        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)

        onChange({ start, end, label: preset.label })
        setIsOpen(false)
        setCustomMode(false)
    }

    const handleCustomApply = () => {
        if (!tempStart || !tempEnd) return

        const start = new Date(tempStart + 'T00:00:00')
        const end = new Date(tempEnd + 'T23:59:59')

        onChange({
            start,
            end,
            label: `${start.toLocaleDateString('es-MX')} - ${end.toLocaleDateString('es-MX')}`
        })
        setIsOpen(false)
    }

    return (
        <div className="relative">
            <Button
                variant="outline"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full sm:w-[280px] justify-between text-left font-normal border-border bg-card h-12 rounded-xl hover:bg-muted/50"
            >
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span>{dateRange?.label || 'Seleccionar fecha'}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </Button>

            {isOpen && (
                <div className="absolute top-14 right-0 z-50 w-full sm:w-80 bg-popover border border-border/60 p-2 rounded-2xl shadow-xl">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mb-2">
                        {PRESETS.map((preset) => (
                            <Button
                                key={preset.label}
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePresetClick(preset)}
                                className="justify-start text-sm hover:bg-primary/10 hover:text-primary rounded-lg"
                            >
                                {preset.label}
                            </Button>
                        ))}
                    </div>

                    <div className="pt-2 border-t border-border/50">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-sm text-muted-foreground hover:bg-muted rounded-lg"
                            onClick={() => setCustomMode(!customMode)}
                        >
                            {customMode ? '← Volver a predefinidos' : 'Personalizado...'}
                        </Button>

                        {customMode && (
                            <div className="mt-3 space-y-3 p-1">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-muted-foreground ml-1">Desde</label>
                                    <input
                                        type="date"
                                        value={tempStart}
                                        onChange={(e) => setTempStart(e.target.value)}
                                        className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:ring-1 focus:ring-primary outline-none"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-muted-foreground ml-1">Hasta</label>
                                    <input
                                        type="date"
                                        value={tempEnd}
                                        onChange={(e) => setTempEnd(e.target.value)}
                                        min={tempStart}
                                        className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:ring-1 focus:ring-primary outline-none"
                                    />
                                </div>
                                <Button
                                    className="w-full rounded-xl bg-primary text-primary-foreground font-bold"
                                    size="sm"
                                    onClick={handleCustomApply}
                                    disabled={!tempStart || !tempEnd}
                                >
                                    Aplicar Rango
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Backdrop for closing */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    )
}
