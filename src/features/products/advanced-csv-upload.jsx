import { useState, useRef } from 'react'
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react'
import Papa from 'papaparse'
import { Button } from '../../components/ui/button'
import { cn } from '../../lib/utils'
import { bulkCreateProducts } from '../../lib/product-service'
import { createModifierGroup, createModifierOption } from '../../lib/modifier-service'
import { getCategories, createCategory } from '../../lib/category-service'

export function AdvancedCSVUpload({ onImport, onCancel, userId }) {
    const [file, setFile] = useState(null)
    const [parsedData, setParsedData] = useState(null)
    const [processedData, setProcessedData] = useState(null)
    const [errors, setErrors] = useState([])
    const [isDragging, setIsDragging] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const fileInputRef = useRef(null)

    const processCSVData = async (rows) => {
        // Group rows by SKU
        const productMap = new Map()

        rows.forEach((row, index) => {
            const sku = row.sku?.trim() || `AUTO-${index}`

            if (!productMap.has(sku)) {
                productMap.set(sku, {
                    name: row.name?.trim(),
                    description: row.description?.trim() || null,
                    price: parseFloat(row.price),
                    sku: sku,
                    category: row.category?.trim() || null,
                    modifierGroups: new Map()
                })
            }

            const product = productMap.get(sku)

            // Add modifier if present
            if (row.modifier_group && row.modifier_name) {
                const groupName = row.modifier_group.trim()

                if (!product.modifierGroups.has(groupName)) {
                    product.modifierGroups.set(groupName, {
                        name: groupName,
                        min_selection: 0,
                        max_selection: 10,
                        options: []
                    })
                }

                product.modifierGroups.get(groupName).options.push({
                    name: row.modifier_name.trim(),
                    extra_price: parseFloat(row.modifier_price || 0)
                })
            }
        })

        return Array.from(productMap.values())
    }

    const validateRow = (row, index) => {
        const errors = []

        if (!row.name || row.name.trim() === '') {
            errors.push(`Fila ${index + 2}: El nombre es requerido`)
        }

        if (!row.price || isNaN(parseFloat(row.price))) {
            errors.push(`Fila ${index + 2}: El precio debe ser un número válido`)
        } else if (parseFloat(row.price) < 0) {
            errors.push(`Fila ${index + 2}: El precio debe ser mayor o igual a 0`)
        }

        if (row.modifier_price && isNaN(parseFloat(row.modifier_price))) {
            errors.push(`Fila ${index + 2}: El precio del modificador debe ser un número válido`)
        }

        return errors
    }

    const handleFileChange = async (selectedFile) => {
        if (!selectedFile) return

        if (!selectedFile.name.endsWith('.csv')) {
            alert('Por favor selecciona un archivo CSV')
            return
        }

        setFile(selectedFile)
        setErrors([])

        // Parse CSV
        Papa.parse(selectedFile, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const validationErrors = []

                // Validate each row
                results.data.forEach((row, index) => {
                    const rowErrors = validateRow(row, index)
                    validationErrors.push(...rowErrors)
                })

                if (validationErrors.length === 0) {
                    const processed = await processCSVData(results.data)
                    setProcessedData(processed)
                }

                setErrors(validationErrors)
                setParsedData(results.data)
            },
            error: (error) => {
                alert('Error al leer el archivo CSV: ' + error.message)
            }
        })
    }

    const handleImport = async () => {
        if (!processedData || errors.length > 0) return

        setIsImporting(true)
        try {
            // Get existing categories
            const existingCategories = await getCategories(userId)
            const categoryMap = new Map(existingCategories.map(c => [c.name.toLowerCase(), c]))

            // Create missing categories
            const uniqueCategories = [...new Set(processedData.map(p => p.category).filter(Boolean))]
            for (const catName of uniqueCategories) {
                if (!categoryMap.has(catName.toLowerCase())) {
                    const newCat = await createCategory({ name: catName, order_index: categoryMap.size }, userId)
                    categoryMap.set(catName.toLowerCase(), newCat)
                }
            }

            // Create products without modifiers first
            const productsToCreate = processedData.map(p => ({
                name: p.name,
                description: p.description,
                price: p.price,
                sku: p.sku,
                category_id: p.category ? categoryMap.get(p.category.toLowerCase())?.id : null
            }))

            const createdProducts = await bulkCreateProducts(productsToCreate, userId)

            // Create modifiers for each product
            for (let i = 0; i < processedData.length; i++) {
                const productData = processedData[i]
                const createdProduct = createdProducts[i]

                if (productData.modifierGroups.size > 0) {
                    for (const [groupName, groupData] of productData.modifierGroups) {
                        const group = await createModifierGroup({
                            name: groupData.name,
                            min_selection: groupData.min_selection,
                            max_selection: groupData.max_selection
                        }, createdProduct.id)

                        // Create options for this group
                        for (const option of groupData.options) {
                            await createModifierOption(option, group.id)
                        }
                    }
                }
            }

            await onImport(createdProducts)
        } catch (error) {
            console.error('Error importing products:', error)
            alert('Error al importar productos: ' + error.message)
        } finally {
            setIsImporting(false)
        }
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = () => {
        setIsDragging(false)
    }

    const handleDrop = (e) => {
        e.preventDefault()
        setIsDragging(false)
        const droppedFile = e.dataTransfer.files[0]
        handleFileChange(droppedFile)
    }

    return (
        <div className="space-y-6">
            {/* File Upload Area */}
            {!parsedData ? (
                <div>
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                            'border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all',
                            isDragging
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                        )}
                    >
                        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <p className="text-sm text-gray-600 mb-2">
                            <span className="font-medium text-blue-600">Haz clic para subir</span> o arrastra tu archivo CSV
                        </p>
                        <p className="text-xs text-gray-500">
                            Soporta productos con modificadores
                        </p>
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={(e) => handleFileChange(e.target.files[0])}
                        className="hidden"
                    />

                    {/* CSV Format Example */}
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-700 mb-2">Formato esperado:</p>
                        <pre className="text-xs text-gray-600 overflow-x-auto">
                            {`name,description,price,sku,category,modifier_group,modifier_name,modifier_price
Hamburguesa Especial,Deliciosa hamburguesa,120,BURG-01,Platos Fuertes,Proteína,Carne Extra,20
Hamburguesa Especial,Deliciosa hamburguesa,120,BURG-01,Platos Fuertes,Proteína,Pollo,0
Hamburguesa Especial,Deliciosa hamburguesa,120,BURG-01,Platos Fuertes,Extras,Queso,15`}
                        </pre>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* File Info */}
                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                        <FileText className="w-8 h-8 text-blue-600" />
                        <div className="flex-1">
                            <p className="font-medium text-gray-900">{file.name}</p>
                            <p className="text-sm text-gray-600">
                                {processedData?.length || 0} productos únicos, {parsedData.length} filas procesadas
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setFile(null)
                                setParsedData(null)
                                setProcessedData(null)
                                setErrors([])
                            }}
                        >
                            Cambiar archivo
                        </Button>
                    </div>

                    {/* Validation Errors */}
                    {errors.length > 0 && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="font-medium text-red-900 mb-2">
                                        Se encontraron {errors.length} errores:
                                    </p>
                                    <ul className="text-sm text-red-700 space-y-1">
                                        {errors.slice(0, 5).map((error, index) => (
                                            <li key={index}>• {error}</li>
                                        ))}
                                        {errors.length > 5 && (
                                            <li className="font-medium">... y {errors.length - 5} más</li>
                                        )}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Success Message */}
                    {errors.length === 0 && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                                <p className="text-sm text-green-900">
                                    El archivo es válido y está listo para importar
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Preview */}
                    {processedData && (
                        <div className="border border-gray-200 rounded-lg p-4">
                            <h4 className="font-medium mb-3">Vista previa de productos:</h4>
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                                {processedData.slice(0, 5).map((product, index) => (
                                    <div key={index} className="p-3 bg-gray-50 rounded">
                                        <p className="font-medium">{product.name}</p>
                                        <p className="text-sm text-gray-600">${product.price} • {product.sku}</p>
                                        {product.category && (
                                            <p className="text-xs text-gray-500">Categoría: {product.category}</p>
                                        )}
                                        {product.modifierGroups.size > 0 && (
                                            <div className="mt-2 text-xs">
                                                <p className="font-medium text-gray-700">Modificadores:</p>
                                                {Array.from(product.modifierGroups.values()).map((group, gi) => (
                                                    <div key={gi} className="ml-2 mt-1">
                                                        <p className="text-gray-600">• {group.name}: {group.options.map(o => o.name).join(', ')}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {processedData.length > 5 && (
                                    <p className="text-xs text-gray-500 text-center">
                                        ... y {processedData.length - 5} productos más
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <Button variant="outline" onClick={onCancel} disabled={isImporting}>
                    Cancelar
                </Button>
                <Button
                    onClick={handleImport}
                    disabled={!processedData || errors.length > 0 || isImporting}
                >
                    {isImporting ? 'Importando...' : `Importar ${processedData?.length || 0} productos`}
                </Button>
            </div>
        </div>
    )
}
