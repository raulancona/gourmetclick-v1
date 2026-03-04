import { supabase } from './supabase'

/**
 * Image Service
 * Handles image uploads to Supabase Storage with validation
 */

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']

/**
 * Validate image file
 * @param {File} file - Image file to validate
 * @throws {Error} If validation fails
 */
function validateImage(file) {
    if (!file) {
        throw new Error('No file provided')
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        throw new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.')
    }

    if (file.size > MAX_FILE_SIZE) {
        throw new Error('File size exceeds 5MB limit')
    }
}

/**
 * Generate unique filename
 * @param {string} originalName - Original filename
 * @returns {string} Unique filename
 */
function generateUniqueFilename(originalName) {
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const extension = originalName.split('.').pop()
    return `${timestamp}-${randomString}.${extension}`
}

/**
 * Upload product image to Supabase Storage with automatic compression
 * @param {File} file - Image file to upload
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<string>} Public URL of uploaded image
 */
export async function uploadProductImage(file, userId) {
    // Validate the image originally uploaded
    validateImage(file)

    // Compress the image before uploading (max width 1200px, quality 0.8)
    const compressedFile = await compressImage(file, { maxWidth: 1200, quality: 0.8 })

    // Generate unique filename
    const filename = generateUniqueFilename(compressedFile.name)
    const filePath = `${userId}/${filename}`

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
        .from('product-images')
        .upload(filePath, compressedFile, {
            cacheControl: '3600',
            upsert: false
        })

    if (error) throw error

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath)

    return publicUrl
}

/**
 * Delete product image from Supabase Storage
 * @param {string} imageUrl - Full URL of the image to delete
 * @returns {Promise<void>}
 */
export async function deleteProductImage(imageUrl) {
    if (!imageUrl) return

    try {
        // Extract the file path from the URL
        // URL format: https://<project>.supabase.co/storage/v1/object/public/product-images/<userId>/<filename>
        const urlParts = imageUrl.split('/product-images/')
        if (urlParts.length < 2) return

        const filePath = urlParts[1]

        const { error } = await supabase.storage
            .from('product-images')
            .remove([filePath])

        if (error) throw error
    } catch (error) {
        console.error('Error deleting image:', error)
        // Don't throw error - image deletion is not critical
    }
}

/**
 * Get image preview URL from File object
 * @param {File} file - Image file
 * @returns {string} Object URL for preview
 */
export function getImagePreviewUrl(file) {
    return URL.createObjectURL(file)
}

/**
 * Revoke image preview URL to free memory
 * @param {string} url - Object URL to revoke
 */
export function revokeImagePreviewUrl(url) {
    URL.revokeObjectURL(url)
}

/**
 * Compress an image file natively using Canvas API
 * Converts to WebP if supported, otherwise JPEG.
 * @param {File} file - Original image file
 * @param {Object} options - Compression options
 * @param {number} options.maxWidth - Maximum width of the compressed image
 * @param {number} options.quality - Image quality (0.0 to 1.0)
 * @returns {Promise<File>} A promise that resolves to the compressed File
 */
export async function compressImage(file, { maxWidth = 1200, quality = 0.8 } = {}) {
    // If it's a GIF, don't compress (Canvas removes animation)
    if (file.type === 'image/gif') return file;

    return new Promise((resolve, reject) => {
        // Use createImageBitmap which handles EXIF orientation natively in modern browsers
        createImageBitmap(file)
            .then(bitmap => {
                const canvas = document.createElement('canvas');
                let width = bitmap.width;
                let height = bitmap.height;

                // Calculate new dimensions keeping aspect ratio
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                // Fill with white background in case of transparent PNG converting to JPEG
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);

                ctx.drawImage(bitmap, 0, 0, width, height);

                // Try to use WebP for better compression, fallback to JPEG
                const targetType = 'image/webp';
                const outputType = (canvas.toDataURL(targetType).indexOf(`data:${targetType}`) === 0) ? targetType : 'image/jpeg';

                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Canvas to Blob conversion failed'));
                        return;
                    }
                    // Generate new filename with correct extension
                    const ext = outputType === 'image/webp' ? 'webp' : 'jpg';
                    const newFileName = file.name.replace(/\.[^/.]+$/, `.${ext}`);

                    const compressedFile = new File([blob], newFileName, {
                        type: outputType,
                        lastModified: Date.now(),
                    });

                    resolve(compressedFile);
                }, outputType, quality);
            })
            .catch(err => {
                console.error('Image compression error:', err);
                // If compression fails, fallback to original file
                resolve(file);
            });
    });
}
