import type { CreateTypes, Shape } from 'canvas-confetti'
import { isCapacitor } from '@/utils/capacitor'
import { loadStarShapes } from '@/utils/confetti-star-shapes'

export interface ConfettiOptions {
    /** Where the burst starts, as a fraction of the viewport. Only for a burst anchored to an element. */
    origin?: { x: number; y: number }
}

/*
 * The one confetti. Every success moment fires this burst; there are no
 * per-screen tunings. 40 brand stars in two sizes fly out flat — no tumble,
 * because tumbling squashes and mirrors the drawing — and fade.
 */
const STAR_CONFETTI_CONFIG = {
    particleCount: 40,
    spread: 360,
    ticks: 80,
    gravity: 0.3,
    decay: 0.96,
    startVelocity: 17,
    scalar: 1,
    flat: true,
}

const DEFAULT_ORIGIN = { x: 0.5, y: 0.4 }

// css pixel heights of the two star sizes in a burst
const STAR_HEIGHTS = [50, 36] as const
const REDUCED_MOTION_STAR_HEIGHTS = [36] as const

// Only if the star file cannot be rasterised: the library's own star in brand
// yellow (yellow-500), so a broken image never means no celebration.
const FALLBACK_SHAPES: Shape[] = ['star']
const FALLBACK_COLORS = ['#ffc900']
const FALLBACK_SCALAR = 1.8

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
    particleCount: 8,
    ticks: 40,
    gravity: 0.5,
    startVelocity: 7,
}

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
             * heals it, and render on the main thread in the WebView.
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

// A slow star file must not hold the celebration back: past this, the burst
// goes out with the fallback star. The load carries on and stays memoized, so
// the next burst gets the brand star.
const STAR_SHAPE_TIMEOUT_MS = 800

function getShapeOptions(reduced: boolean) {
    let timer: ReturnType<typeof setTimeout>
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('star shape timed out')), STAR_SHAPE_TIMEOUT_MS)
    })
    return Promise.race([getStarShapes(reduced ? REDUCED_MOTION_STAR_HEIGHTS : STAR_HEIGHTS), timeout])
        .then(
            (shapes) => ({ shapes }),
            (error: unknown) => {
                console.warn('[confetti] star shape failed, using the fallback star:', error)
                return { shapes: FALLBACK_SHAPES, colors: FALLBACK_COLORS, scalar: FALLBACK_SCALAR }
            }
        )
        .finally(() => clearTimeout(timer))
}

/** The app's one celebration burst. Fire it once per success moment. */
export const shootStarConfetti = ({ origin = DEFAULT_ORIGIN }: ConfettiOptions = {}) => {
    if (typeof window === 'undefined') return
    if (isThrottled()) return

    const reduced = prefersReducedMotion()

    Promise.all([getConfetti(), getShapeOptions(reduced)])
        .then(([fire, shapeOptions]) =>
            fire({
                ...STAR_CONFETTI_CONFIG,
                ...(reduced ? REDUCED_MOTION_CONFIG : {}),
                ...shapeOptions,
                origin,
            })
        )
        .catch((error: unknown) => {
            // A silently swallowed failure here is why a broken celebration went
            // unnoticed for three releases.
            console.warn('[confetti] burst failed:', error)
        })
}
