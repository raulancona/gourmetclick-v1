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
 * Upload product image to Supabase Storage
 * @param {File} file - Image file to upload
 * @param {string} userId - The authenticated user's ID
 * @returns {Promise<string>} Public URL of uploaded image
 */
export async function uploadProductImage(file, userId) {
    // Validate the image
    validateImage(file)

    // Generate unique filename
    const filename = generateUniqueFilename(file.name)
    const filePath = `${userId}/${filename}`

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, {
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
