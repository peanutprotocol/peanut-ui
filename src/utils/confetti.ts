import type { CreateTypes, Shape } from 'canvas-confetti'
import { isCapacitor } from '@/utils/capacitor'

export interface ConfettiOptions {
    particleCount?: number
    scalar?: number
    origin?: { x: number; y: number }
    colors?: string[]
    startVelocity?: number
    gravity?: number
    spread?: number
    ticks?: number
    decay?: number
}

const defaultConfettiConfig = {
    spread: 360,
    ticks: 80,
    gravity: 0.3,
    decay: 0.96,
    startVelocity: 15,
    colors: ['#FFE400', '#FFBD00', '#E89400', '#FFCA6C', '#FDFFB8'],
}

/*
 * prefers-reduced-motion asks for less motion, not less feedback.
 * canvas-confetti's disableForReducedMotion suppresses the burst outright, so
 * anyone with the OS setting on — common enough on iOS, where it also calms
 * app-switching animations — got no celebration at all on claiming a reward
 * and reported the feature as broken.
 *
 * Degrade instead of disappearing: a handful of slow particles that settle
 * near the origin rather than a full-viewport spray. That drops the
 * large-area movement the preference is actually about while keeping the
 * moment legible.
 */
const REDUCED_MOTION_CONFIG = {
    spread: 100,
    ticks: 40,
    gravity: 0.7,
    startVelocity: 8,
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

const fireStars = (options: ConfettiOptions) => {
    const {
        particleCount = 100,
        scalar = 1.8,
        origin = { x: 0.5, y: 0.6 },
        colors = defaultConfettiConfig.colors,
        ...otherOptions
    } = options

    const reduced = prefersReducedMotion()

    getConfetti()
        .then((fire) =>
            fire({
                ...defaultConfettiConfig,
                ...otherOptions,
                ...(reduced ? REDUCED_MOTION_CONFIG : {}),
                colors,
                particleCount: reduced
                    ? Math.max(REDUCED_MOTION_MIN_PARTICLES, Math.round(particleCount * REDUCED_MOTION_PARTICLE_RATIO))
                    : particleCount,
                scalar,
                shapes: ['star' as Shape],
                origin,
            })
        )
        .catch((error: unknown) => {
            // A silently swallowed failure here is why a broken celebration went
            // unnoticed for three releases.
            console.warn('[confetti] burst failed:', error)
        })
}

export const shootStarConfetti = (options: ConfettiOptions = {}) => {
    if (typeof window === 'undefined') return
    if (isThrottled()) return
    fireStars(options)
}

export const shootDoubleStarConfetti = (options: ConfettiOptions = {}) => {
    if (typeof window === 'undefined') return
    if (isThrottled()) return

    const { origin = { x: 0.5, y: 0.6 }, particleCount = 200, ...otherOptions } = options
    const half = Math.round(particleCount / 2)

    // Native WebView renderers have a much smaller frame budget than Chrome:
    // one half-sized burst instead of two. Reduced motion gets one for the same
    // reason it gets fewer, slower particles — two overlapping sprays are the
    // part that reads as busy.
    if (isCapacitor() || prefersReducedMotion()) {
        fireStars({ ...otherOptions, particleCount: half, scalar: 1.8, origin })
        return
    }

    fireStars({ ...otherOptions, particleCount: half, scalar: 1.8, origin })
    fireStars({ ...otherOptions, particleCount: half, scalar: 1.4, origin })
}

// Preset configurations for common use cases
export const confettiPresets = {
    success: () => shootDoubleStarConfetti({ origin: { x: 0.5, y: 0.6 } }),
    celebration: () =>
        shootDoubleStarConfetti({
            origin: { x: 0.5, y: 0.3 },
            particleCount: 150,
            spread: 180,
        }),
    gentle: () =>
        shootStarConfetti({
            particleCount: 50,
            scalar: 1.5,
            startVelocity: 10,
        }),
}
