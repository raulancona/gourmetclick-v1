import { useState, useRef } from 'react'
import { Upload, Image, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { cn } from '../../lib/utils'
import { uploadImage } from '../../lib/image-service'
import { updateProduct } from '../../lib/product-service'

export function BulkImageUpload({ products, userId, onComplete }) {
    const [files, setFiles] = useState([])
    const [uploading, setUploading] = useState(false)
    const [results, setResults] = useState([])
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef(null)

    const matchFileToProduct = (filename) => {
        // Remove extension
        const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')

        // Try to match by SKU (case-insensitive)
        const matchedProduct = products.find(p =>
            p.sku && p.sku.toLowerCase() === nameWithoutExt.toLowerCase()
        )

        return matchedProduct
    }

    const handleFilesChange = (selectedFiles) => {
        const fileArray = Array.from(selectedFiles)

        // Validate and match files
        const processedFiles = fileArray.map(file => {
            const isImage = file.type.startsWith('image/')
            const matchedProduct = isImage ? matchFileToProduct(file.name) : null

            return {
                file,
                name: file.name,
                size: file.size,
                isImage,
                matchedProduct,
                status: 'pending',
                error: null
            }
        })

        setFiles(processedFiles)
        setResults([])
    }

    const handleUpload = async () => {
        setUploading(true)
        const uploadResults = []

        for (const fileData of files) {
            if (!fileData.isImage || !fileData.matchedProduct) {
                uploadResults.push({
                    ...fileData,
                    status: 'skipped',
                    error: !fileData.isImage ? 'No es una imagen' : 'No se encontró producto con ese SKU'
                })
                continue
            }

            try {
                // Upload image
                const imageUrl = await uploadImage(fileData.file, userId)

                // Update product
                await updateProduct(
                    fileData.matchedProduct.id,
                    { image_url: imageUrl },
                    userId
                )

                uploadResults.push({
                    ...fileData,
                    status: 'success',
                    imageUrl
                })
            } catch (error) {
                uploadResults.push({
                    ...fileData,
                    status: 'error',
                    error: error.message
                })
            }
        }

        setResults(uploadResults)
        setUploading(false)

        // Call onComplete with successful uploads
        const successCount = uploadResults.filter(r => r.status === 'success').length
        if (successCount > 0) {
            onComplete(successCount)
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
        handleFilesChange(e.dataTransfer.files)
    }

    const getStatusIcon = (status) => {
        switch (status) {
            case 'success':
                return <CheckCircle2 className="w-5 h-5 text-green-600" />
            case 'error':
            case 'skipped':
                return <XCircle className="w-5 h-5 text-red-600" />
            default:
                return <Image className="w-5 h-5 text-gray-400" />
        }
    }

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B'
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }

    return (
        <div className="space-y-6">
            {/* Upload Area */}
            {files.length === 0 ? (
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
                            <span className="font-medium text-blue-600">Haz clic para subir</span> o arrastra múltiples imágenes
                        </p>
                        <p className="text-xs text-gray-500">
                            Los nombres de archivo deben coincidir con el SKU del producto
                        </p>
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => handleFilesChange(e.target.files)}
                        className="hidden"
                    />

                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm font-medium text-blue-900 mb-2">💡 Ejemplo de nombres:</p>
                        <ul className="text-xs text-blue-700 space-y-1">
                            <li>• <code className="bg-blue-100 px-1 rounded">BURG-01.jpg</code> → Producto con SKU "BURG-01"</li>
                            <li>• <code className="bg-blue-100 px-1 rounded">hamburguesa-especial.png</code> → Producto con SKU "hamburguesa-especial"</li>
                        </ul>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* File List */}
                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-96 overflow-y-auto">
                        {(results.length > 0 ? results : files).map((fileData, index) => (
                            <div key={index} className="p-4 flex items-center gap-4">
                                {getStatusIcon(fileData.status)}

                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                        {fileData.name}
                                    </p>
                                    <div className="flex items-center gap-3 text-xs text-gray-500">
                                        <span>{formatFileSize(fileData.size)}</span>
                                        {fileData.matchedProduct && (
                                            <span className="text-green-600">
                                                → {fileData.matchedProduct.name}
                                            </span>
                                        )}
                                    </div>
                                    {fileData.error && (
                                        <p className="text-xs text-red-600 mt-1">{fileData.error}</p>
                                    )}
                                </div>

                                {fileData.status === 'success' && (
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Summary */}
                    {results.length > 0 && (
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <p className="text-2xl font-bold text-green-600">
                                        {results.filter(r => r.status === 'success').length}
                                    </p>
                                    <p className="text-xs text-gray-600">Exitosas</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-red-600">
                                        {results.filter(r => r.status === 'error').length}
                                    </p>
                                    <p className="text-xs text-gray-600">Errores</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-600">
                                        {results.filter(r => r.status === 'skipped').length}
                                    </p>
                                    <p className="text-xs text-gray-600">Omitidas</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setFiles([])
                            setResults([])
                        }}
                        className="w-full"
                    >
                        Subir más imágenes
                    </Button>
                </div>
            )}

            {/* Footer */}
            {files.length > 0 && results.length === 0 && (
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-600">
                        {files.filter(f => f.matchedProduct).length} de {files.length} archivos coinciden con productos
                    </div>
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setFiles([])}
                            disabled={uploading}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleUpload}
                            disabled={uploading || files.filter(f => f.matchedProduct).length === 0}
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Subiendo...
                                </>
                            ) : (
                                `Subir ${files.filter(f => f.matchedProduct).length} imágenes`
                            )}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
