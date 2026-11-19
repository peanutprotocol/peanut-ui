jest.mock('@/assets/illustrations/star.svg', () => ({ __esModule: true, default: { src: '/star.svg' } }))

import { loadStarShapes } from '@/utils/confetti-star-shapes'

/**
 * jsdom loads no images and draws no canvas, so the browser pieces are faked:
 * an Image that loads (or fails) on the next tick, a 2d context that records
 * the draw and reports the centre pixel, and createImageBitmap.
 */
let imageFails = false
let centreAlpha = 255
const drawImage = jest.fn()
const createBitmap = jest.fn((canvas: HTMLCanvasElement) => Promise.resolve({ bitmapOf: canvas.width }))

class FakeImage {
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    decode = jest.fn().mockResolvedValue(undefined)
    set src(_value: string) {
        setTimeout(() => (imageFails ? this.onerror?.() : this.onload?.()), 0)
    }
}

const realImage = global.Image

beforeEach(() => {
    imageFails = false
    centreAlpha = 255
    jest.clearAllMocks()
    Object.assign(global, { Image: FakeImage, OffscreenCanvas: class {}, createImageBitmap: createBitmap })
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        drawImage,
        getImageData: () => ({ data: [0, 0, 0, centreAlpha] }),
    } as unknown as CanvasRenderingContext2D)
})

afterEach(() => {
    jest.restoreAllMocks()
    Object.assign(global, { Image: realImage, OffscreenCanvas: undefined, createImageBitmap: undefined })
})

describe('loadStarShapes', () => {
    it('stamps the star into a padded square bitmap centred on the particle', async () => {
        const shapes = await loadStarShapes([50, 36])

        // side = ceil(height * 1.45)
        expect(shapes).toEqual([
            { type: 'bitmap', bitmap: { bitmapOf: 73 }, matrix: [1, 0, 0, 1, -36.5, -36.5] },
            { type: 'bitmap', bitmap: { bitmapOf: 53 }, matrix: [1, 0, 0, 1, -26.5, -26.5] },
        ])
    })

    it('draws the star at its own proportions in the middle of the bitmap', async () => {
        await loadStarShapes([83])

        const side = Math.ceil(83 * 1.45)
        expect(drawImage).toHaveBeenCalledWith(expect.any(FakeImage), (side - 70) / 2, (side - 83) / 2, 70, 83)
    })

    it('rejects when the star file does not load', async () => {
        imageFails = true

        await expect(loadStarShapes([50])).rejects.toThrow('star.svg failed to load')
    })

    it('rejects where the library could not draw a bitmap', async () => {
        Object.assign(global, { OffscreenCanvas: undefined })

        await expect(loadStarShapes([50])).rejects.toThrow('bitmap confetti unsupported')
        expect(createBitmap).not.toHaveBeenCalled()
    })

    it('rejects when the browser drew the star blank', async () => {
        centreAlpha = 0

        await expect(loadStarShapes([50])).rejects.toThrow('star.svg drew blank')
    })
})
