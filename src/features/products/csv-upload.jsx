import { useState, useRef } from 'react'
import { Upload, FileText, AlertCircle, CheckCircle2, RefreshCw, Loader2, Package, Download } from 'lucide-react'
import Papa from 'papaparse'
import { Button } from '../../components/ui/button'
import { cn } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'
import { useTenant } from '../auth/tenant-context'
import { toast } from 'sonner'

/**
 * CSV Format Example:
 * nombre, categoria, precio, costo, sku, descripcion, disponible, vegano, extras, imagen_url
 */

export function CSVUpload({ onImport, onCancel }) {
    const { user } = useAuth()
    const { tenant } = useTenant()
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
                    validationErrors.push(`Fila ${rowNum}: "${name}" requiere un precio numérico`)
                    return
                }

                const costoRaw = row.costo || row.cost || 0
                const costo = isNaN(parseFloat(costoRaw)) ? 0 : parseFloat(costoRaw)

                // Boolean parsers
                const parseBool = (val, defaultVal) => {
                    if (!val) return defaultVal;
                    const v = val.toString().toLowerCase().trim();
                    return v === 'true' || v === '1' || v === 'si' || v === 'sí' || v === 'yes';
                }

                products.push({
                    name: name.trim(),
                    description: (row.descripcion || row.description)?.trim() || null,
                    category: (row.categoria || row.category)?.trim() || null,
                    price: parseFloat(priceRaw),
                    costo: costo,
                    sku: (row.sku || row.codigo)?.trim() || null,
                    image_url: (row.imagen_url || row.image_url)?.trim() || null,
                    is_available: row.disponible !== undefined ? parseBool(row.disponible, true) : true,
                    is_vegan: parseBool(row.vegano || row.vegan, false),
                    has_extras: parseBool(row.extras || row.has_extras, false),
                    is_active: true
                })
            }
        })

        return { products, validationErrors }
    }

    const downloadTemplate = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const headers = ["sku", "nombre", "categoria", "precio", "costo", "descripcion", "disponible", "vegano", "extras", "imagen_url"];
        const examples = ["HAM-01", "Hamburguesa Clásica", "Hamburguesas", "120.00", "45.50", "Deliciosa hamburguesa con queso", "true", "false", "true", "https://ejemplo.com/foto.jpg"];
        
        const csvContent = "\uFEFF" + headers.join(",") + "\n" + examples.join(","); // Add BOM for Excel UTF-8 compatibility
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "plantilla_productos.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
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
        if (!processedData || errors.length > 0 || !user || !tenant) return
        setIsImporting(true)
        try {
            setImportProgress('Preparando catálogo...')
            
            // 1. Soft-delete current products instead of hard delete to preserve order history
            await supabase.from('products')
                .update({ is_active: false, is_available: false })
                .eq('restaurant_id', tenant.id)

            // 2. Fetch existing categories to reuse them
            setImportProgress('Actualizando categorías...')
            const { data: existingCategories } = await supabase
                .from('categories')
                .select('id, name')
                .eq('restaurant_id', tenant.id)

            const categoryMap = {}
            if (existingCategories) {
                existingCategories.forEach(c => {
                    categoryMap[c.name.toLowerCase()] = c.id
                })
            }

            // Identify and insert missing categories
            const newCategoryNames = [...new Set(processedData.map(p => p.category).filter(Boolean))]
            for (let i = 0; i < newCategoryNames.length; i++) {
                const catName = newCategoryNames[i]
                if (!categoryMap[catName.toLowerCase()]) {
                    const { data: insertedCat } = await supabase.from('categories')
                        .insert([{ 
                            name: catName, 
                            user_id: user.id, // Legacy compatibility
                            restaurant_id: tenant.id, 
                            order_index: Object.keys(categoryMap).length + i 
                        }])
                        .select().single()
                    
                    if (insertedCat) {
                        categoryMap[catName.toLowerCase()] = insertedCat.id
                    }
                }
            }

            // 3. Import new products in chunks
            setImportProgress('Importando productos...')
            let total = 0
            
            // Batch inserts in chunks of 50 for performance
            const chunkSize = 50
            for (let i = 0; i < processedData.length; i += chunkSize) {
                const chunk = processedData.slice(i, i + chunkSize).map(item => ({
                    ...item,
                    user_id: user.id, // Legacy compatibility
                    restaurant_id: tenant.id,
                    category_id: item.category ? categoryMap[item.category.toLowerCase()] || null : null,
                    status: 'disponible'
                }))
                
                // Remove the string category field before inserting
                const rowsToInsert = chunk.map(({ category, ...rest }) => rest)

                const { error } = await supabase.from('products').insert(rowsToInsert)
                if (error) throw error
                
                total += rowsToInsert.length
                setImportProgress(`Importando... ${total}/${processedData.length}`)
            }

            toast.success(`${total} productos sincronizados correctamente`)
            if (onImport) onImport()
        } catch (error) {
            console.error('Import error:', error)
            toast.error('Error al importar: ' + error.message)
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
                        <p className="text-xs text-muted-foreground mb-4">Formato incl. sku, nombre, categoria, precio, costo, etc.</p>
                        
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            className="mt-2"
                            onClick={downloadTemplate}
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Descargar Plantilla CSV
                        </Button>
                    </div>
                    <input ref={fileInputRef} type="file" accept=".csv" onChange={(e) => handleFileChange(e.target.files[0])} className="hidden" />

                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                        <div className="flex items-start gap-3">
                            <RefreshCw className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-amber-900 dark:text-amber-400">Modo Reemplazo Seguro</p>
                                <p className="text-xs text-amber-700 dark:text-amber-500/80">Los productos anteriores serán ocultados (Soft-Delete) para no afectar tu historial de órdenes. Se crearán los nuevos.</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-muted/30 rounded-xl space-y-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-center">Columnas Soportadas (Ejemplo)</p>
                        <pre className="text-[10px] bg-background border border-border p-3 rounded-lg overflow-x-auto font-mono text-muted-foreground">
                            {`nombre,categoria,precio,costo,sku,disponible,vegano,extras,imagen_url
Hamburguesa Clásica,Hamburguesas,120,45.50,HAM-01,true,false,true,https://url.com/h.jpg
Ensalada,Ensaladas,85,25,,true,true,false,`}
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
                                        {errors.length > 3 && <li>... y {errors.length - 3} más</li>}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="border border-border rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-muted border-b border-border sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 font-black uppercase tracking-widest text-muted-foreground">SKU / Nombre</th>
                                    <th className="px-4 py-3 font-black uppercase tracking-widest text-muted-foreground">Categoría</th>
                                    <th className="px-4 py-3 font-black uppercase tracking-widest text-muted-foreground text-center">Attrs</th>
                                    <th className="px-4 py-3 font-black uppercase tracking-widest text-muted-foreground text-right">Precio/Costo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {processedData.slice(0, 50).map((p, i) => (
                                    <tr key={i} className="hover:bg-muted/20">
                                        <td className="px-4 py-3">
                                            {p.sku && <span className="text-[9px] font-mono text-muted-foreground block">{p.sku}</span>}
                                            <span className="font-bold">{p.name}</span>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground uppercase font-semibold text-[10px]">{p.category || '—'}</td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex gap-1 justify-center">
                                                {p.is_vegan && <span className="w-2 h-2 rounded-full bg-green-500" title="Vegano" />}
                                                {p.has_extras && <span className="w-2 h-2 rounded-full bg-blue-500" title="Extras" />}
                                                {!p.is_available && <span className="w-2 h-2 rounded-full bg-red-500" title="Agotado" />}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className="font-black text-primary block">${p.price.toFixed(2)}</span>
                                            {p.costo > 0 && <span className="text-[10px] font-black text-destructive">${p.costo.toFixed(2)}</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {processedData.length > 50 && (
                            <div className="p-2 text-center text-[10px] font-bold text-muted-foreground bg-muted/50">
                                Mostrando 50 de {processedData.length}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <Button variant="outline" onClick={onCancel} disabled={isImporting}>Cancelar</Button>
                <Button
                    onClick={handleImport}
                    disabled={!processedData || errors.length > 0 || isImporting}
                    className="font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                    {isImporting ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {importProgress}
                        </>
                    ) : (
                        `Sincronizar ${processedData?.length || 0} Productos`
                    )}
                </Button>
            </div>
        </div>
    )
}
