import {
    computePoseTransitionFrame,
    formatPoseTransitionTransform,
    POSE_TRANSITION_PROFILES,
    shouldExitWalkToTransition,
} from '../rigMorph'

describe('Disney 4-beat pose-matched mascot transition', () => {
    it('selects pose-matched contact frames from walking.json', () => {
        expect(POSE_TRANSITION_PROFILES['waving-hello'].walkExitFrame).toBe(8)
        expect(POSE_TRANSITION_PROFILES.thinking.walkExitFrame).toBe(28)
        expect(POSE_TRANSITION_PROFILES.worried.walkExitFrame).toBe(28)
    })

    it('exits walking only after min walk time and on the matched contact frame (or hard cap)', () => {
        expect(shouldExitWalkToTransition(8, 8, 400)).toBe(false)
        expect(shouldExitWalkToTransition(20, 8, 700)).toBe(false)
        expect(shouldExitWalkToTransition(8, 8, 700)).toBe(true)
        expect(shouldExitWalkToTransition(10, 8, 700)).toBe(true)
        expect(shouldExitWalkToTransition(20, 8, 1_150)).toBe(true)
    })

    it('produces anticipation squat -> stretch hop apex cut -> touchdown cushion -> clean settle', () => {
        const start = computePoseTransitionFrame('waving-hello', 0)
        expect(start.scaleX).toBeCloseTo(1, 5)
        expect(start.scaleY).toBeCloseTo(1, 5)
        expect(start.showTargetArt).toBe(false)
        expect(start.bubbleReady).toBe(false)

        // Beat 1: Braking anticipation squat
        const squat = computePoseTransitionFrame('waving-hello', 0.26)
        expect(squat.scaleX).toBeGreaterThan(1.1)
        expect(squat.scaleY).toBeLessThan(0.88)
        expect(squat.translateY).toBeGreaterThan(0)
        expect(squat.showTargetArt).toBe(false)

        // Beat 2: Just before apex vs exact apex pose cut
        const preApex = computePoseTransitionFrame('waving-hello', 0.49)
        const apex = computePoseTransitionFrame('waving-hello', 0.5)
        expect(preApex.showTargetArt).toBe(false)
        expect(apex.showTargetArt).toBe(true)
        expect(apex.translateY).toBeLessThan(-10)
        expect(apex.scaleY).toBeGreaterThan(1.1)

        // Beat 3: Touchdown cushion triggers speech bubble
        const land = computePoseTransitionFrame('waving-hello', 0.72)
        expect(land.showTargetArt).toBe(true)
        expect(land.bubbleReady).toBe(true)
        expect(land.scaleX).toBeGreaterThan(1.05)
        expect(land.scaleY).toBeLessThan(0.95)

        // Beat 4: Clean resting settle
        const end = computePoseTransitionFrame('waving-hello', 1)
        expect(end.scaleX).toBeCloseTo(1, 5)
        expect(end.scaleY).toBeCloseTo(1, 5)
        expect(end.translateY).toBeCloseTo(0, 5)
        expect(end.rotateDeg).toBeCloseTo(0, 5)
        expect(end.skewXDeg).toBeCloseTo(0, 5)
        expect(end.showTargetArt).toBe(true)
        expect(end.bubbleReady).toBe(true)
    })

    it('gives worried/sad a heavier landing squash and longer settle than waving-hello', () => {
        expect(POSE_TRANSITION_PROFILES.worried.durationMs).toBeGreaterThan(
            POSE_TRANSITION_PROFILES['waving-hello'].durationMs
        )
        const worriedLand = computePoseTransitionFrame('worried', 0.72)
        const waveLand = computePoseTransitionFrame('waving-hello', 0.72)
        expect(worriedLand.scaleY).toBeLessThan(waveLand.scaleY)
        expect(worriedLand.translateY).toBeGreaterThan(waveLand.translateY)
        expect(formatPoseTransitionTransform(worriedLand)).toContain('translate3d(')
    })
})
