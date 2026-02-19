import { useState, useRef } from 'react'
import { Upload, FileText, AlertCircle, CheckCircle2, RefreshCw, Loader2, Package } from 'lucide-react'
import Papa from 'papaparse'
import { Button } from '../../components/ui/button'
import { cn } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'
import { toast } from 'sonner'

/**
 * CSV Format:
 * nombre, categoria, precio, costo, imagen_url
 */

export function CSVUpload({ onImport, onCancel }) {
    const { user } = useAuth()
    const [file, setFile] = useState(null)
    const [processedData, setProcessedData] = useState(null)
    const [errors, setErrors] = useState([])
    const [isDragging, setIsDragging] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [importProgress, setImportProgress] = useState('')
    const fileInputRef = useRef(null)

    const processRows = (rows) => {
        const products = []
        const validationErrors = []

        rows.forEach((row, index) => {
            const rowNum = index + 2
            const name = row.nombre || row.name
            const priceRaw = row.precio || row.price

            if (name?.trim()) {
                if (!priceRaw || isNaN(parseFloat(priceRaw))) {
                    validationErrors.push(`Fila ${rowNum}: "${name}" requiere un precio válido`)
                    return
                }

                const costoRaw = row.costo || 0
                const costo = isNaN(parseFloat(costoRaw)) ? 0 : parseFloat(costoRaw)

                products.push({
                    name: name.trim(),
                    category: (row.categoria || row.category)?.trim() || null,
                    price: parseFloat(priceRaw),
                    costo: costo,
                    image_url: (row.imagen_url || row.image_url)?.trim() || null,
                    is_available: true
                })
            }
        })

        return { products, validationErrors }
    }

    const handleFileChange = (selectedFile) => {
        if (!selectedFile) return
        if (!selectedFile.name.endsWith('.csv')) {
            toast.error('Selecciona un archivo CSV')
            return
        }
        setFile(selectedFile)
        setErrors([])

        Papa.parse(selectedFile, {
            header: true,
            skipEmptyLines: 'greedy',
            complete: (results) => {
                const { products, validationErrors } = processRows(results.data)
                setErrors(validationErrors)
                setProcessedData(products)
            },
            error: (error) => toast.error('Error CSV: ' + error.message)
        })
    }

    const handleImport = async () => {
        if (!processedData || errors.length > 0 || !user) return
        setIsImporting(true)
        try {
            setImportProgress('Limpiando datos...')
            await supabase.from('products').delete().eq('user_id', user.id)
            await supabase.from('categories').delete().eq('user_id', user.id)

            setImportProgress('Creando categorías...')
            const categoryNames = [...new Set(processedData.map(p => p.category).filter(Boolean))]
            const categoryMap = {}

            for (let i = 0; i < categoryNames.length; i++) {
                const { data: cat } = await supabase.from('categories')
                    .insert([{ name: categoryNames[i], user_id: user.id, order_index: i }])
                    .select().single()
                if (cat) categoryMap[categoryNames[i].toLowerCase()] = cat.id
            }

            setImportProgress('Importando productos...')
            let total = 0
            for (const item of processedData) {
                const { error } = await supabase.from('products').insert([{
                    name: item.name,
                    price: item.price,
                    costo: item.costo,
                    image_url: item.image_url,
                    user_id: user.id,
                    category_id: item.category ? categoryMap[item.category.toLowerCase()] || null : null,
                    is_available: true
                }])
                if (!error) total++
                setImportProgress(`Importando... ${total}/${processedData.length}`)
            }

            toast.success(`${total} productos importados correctamente`)
            onImport(processedData)
        } catch (error) {
            console.error('Import error:', error)
            toast.error('Error: ' + error.message)
        } finally {
            setIsImporting(false)
            setImportProgress('')
        }
    }

    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true) }
    const handleDragLeave = () => setIsDragging(false)
    const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); handleFileChange(e.dataTransfer.files[0]) }

    return (
        <div className="space-y-6">
            {!processedData ? (
                <div className="space-y-4">
                    <div
                        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={cn('border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all',
                            isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30')}
                    >
                        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-sm text-foreground mb-1 font-bold">Haz clic o arrastra tu CSV</p>
                        <p className="text-xs text-muted-foreground">Formato: nombre, categoria, precio, costo, imagen_url</p>
                    </div>
                    <input ref={fileInputRef} type="file" accept=".csv" onChange={(e) => handleFileChange(e.target.files[0])} className="hidden" />

                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                        <div className="flex items-start gap-3">
                            <RefreshCw className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-amber-900 dark:text-amber-400">Modo Reemplazo</p>
                                <p className="text-xs text-amber-700 dark:text-amber-500/80">Se reemplazarán todos los productos y categorías actuales.</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-muted/30 rounded-xl space-y-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-center">Ejemplo de formato</p>
                        <pre className="text-[10px] bg-background border border-border p-3 rounded-lg overflow-x-auto font-mono">
                            {`nombre,categoria,precio,costo,imagen_url
Hamburguesa Clásica,Hamburguesas,120,45.50,https://ejemplo.com/h.jpg
Ensalada,Ensaladas,85,25,`}
                        </pre>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl border border-border">
                        <FileText className="w-8 h-8 text-primary" />
                        <div className="flex-1">
                            <p className="font-bold text-foreground text-sm">{file.name}</p>
                            <p className="text-xs text-muted-foreground">{processedData.length} productos listos</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => { setFile(null); setProcessedData(null); setErrors([]) }}>Cambiar</Button>
                    </div>

                    {errors.length > 0 && (
                        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                                <div>
                                    <p className="font-bold text-destructive text-sm leading-tight mb-1">{errors.length} errores encontrados</p>
                                    <ul className="text-xs text-destructive/80 list-disc list-inside">
                                        {errors.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="border border-border rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-muted border-b border-border sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 font-black uppercase tracking-widest text-muted-foreground">Nombre</th>
                                    <th className="px-4 py-3 font-black uppercase tracking-widest text-muted-foreground">Categoría</th>
                                    <th className="px-4 py-3 font-black uppercase tracking-widest text-muted-foreground text-right">Precio</th>
                                    <th className="px-4 py-3 font-black uppercase tracking-widest text-muted-foreground text-right">Costo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {processedData.slice(0, 10).map((p, i) => (
                                    <tr key={i} className="hover:bg-muted/20">
                                        <td className="px-4 py-3 font-bold">{p.name}</td>
                                        <td className="px-4 py-3 text-muted-foreground uppercase font-semibold text-[10px]">{p.category || '—'}</td>
                                        <td className="px-4 py-3 text-right font-black text-primary">${p.price.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-right font-black text-destructive">${p.costo.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <Button variant="outline" onClick={onCancel}>Cancelar</Button>
                <Button
                    onClick={handleImport}
                    disabled={!processedData || errors.length > 0 || isImporting}
                    className="font-bold"
                >
                    {isImporting ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {importProgress}
                        </>
                    ) : (
                        `Importar ${processedData?.length || 0} Productos`
                    )}
                </Button>
            </div>
        </div>
    )
}
