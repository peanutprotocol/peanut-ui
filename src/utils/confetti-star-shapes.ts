import type { Shape } from 'canvas-confetti'
import star from '@/assets/illustrations/star.svg'

// star.svg is 70 x 83. The bitmap gets room around the star so its own drop
// shadow is not cut off.
const STAR_ASPECT = 70 / 83
const BITMAP_PADDING = 1.45

async function loadStar(): Promise<HTMLImageElement> {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image()
        element.onload = () => resolve(element)
        element.onerror = () => reject(new Error('star.svg failed to load'))
        element.src = star.src
    })
    // loaded is not yet drawable everywhere; decode() is
    await image.decode()
    return image
}

/** The brand star stamped once into a bitmap `height` css pixels tall, centred on the particle. */
async function starShape(image: HTMLImageElement, height: number): Promise<Shape> {
    const side = Math.ceil(height * BITMAP_PADDING)
    const canvas = document.createElement('canvas')
    canvas.width = side
    canvas.height = side
    const context = canvas.getContext('2d')
    if (!context) throw new Error('2d canvas unavailable')
    const width = height * STAR_ASPECT
    context.drawImage(image, (side - width) / 2, (side - height) / 2, width, height)
    // WebKit can draw an SVG that carries a filter as nothing at all, without
    // an error. The star's centre is solid, so a clear pixel there means that.
    const centre = Math.floor(side / 2)
    if (context.getImageData(centre, centre, 1, 1).data[3] === 0) throw new Error('star.svg drew blank')
    // An ImageBitmap, not the canvas: the burst is posted to a worker on web and
    // a canvas element cannot be cloned across.
    const bitmap = await createImageBitmap(canvas)
    // The library reads the matrix as a plain six-number array (it has to survive
    // the post to the worker); its types call it a DOMMatrix.
    const matrix = [1, 0, 0, 1, -side / 2, -side / 2] as unknown as DOMMatrix
    return { type: 'bitmap', bitmap, matrix }
}

/**
 * Confetti shapes drawn from the brand star file, one per requested height.
 * The star is rasterised once per size; every particle is a stamp of that
 * bitmap, so 40 stars cost about what the library's own path star does.
 */
export async function loadStarShapes(heights: readonly number[]): Promise<Shape[]> {
    // canvas-confetti copies each bitmap into `new OffscreenCanvas` while it
    // draws. Where that is missing (Safari before 16.4) the copy throws inside
    // its animation loop, so refuse here and let the caller fall back.
    if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap !== 'function') {
        throw new Error('bitmap confetti unsupported')
    }
    const image = await loadStar()
    return Promise.all(heights.map((height) => starShape(image, height)))
}
