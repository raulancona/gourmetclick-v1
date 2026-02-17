import { useState, useRef } from 'react'
import { Upload, FileText, AlertCircle, CheckCircle2, RefreshCw, Loader2, Package, Puzzle } from 'lucide-react'
import Papa from 'papaparse'
import { Button } from '../../components/ui/button'
import { cn } from '../../lib/utils'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/auth-context'
import { toast } from 'sonner'

/**
 * CSV Format:
 *
 * name, price, category, sku, description, extra_name, extra_price, discount, vegan, badge
 *
 * Rules:
 * - Row with `name` + `price` → product
 * - Row with only `extra_name` + `extra_price` → modifier for last product
 * - A row can have both (product + first modifier)
 * - discount = percentage (0-100), vegan = si/yes/true, badge = emoji + text
 */

export function CSVUpload({ onImport, onCancel }) {
    const { user } = useAuth()
    const [file, setFile] = useState(null)
    const [parsedData, setParsedData] = useState(null)
    const [processedData, setProcessedData] = useState(null)
    const [errors, setErrors] = useState([])
    const [isDragging, setIsDragging] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [importProgress, setImportProgress] = useState('')
    const fileInputRef = useRef(null)

    const processRows = (rows) => {
        const products = []
        const validationErrors = []
        let currentProduct = null

        rows.forEach((row, index) => {
            const rowNum = index + 2
            const hasName = row.name?.trim()
            const hasPrice = row.price && !isNaN(parseFloat(row.price))
            const hasExtra = row.extra_name?.trim()

            if (hasName) {
                if (!hasPrice) { validationErrors.push(`Fila ${rowNum}: "${row.name}" necesita precio`); return }
                if (parseFloat(row.price) < 0) { validationErrors.push(`Fila ${rowNum}: Precio negativo`); return }

                const veganRaw = (row.vegan || '').trim().toLowerCase()
                const isVegan = ['si', 'sí', 'yes', 'true', '1'].includes(veganRaw)
                const discount = parseInt(row.discount) || 0

                currentProduct = {
                    name: row.name.trim(),
                    description: row.description?.trim() || null,
                    price: parseFloat(row.price),
                    sku: row.sku?.trim() || null,
                    category: row.category?.trim() || null,
                    discount_percent: Math.min(100, Math.max(0, discount)),
                    is_vegan: isVegan,
                    badge_text: row.badge?.trim() || null,
                    extras: []
                }
                products.push(currentProduct)

                if (hasExtra) {
                    const extraPrice = parseFloat(row.extra_price || 0)
                    if (isNaN(extraPrice)) { validationErrors.push(`Fila ${rowNum}: Precio extra inválido`); }
                    else { currentProduct.extras.push({ name: row.extra_name.trim(), extra_price: extraPrice }) }
                }
            }
            else if (hasExtra) {
                if (!currentProduct) { validationErrors.push(`Fila ${rowNum}: Extra sin producto`); return }
                const extraPrice = parseFloat(row.extra_price || 0)
                if (isNaN(extraPrice)) { validationErrors.push(`Fila ${rowNum}: Precio extra inválido`) }
                else { currentProduct.extras.push({ name: row.extra_name.trim(), extra_price: extraPrice }) }
            }
        })

        return { products, validationErrors }
    }

    const handleFileChange = (selectedFile) => {
        if (!selectedFile) return
        if (!selectedFile.name.endsWith('.csv')) { toast.error('Selecciona un archivo CSV'); return }
        setFile(selectedFile)
        setErrors([])

        Papa.parse(selectedFile, {
            header: true,
            skipEmptyLines: 'greedy',
            complete: (results) => {
                setParsedData(results.data)
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
            setImportProgress('Limpiando datos anteriores...')
            await supabase.from('modifier_options').delete().neq('id', '00000000-0000-0000-0000-000000000000')
            await supabase.from('modifier_groups').delete().neq('id', '00000000-0000-0000-0000-000000000000')
            await supabase.from('products').delete().eq('user_id', user.id)
            await supabase.from('categories').delete().eq('user_id', user.id)

            setImportProgress('Creando categorías...')
            const categoryNames = [...new Set(processedData.map(p => p.category).filter(Boolean))]
            const categoryMap = {}
            for (let i = 0; i < categoryNames.length; i++) {
                const { data: cat } = await supabase.from('categories').insert([{ name: categoryNames[i], user_id: user.id, order_index: i }]).select().single()
                if (cat) categoryMap[categoryNames[i].toLowerCase()] = cat.id
            }

            setImportProgress('Importando productos...')
            let totalProducts = 0, totalExtras = 0

            for (const item of processedData) {
                const { data: product, error: pErr } = await supabase.from('products').insert([{
                    name: item.name, description: item.description, price: item.price,
                    sku: item.sku, user_id: user.id,
                    category_id: item.category ? categoryMap[item.category.toLowerCase()] || null : null,
                    is_available: true,
                    discount_percent: item.discount_percent,
                    is_vegan: item.is_vegan,
                    badge_text: item.badge_text
                }]).select().single()

                if (pErr) { console.error('Product error:', pErr); continue }
                totalProducts++

                if (item.extras.length > 0) {
                    const { data: group } = await supabase.from('modifier_groups').insert([{
                        product_id: product.id, name: 'Extras', min_selection: 0, max_selection: item.extras.length
                    }]).select().single()

                    if (group) {
                        const options = item.extras.map(ext => ({ group_id: group.id, name: ext.name, extra_price: ext.extra_price }))
                        const { data: opts } = await supabase.from('modifier_options').insert(options).select()
                        if (opts) totalExtras += opts.length
                    }
                }
                setImportProgress(`Importando... ${totalProducts}/${processedData.length}`)
            }

            toast.success(`✅ ${totalProducts} productos, ${totalExtras} extras, ${categoryNames.length} categorías`)
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

    const stats = processedData ? {
        products: processedData.length,
        withExtras: processedData.filter(p => p.extras.length > 0).length,
        totalExtras: processedData.reduce((s, p) => s + p.extras.length, 0),
        categories: [...new Set(processedData.map(p => p.category).filter(Boolean))],
        veganCount: processedData.filter(p => p.is_vegan).length,
        discountCount: processedData.filter(p => p.discount_percent > 0).length,
        badgeCount: processedData.filter(p => p.badge_text).length
    } : null

    return (
        <div className="space-y-6">
            {!processedData ? (
                <div>
                    <div
                        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={cn('border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all',
                            isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50')}
                    >
                        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <p className="text-sm text-gray-600 mb-2">
                            <span className="font-medium text-blue-600">Haz clic</span> o arrastra tu CSV
                        </p>
                        <p className="text-xs text-gray-500">Columnas: name, price, category, sku, description, extra_name, extra_price, discount, vegan, badge</p>
                    </div>
                    <input ref={fileInputRef} type="file" accept=".csv" onChange={(e) => handleFileChange(e.target.files[0])} className="hidden" />

                    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <div className="flex items-start gap-3">
                            <RefreshCw className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-amber-900 mb-1">Modo Reemplazo</p>
                                <p className="text-xs text-amber-700">Se <strong>reemplazarán todos los productos, extras y categorías</strong>.</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                        <p className="text-sm font-medium text-gray-700 mb-3">Formato del CSV:</p>
                        <pre className="text-xs text-gray-600 overflow-x-auto bg-white p-3 rounded-lg border border-gray-200 leading-relaxed">
                            {`name,price,category,sku,description,extra_name,extra_price,discount,vegan,badge
Ensalada,85,Ensaladas,ENS-001,Mixta,,,,si,🥗 Saludable
Hamburguesa,120,Hamburguesas,HAM-001,Carne 150g,Extra queso,15,,,🔥 Top
,,,,,Extra tocino,20,,,
,,,,,Doble carne,35,,,
Pizza Pepe,180,Pizzas,PIZ-001,Mediana,Orilla rellena,30,15,,
Agua,25,Bebidas,BEB-001,Vaso grande,,,,, `}
                        </pre>
                        <div className="mt-3 space-y-1.5 text-xs text-gray-600">
                            <div className="flex items-center gap-2"><Package className="w-3.5 h-3.5 text-blue-500" /><span><strong>name+price</strong> = Producto</span></div>
                            <div className="flex items-center gap-2"><Puzzle className="w-3.5 h-3.5 text-purple-500" /><span><strong>extra_name+extra_price</strong> = Extra</span></div>
                            <div className="flex items-center gap-2"><span className="w-3.5 text-center">🏷️</span><span><strong>discount</strong> = % descuento (0-100)</span></div>
                            <div className="flex items-center gap-2"><span className="w-3.5 text-center">🌱</span><span><strong>vegan</strong> = si/yes/true</span></div>
                            <div className="flex items-center gap-2"><span className="w-3.5 text-center">⭐</span><span><strong>badge</strong> = texto/emoji para mostrar</span></div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                        <FileText className="w-8 h-8 text-blue-600" />
                        <div className="flex-1">
                            <p className="font-medium text-gray-900">{file.name}</p>
                            <p className="text-sm text-gray-600">
                                {stats.products} productos · {stats.totalExtras} extras · {stats.categories.length} categorías
                            </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => { setFile(null); setParsedData(null); setProcessedData(null); setErrors([]) }}>Cambiar</Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {stats.categories.map((cat, i) => <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">📂 {cat}</span>)}
                        {stats.withExtras > 0 && <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">🧩 {stats.withExtras} con extras</span>}
                        {stats.veganCount > 0 && <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">🌱 {stats.veganCount} veganos</span>}
                        {stats.discountCount > 0 && <span className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-medium">🏷️ {stats.discountCount} con descuento</span>}
                        {stats.badgeCount > 0 && <span className="px-3 py-1 bg-yellow-50 text-yellow-700 rounded-full text-xs font-medium">⭐ {stats.badgeCount} con badge</span>}
                    </div>

                    {errors.length > 0 ? (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                                <div>
                                    <p className="font-medium text-red-900 mb-2">{errors.length} errores:</p>
                                    <ul className="text-sm text-red-700 space-y-1">
                                        {errors.slice(0, 5).map((e, i) => <li key={i}>• {e}</li>)}
                                        {errors.length > 5 && <li className="font-medium">... y {errors.length - 5} más</li>}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                            <p className="text-sm text-green-900 font-medium">Archivo válido</p>
                        </div>
                    )}

                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="overflow-x-auto max-h-64">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-medium text-gray-700">Tipo</th>
                                        <th className="px-3 py-2 text-left font-medium text-gray-700">Nombre</th>
                                        <th className="px-3 py-2 text-left font-medium text-gray-700">Precio</th>
                                        <th className="px-3 py-2 text-left font-medium text-gray-700">Tags</th>
                                        <th className="px-3 py-2 text-left font-medium text-gray-700">Extras</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {processedData.slice(0, 15).map((p, i) => (
                                        <tr key={i} className="hover:bg-gray-50">
                                            <td className="px-3 py-2">
                                                {p.extras.length > 0
                                                    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs font-medium"><Puzzle className="w-3 h-3" />Compuesto</span>
                                                    : <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium"><Package className="w-3 h-3" />Simple</span>}
                                            </td>
                                            <td className="px-3 py-2 font-medium">{p.name}</td>
                                            <td className="px-3 py-2">
                                                {p.discount_percent > 0 ? (
                                                    <div>
                                                        <span className="line-through text-gray-400 text-xs">${p.price}</span>
                                                        <span className="text-green-700 ml-1 font-semibold">${(p.price * (1 - p.discount_percent / 100)).toFixed(0)}</span>
                                                        <span className="text-red-500 text-xs ml-1">-{p.discount_percent}%</span>
                                                    </div>
                                                ) : <span className="text-green-700">${p.price}</span>}
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex flex-wrap gap-1">
                                                    {p.is_vegan && <span className="text-xs px-1.5 py-0.5 bg-green-50 text-green-700 rounded-full">🌱</span>}
                                                    {p.badge_text && <span className="text-xs px-1.5 py-0.5 bg-yellow-50 text-yellow-700 rounded-full">{p.badge_text}</span>}
                                                    {p.category && <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full">{p.category}</span>}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2">
                                                {p.extras.length > 0
                                                    ? <div className="flex flex-wrap gap-1">{p.extras.map((e, j) => <span key={j} className="text-xs px-2 py-0.5 bg-gray-100 rounded-full">{e.name} {e.extra_price > 0 ? `+$${e.extra_price}` : ''}</span>)}</div>
                                                    : <span className="text-gray-400">—</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {processedData.length > 15 && <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-600 text-center">Mostrando 15 de {processedData.length}</div>}
                    </div>

                    {isImporting && (
                        <div className="p-4 bg-blue-50 rounded-xl flex items-center gap-3">
                            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                            <span className="text-sm text-blue-900 font-medium">{importProgress}</span>
                        </div>
                    )}
                </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={onCancel} disabled={isImporting}>Cancelar</Button>
                <Button onClick={handleImport} disabled={!processedData || errors.length > 0 || isImporting}>
                    {isImporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importando...</> : `Importar ${processedData?.length || 0} productos`}
                </Button>
            </div>
        </div>
    )
}
