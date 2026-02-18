import { useState, useRef } from 'react'
import { Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { supabase } from '../../lib/supabase'
import { updateProduct, getProducts } from '../../lib/product-service'
import { useAuth } from '../auth/auth-context'
import { toast } from 'sonner'

export function BulkImageUpload() {
    const { user } = useAuth()
    const [uploading, setUploading] = useState(false)
    const [progress, setProgress] = useState({ current: 0, total: 0 })
    const [results, setResults] = useState([])
    const fileInputRef = useRef(null)

    const optimizeImage = async (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = (event) => {
                const img = new Image()
                img.onload = () => {
                    const canvas = document.createElement('canvas')
                    let width = img.width
                    let height = img.height

                    // Max dimension to help keep size under 100KB
                    const MAX_WIDTH = 800
                    const MAX_HEIGHT = 800

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width
                            width = MAX_WIDTH
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height
                            height = MAX_HEIGHT
                        }
                    }

                    canvas.width = width
                    canvas.height = height
                    const ctx = canvas.getContext('2d')
                    ctx.drawImage(img, 0, 0, width, height)

                    // Start with high quality and reduce until < 100KB
                    let quality = 0.8
                    let dataUrl = canvas.toDataURL('image/jpeg', quality)

                    // Recursive-like adjustment (simple version)
                    while (dataUrl.length * 0.75 > 102400 && quality > 0.1) {
                        quality -= 0.1
                        dataUrl = canvas.toDataURL('image/jpeg', quality)
                    }

                    // Convert dataUrl to Blob
                    fetch(dataUrl)
                        .then(res => res.blob())
                        .then(blob => resolve(new File([blob], file.name, { type: 'image/jpeg' })))
                }
                img.src = event.target.result
            }
            reader.readAsDataURL(file)
        })
    }

    const handleUpload = async (e) => {
        const files = Array.from(e.target.files)
        if (files.length === 0) return

        setUploading(true)
        setProgress({ current: 0, total: files.length })
        const uploadResults = []

        try {
            const products = await getProducts(user.id)

            for (let i = 0; i < files.length; i++) {
                const file = files[i]
                const fileName = file.name.split('.').slice(0, -1).join('.').toLowerCase().trim()

                // Find matching product by name or slug
                const product = products.find(p =>
                    p.name.toLowerCase().trim() === fileName ||
                    (p.slug && p.slug.toLowerCase().trim() === fileName)
                )

                if (!product) {
                    uploadResults.push({ name: file.name, status: 'error', message: 'Producto no encontrado' })
                } else {
                    try {
                        // Optimize
                        const optimizedFile = await optimizeImage(file)

                        // Upload to Storage
                        const fileExt = 'jpg'
                        const filePath = `${user.id}/${product.id}-${Date.now()}.${fileExt}`

                        const { data: uploadData, error: uploadError } = await supabase.storage
                            .from('product-images')
                            .upload(filePath, optimizedFile)

                        if (uploadError) throw uploadError

                        // Get Public URL
                        const { data: { publicUrl } } = supabase.storage
                            .from('product-images')
                            .getPublicUrl(filePath)

                        // Update Product
                        await updateProduct(product.id, { image_url: publicUrl }, user.id)

                        uploadResults.push({ name: file.name, productName: product.name, status: 'success' })
                    } catch (error) {
                        console.error(`Error uploading ${file.name}:`, error)
                        uploadResults.push({ name: file.name, status: 'error', message: error.message })
                    }
                }
                setProgress(prev => ({ ...prev, current: i + 1 }))
            }
            setResults(uploadResults)
            toast.success('Proceso de carga masiva finalizado')
        } catch (error) {
            console.error('Bulk upload error:', error)
            toast.error('Ocurrió un error general en la carga masiva')
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Carga Masiva de Imágenes</h2>
            <p className="text-sm text-gray-500 mb-6">
                Selecciona múltiples imágenes. El nombre del archivo debe coincidir con el nombre del producto (ej: "hamburguesa-doble.jpg" para el producto "Hamburguesa Doble").
            </p>

            <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl p-8 transition-colors hover:border-primary/50 bg-gray-50/50">
                <Upload className="w-10 h-10 text-gray-400 mb-4" />
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleUpload}
                    className="hidden"
                    disabled={uploading}
                />
                <Button
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                >
                    {uploading ? 'Procesando...' : 'Seleccionar Archivos'}
                </Button>
                {uploading && (
                    <div className="mt-4 w-full max-w-xs">
                        <div className="flex justify-between text-xs mb-1">
                            <span>Progreso</span>
                            <span>{progress.current} / {progress.total}</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all duration-300"
                                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {results.length > 0 && (
                <div className="mt-8">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Resultados</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {results.map((res, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100 text-xs text-gray-600">
                                <div className="flex items-center gap-2">
                                    {res.status === 'success' ? (
                                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                                    ) : (
                                        <AlertCircle className="w-4 h-4 text-red-500" />
                                    )}
                                    <span className="font-medium truncate max-w-[150px]">{res.name}</span>
                                </div>
                                <span>
                                    {res.status === 'success' ? `Asignado a: ${res.productName}` : res.message}
                                </span>
                            </div>
                        ))}
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="mt-4 w-full text-xs"
                        onClick={() => setResults([])}
                    >
                        Limpiar Resultados
                    </Button>
                </div>
            )}
        </div>
    )
}
