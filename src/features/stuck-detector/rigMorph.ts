import type { StuckBuddyPose } from './types'

export interface PoseTransitionProfile {
    /**
     * Contact/plant frame in `walking.json` (40 frames total) whose arm and torso
     * silhouette flows naturally into the target pose:
     * - frame 8: left arm already raised out left, right arm down right (matches `waving-hello`)
     * - frame 28: arms tucked near torso in a compact upright stance (matches `thinking`, `worried`, `sad`)
     */
    walkExitFrame: number
    /** Total duration (ms) of the 4-beat brake -> hop-turn -> cushion-land -> settle arc. */
    durationMs: number
    squatScaleX: number
    squatScaleY: number
    squatSkewDeg: number
    squatDropPx: number
    apexLiftPx: number
    apexScaleX: number
    apexScaleY: number
    apexTiltDeg: number
    landScaleX: number
    landScaleY: number
    landDropPx: number
    landTiltDeg: number
}

export interface PoseTransitionFrame {
    scaleX: number
    scaleY: number
    translateY: number
    rotateDeg: number
    skewXDeg: number
    /** Exact 1-frame pose cut at the apex of the hop (`t >= 0.50`), avoiding vector ghosting. */
    showTargetArt: boolean
    /** Speech bubble launches right on touchdown (`t >= 0.68`) so it feels triggered by landing weight. */
    bubbleReady: boolean
}

export const POSE_TRANSITION_PROFILES: Record<StuckBuddyPose, PoseTransitionProfile> = {
    'waving-hello': {
        walkExitFrame: 8,
        durationMs: 440,
        squatScaleX: 1.14,
        squatScaleY: 0.84,
        squatSkewDeg: -5.5,
        squatDropPx: 2.5,
        apexLiftPx: 14,
        apexScaleX: 0.87,
        apexScaleY: 1.15,
        apexTiltDeg: 3.5,
        landScaleX: 1.09,
        landScaleY: 0.9,
        landDropPx: 2.5,
        landTiltDeg: 2.0,
    },
    thinking: {
        walkExitFrame: 28,
        durationMs: 420,
        squatScaleX: 1.1,
        squatScaleY: 0.88,
        squatSkewDeg: -4.0,
        squatDropPx: 2.0,
        apexLiftPx: 8.5,
        apexScaleX: 0.92,
        apexScaleY: 1.09,
        apexTiltDeg: -2.0,
        landScaleX: 1.06,
        landScaleY: 0.93,
        landDropPx: 1.5,
        landTiltDeg: -3.2,
    },
    worried: {
        walkExitFrame: 28,
        durationMs: 480,
        squatScaleX: 1.13,
        squatScaleY: 0.84,
        squatSkewDeg: -5.0,
        squatDropPx: 3.0,
        apexLiftPx: 9.5,
        apexScaleX: 0.9,
        apexScaleY: 1.11,
        apexTiltDeg: 2.5,
        landScaleX: 1.11,
        landScaleY: 0.87,
        landDropPx: 3.5,
        landTiltDeg: -1.8,
    },
    sad: {
        walkExitFrame: 28,
        durationMs: 480,
        squatScaleX: 1.13,
        squatScaleY: 0.84,
        squatSkewDeg: -5.0,
        squatDropPx: 3.0,
        apexLiftPx: 9.0,
        apexScaleX: 0.9,
        apexScaleY: 1.1,
        apexTiltDeg: 2.0,
        landScaleX: 1.11,
        landScaleY: 0.87,
        landDropPx: 3.5,
        landTiltDeg: -2.0,
    },
}

const BEAT_SQUAT_END = 0.26
const BEAT_APEX = 0.5
const BEAT_LAND = 0.72
const BUBBLE_TRIGGER_T = 0.68

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t
}

function easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3)
}

function easeInQuad(t: number): number {
    return t * t
}

function easeOutBackGentle(t: number): number {
    const c1 = 1.25
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

/**
 * Decide whether the walk-in loop has reached the pose-matched contact exit frame.
 * Guarantees the character plants on a clean foot-contact frame rather than freezing mid-stride,
 * while bounding extra wait time so the transition always fires promptly.
 */
export function shouldExitWalkToTransition(
    currentFrame: number,
    exitFrame: number,
    elapsedMs: number,
    minWalkMs = 680,
    maxWaitExtraMs = 420
): boolean {
    if (elapsedMs < minWalkMs) return false
    if (elapsedMs >= minWalkMs + maxWaitExtraMs) return true
    return Math.abs(currentFrame - exitFrame) <= 2
}

/**
 * Compute whole-rig Disney 4-beat character physics for `walking` -> `targetPose`.
 *
 * Uses whole-rig anticipation squat, volume-preserving stretch hop, exact 1-frame apex
 * pose swap (overlapping into the target pose's live frames before touchdown), cushioned
 * landing squash, and damped spring settle. Never mutates individual Lottie child `<g>`
 * transforms, so limbs and shoes stay 100% locked to the artist's rig.
 */
export function computePoseTransitionFrame(pose: StuckBuddyPose, rawT: number): PoseTransitionFrame {
    const t = Math.max(0, Math.min(1, rawT))
    const p = POSE_TRANSITION_PROFILES[pose]

    if (t <= BEAT_SQUAT_END) {
        const u = easeInOutQuad(t / BEAT_SQUAT_END)
        return {
            scaleX: lerp(1, p.squatScaleX, u),
            scaleY: lerp(1, p.squatScaleY, u),
            translateY: lerp(0, p.squatDropPx, u),
            rotateDeg: lerp(0, -2.5, u),
            skewXDeg: lerp(0, p.squatSkewDeg, u),
            showTargetArt: false,
            bubbleReady: false,
        }
    }

    if (t < BEAT_APEX) {
        const u = easeOutCubic((t - BEAT_SQUAT_END) / (BEAT_APEX - BEAT_SQUAT_END))
        return {
            scaleX: lerp(p.squatScaleX, p.apexScaleX, u),
            scaleY: lerp(p.squatScaleY, p.apexScaleY, u),
            translateY: lerp(p.squatDropPx, -p.apexLiftPx, u),
            rotateDeg: lerp(-2.5, p.apexTiltDeg, u),
            skewXDeg: lerp(p.squatSkewDeg, 0, u),
            showTargetArt: false,
            bubbleReady: false,
        }
    }

    if (t < BEAT_LAND) {
        const u = easeInQuad((t - BEAT_APEX) / (BEAT_LAND - BEAT_APEX))
        return {
            scaleX: lerp(p.apexScaleX, p.landScaleX, u),
            scaleY: lerp(p.apexScaleY, p.landScaleY, u),
            translateY: lerp(-p.apexLiftPx, p.landDropPx, u),
            rotateDeg: lerp(p.apexTiltDeg, p.landTiltDeg, u),
            skewXDeg: 0,
            showTargetArt: true,
            bubbleReady: t >= BUBBLE_TRIGGER_T,
        }
    }

    const u = easeOutBackGentle((t - BEAT_LAND) / (1 - BEAT_LAND))
    return {
        scaleX: lerp(p.landScaleX, 1, u),
        scaleY: lerp(p.landScaleY, 1, u),
        translateY: lerp(p.landDropPx, 0, u),
        rotateDeg: lerp(p.landTiltDeg, 0, u),
        skewXDeg: 0,
        showTargetArt: true,
        bubbleReady: true,
    }
}

/** Format a transition frame into a GPU-composited CSS `transform` anchored at Peanut's feet. */
export function formatPoseTransitionTransform(frame: PoseTransitionFrame): string {
    return `translate3d(0, ${frame.translateY.toFixed(2)}px, 0) rotate(${frame.rotateDeg.toFixed(2)}deg) skewX(${frame.skewXDeg.toFixed(2)}deg) scale(${frame.scaleX.toFixed(4)}, ${frame.scaleY.toFixed(4)})`
}
