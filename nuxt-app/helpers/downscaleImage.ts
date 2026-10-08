// Browser-only: shrinks a photo before the speaker portal uploads it.
//
// The portal posts both images in one multipart request to a Vercel function, and Vercel rejects any
// request body over 4.5 MB with a plain-text 413 before our code runs. A single photo straight off a
// phone camera is often bigger than that, so images are re-encoded here first. Deliberately not
// re-exported from `helpers/index.ts`: that barrel is imported by server routes. Import this module
// directly.

// Per image, so two images plus the text fields stay safely under Vercel's 4.5 MB request body limit.
export const MAX_IMAGE_UPLOAD_BYTES = 2 * 1024 * 1024

// Tried in order until the result fits MAX_IMAGE_UPLOAD_BYTES. 2400px is still three times the
// minimum the portal asks for, which is plenty for every place the website shows a speaker photo.
const ENCODING_STEPS = [
    { maxEdge: 2400, quality: 0.85 },
    { maxEdge: 2000, quality: 0.8 },
    { maxEdge: 1600, quality: 0.75 },
]

/**
 * The size an image should be scaled to so its longer edge fits `maxEdge`, without letting the
 * shorter edge drop below `minEdge` (the portal's minimum dimension). Never scales up.
 */
export function getScaledDimensions(
    width: number,
    height: number,
    maxEdge: number,
    minEdge: number
): { width: number; height: number } {
    const longEdge = Math.max(width, height)
    const shortEdge = Math.min(width, height)
    const scale = Math.min(1, Math.max(maxEdge / longEdge, minEdge / shortEdge))
    return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        const objectUrl = URL.createObjectURL(file)
        img.onload = () => {
            URL.revokeObjectURL(objectUrl)
            resolve(img)
        }
        img.onerror = () => {
            URL.revokeObjectURL(objectUrl)
            reject(new Error(`Could not decode image "${file.name}" (${file.type}, ${file.size} bytes)`))
        }
        img.src = objectUrl
    })
}

function encodeJpeg(img: HTMLImageElement, width: number, height: number, quality: number): Promise<Blob> {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
        return Promise.reject(new Error('Canvas 2D context is not available'))
    }
    // JPEG has no alpha channel; without a fill, transparent PNG areas would turn black.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(img, 0, 0, width, height)
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('Canvas could not encode the image'))),
            'image/jpeg',
            quality
        )
    })
}

/**
 * Returns `file` unchanged if it is already small enough to upload, otherwise a downscaled JPEG copy.
 * Throws if the browser cannot decode or re-encode the image; the caller decides what to tell the user.
 */
export async function downscaleImage(file: File, minEdge: number): Promise<File> {
    if (file.size <= MAX_IMAGE_UPLOAD_BYTES) {
        return file
    }

    const img = await loadImage(file)
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image'
    let blob: Blob | undefined

    for (const step of ENCODING_STEPS) {
        const { width, height } = getScaledDimensions(img.naturalWidth, img.naturalHeight, step.maxEdge, minEdge)
        blob = await encodeJpeg(img, width, height, step.quality)
        if (blob.size <= MAX_IMAGE_UPLOAD_BYTES) {
            break
        }
    }

    // `blob` is always set: ENCODING_STEPS is not empty. If even the last step is too large, the caller's
    // size check catches it before anything is sent.
    return new File([blob!], `${baseName}.jpg`, { type: 'image/jpeg' })
}
