import { useState, useRef } from 'react'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import { cn } from '../../lib/utils'
import { getImagePreviewUrl, revokeImagePreviewUrl } from '../../lib/image-service'

export function ImageUpload({ value, onChange, error }) {
    const [preview, setPreview] = useState(value || null)
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef(null)

    const handleFileChange = (file) => {
        if (!file) return

        // Validate file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
        if (!validTypes.includes(file.type)) {
            alert('Por favor selecciona una imagen válida (JPEG, PNG, WebP, GIF)')
            return
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('La imagen debe ser menor a 5MB')
            return
        }

        // Create preview
        const previewUrl = getImagePreviewUrl(file)
        setPreview(previewUrl)

        // Pass file to parent
        onChange(file)
    }

    const handleRemove = () => {
        if (preview && preview.startsWith('blob:')) {
            revokeImagePreviewUrl(preview)
        }
        setPreview(null)
        onChange(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
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
        const file = e.dataTransfer.files[0]
        handleFileChange(file)
    }

    return (
        <div className="space-y-2">
            {preview ? (
                <div className="relative group">
                    <img
                        src={preview}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded-lg border-2 border-gray-200"
                    />
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                        'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all',
                        isDragging
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50',
                        error && 'border-red-300'
                    )}
                >
                    <ImageIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium text-blue-600">Haz clic para subir</span> o arrastra una imagen
                    </p>
                    <p className="text-xs text-gray-500">PNG, JPG, WebP o GIF (máx. 5MB)</p>
                </div>
            )}

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e.target.files[0])}
                className="hidden"
            />

            {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
    )
}
