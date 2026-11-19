import type { CreateTypes, Shape } from 'canvas-confetti'
import { isCapacitor } from '@/utils/capacitor'
import { loadStarShapes } from '@/utils/confetti-star-shapes'
import { starSilhouettes } from '@/utils/confetti-star-silhouette'

export interface ConfettiOptions {
    /** Stars in the burst. Counts are brand stars, about a fifth of the old plain-star counts. */
    particleCount?: number
    /** Star size, where 1 is the standard 50 px star. */
    scalar?: number
    origin?: { x: number; y: number }
    startVelocity?: number
    gravity?: number
    spread?: number
    ticks?: number
    decay?: number
}

/*
 * One look for every burst: the brand star, flying out flat — no tumble,
 * because tumbling squashes and mirrors the drawing — and fading. A screen
 * may tune how many stars, how big and from where; it never changes the look.
 */
const defaultConfettiConfig = {
    spread: 360,
    ticks: 80,
    gravity: 0.3,
    decay: 0.96,
    startVelocity: 17,
    scalar: 1,
    flat: true,
}

const DEFAULT_ORIGIN = { x: 0.5, y: 0.6 }

// css pixel height of the star at scalar 1, and the second size of a double
// burst relative to the first
const STAR_HEIGHT = 50
const SMALL_STAR_RATIO = 0.72
// Bitmaps stay small whatever a caller asks for: a large one costs old phones
// fill rate on every particle, every frame.
const MIN_STAR_HEIGHT = 12
const MAX_STAR_HEIGHT = 64

function starHeight(scalar: number): number {
    return Math.min(MAX_STAR_HEIGHT, Math.max(MIN_STAR_HEIGHT, Math.round(STAR_HEIGHT * scalar)))
}

// Only where the star file cannot be drawn as a bitmap: the same star as a
// plain outline filled brand yellow (yellow-500). Never another shape.
const SILHOUETTE_COLORS = ['#ffc900']

/*
 * prefers-reduced-motion asks for less motion, not less feedback.
 * canvas-confetti's disableForReducedMotion suppresses the burst outright, so
 * anyone with the OS setting on — common enough on iOS, where it also calms
 * app-switching animations — got no celebration at all on claiming a reward
 * and reported the feature as broken.
 *
 * Degrade instead of disappearing: eight small slow stars that settle
 * near the origin rather than a full-viewport spray. That drops the
 * large-area movement the preference is actually about while keeping the
 * moment legible.
 */
const REDUCED_MOTION_CONFIG = {
    ticks: 40,
    gravity: 0.5,
    startVelocity: 7,
}

const REDUCED_MOTION_PARTICLE_RATIO = 0.25
const REDUCED_MOTION_MIN_PARTICLES = 8

// Read per burst, never cached at module load: the native document outlives
// any single setting, so a value latched at boot would be days stale by the
// time the user toggles Reduce Motion.
function prefersReducedMotion(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/*
 * Rendering runs on a worker-backed OffscreenCanvas so star drawing never
 * competes with the UI thread (canvas-confetti falls back to the main thread
 * where OffscreenCanvas transfer is unsupported). One persistent canvas is
 * reused across bursts — a transferred canvas can't return to the main thread,
 * and reusing it also avoids a full-viewport buffer allocation per celebration.
 */
let instancePromise: Promise<CreateTypes> | null = null

function getConfetti(): Promise<CreateTypes> {
    if (!instancePromise) {
        instancePromise = import('canvas-confetti').then(({ default: confetti }) => {
            const canvas = document.createElement('canvas')
            canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:100'
            canvas.setAttribute('aria-hidden', 'true')
            document.body.appendChild(canvas)
            /*
             * useWorker transfers the canvas to a worker via
             * transferControlToOffscreen(), which detaches it from the main
             * thread permanently — and canvas-confetti only guards worker
             * *construction*, not a worker that dies later. On native that is
             * unrecoverable: the document never reloads, so one failure means no
             * celebration ever again. Keep the worker on web, where a page load
             * heals it, and render on the main thread in the WebView (already
             * down to one half-sized burst there).
             */
            return confetti.create(canvas, { resize: true, useWorker: !isCapacitor() })
        })
        // A memoized promise that rejects stays rejected for the life of the
        // document — forever on native. Let the next celebration rebuild it.
        instancePromise.catch(() => {
            instancePromise = null
        })
    }
    return instancePromise
}

// Duplicate celebrations within one success moment (multiple triggers racing on
// the same screen) stack particles on the same canvas — swallow the extras.
const BURST_THROTTLE_MS = 1500
let lastBurstAt = 0

function isThrottled(): boolean {
    const now = Date.now()
    if (now - lastBurstAt < BURST_THROTTLE_MS) return true
    lastBurstAt = now
    return false
}

// Rasterised once per size and reused. A failed load is not memoized, so the
// next celebration tries the star file again.
const shapesPromises = new Map<string, Promise<Shape[]>>()

function getStarShapes(heights: readonly number[]): Promise<Shape[]> {
    const key = heights.join(',')
    let promise = shapesPromises.get(key)
    if (!promise) {
        promise = loadStarShapes(heights)
        shapesPromises.set(key, promise)
        promise.catch(() => shapesPromises.delete(key))
    }
    return promise
}

function getShapeOptions(heights: readonly number[]) {
    return getStarShapes(heights).then(
        (shapes) => ({ shapes }),
        (error: unknown) => {
            console.warn('[confetti] star bitmap failed, using the star outline:', error)
            // Throws where paths are unsupported too; the burst is then skipped.
            return { shapes: starSilhouettes(heights), colors: SILHOUETTE_COLORS }
        }
    )
}

/** One burst of `particleCount` stars, spread evenly over the given sizes. */
const fireStars = (options: ConfettiOptions, scalars: readonly number[]) => {
    const { particleCount = 20, origin = DEFAULT_ORIGIN, scalar: _scalar, ...otherOptions } = options

    const reduced = prefersReducedMotion()
    // Reduced motion gets one small size, so the few stars left stay quiet.
    const sizes = reduced ? [Math.min(...scalars) * SMALL_STAR_RATIO] : scalars
    // The bitmap is drawn at its final size; the library's own scalar would
    // only resize the box it is painted into.
    const heights = [...new Set(sizes.map(starHeight))]

    Promise.all([getConfetti(), getShapeOptions(heights)])
        .then(([fire, shapeOptions]) =>
            fire({
                ...defaultConfettiConfig,
                ...otherOptions,
                ...(reduced ? REDUCED_MOTION_CONFIG : {}),
                ...shapeOptions,
                particleCount: reduced
                    ? Math.max(REDUCED_MOTION_MIN_PARTICLES, Math.round(particleCount * REDUCED_MOTION_PARTICLE_RATIO))
                    : particleCount,
                origin,
            })
        )
        .catch((error: unknown) => {
            // A silently swallowed failure here is why a broken celebration went
            // unnoticed for three releases.
            console.warn('[confetti] burst failed:', error)
        })
}

/** A burst of stars in one size. */
export const shootStarConfetti = (options: ConfettiOptions = {}) => {
    if (typeof window === 'undefined') return
    if (isThrottled()) return
    fireStars(options, [options.scalar ?? 1])
}

/** The standard celebration: 40 stars in two sizes. */
export const shootDoubleStarConfetti = (options: ConfettiOptions = {}) => {
    if (typeof window === 'undefined') return
    if (isThrottled()) return

    const { particleCount = 40, scalar = 1, ...otherOptions } = options

    // Native WebView renderers have a much smaller frame budget than Chrome:
    // half the stars, one size. Reduced motion gets the same for the reason it
    // gets fewer, slower stars — the two-size spray is the part that reads as
    // busy.
    if (isCapacitor() || prefersReducedMotion()) {
        fireStars({ ...otherOptions, particleCount: Math.round(particleCount / 2) }, [scalar])
        return
    }

    // Both sizes go out in one burst; the library picks a size per star.
    fireStars({ ...otherOptions, particleCount }, [scalar, scalar * SMALL_STAR_RATIO])
}

// Preset configurations for common use cases
export const confettiPresets = {
    success: () => shootDoubleStarConfetti({ origin: { x: 0.5, y: 0.6 } }),
    celebration: () =>
        shootDoubleStarConfetti({
            origin: { x: 0.5, y: 0.3 },
            particleCount: 30,
            spread: 180,
        }),
    gentle: () =>
        shootStarConfetti({
            particleCount: 10,
            scalar: 0.8,
            startVelocity: 10,
        }),
}
