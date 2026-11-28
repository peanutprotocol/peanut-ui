import {
    applyRigMorphStep,
    computeFootPlantSquash,
    decomposeMatrix,
    easeOutBackWeight,
    lerpDecomposed,
    recomposeMatrix,
    restoreRigTransforms,
    type RigLayerPair,
} from '../rigMorph'

describe('rigMorph cross-animation Lottie transition', () => {
    it('round-trips affine matrix decomposition without rotational shear distortion', () => {
        const angle = Math.PI / 3
        const m = {
            a: 1.2 * Math.cos(angle),
            b: 1.2 * Math.sin(angle),
            c: -0.9 * Math.sin(angle),
            d: 0.9 * Math.cos(angle),
            e: 142.5,
            f: -38.25,
        }
        const decomposed = decomposeMatrix(m)
        expect(decomposed.tx).toBeCloseTo(142.5, 4)
        expect(decomposed.ty).toBeCloseTo(-38.25, 4)
        expect(decomposed.rot).toBeCloseTo(angle, 4)
        expect(decomposed.sx).toBeCloseTo(1.2, 4)
        expect(decomposed.sy).toBeCloseTo(0.9, 4)
        expect(recomposeMatrix(decomposed)).toContain('142.500 -38.250')
    })

    it('takes the shortest angular path across the +-PI seam', () => {
        const from = { tx: 0, ty: 0, rot: (170 * Math.PI) / 180, sx: 1, sy: 1, shear: 0 }
        const to = { tx: 0, ty: 0, rot: (-170 * Math.PI) / 180, sx: 1, sy: 1, shear: 0 }
        const mid = lerpDecomposed(from, to, 0.5)
        expect(Math.abs(Math.abs(mid.rot) - Math.PI)).toBeLessThan(1e-5)
    })

    it('produces weighted Disney overshoot and settles cleanly at endpoints', () => {
        expect(easeOutBackWeight(0)).toBeCloseTo(0, 5)
        expect(easeOutBackWeight(1)).toBeCloseTo(1, 5)
        expect(easeOutBackWeight(0.75)).toBeGreaterThan(1)

        const startSquash = computeFootPlantSquash(0)
        const midSquash = computeFootPlantSquash(0.22)
        const endSquash = computeFootPlantSquash(1)
        expect(startSquash.scaleX).toBeCloseTo(1, 5)
        expect(midSquash.scaleX).toBeGreaterThan(1.01)
        expect(midSquash.scaleY).toBeLessThan(0.99)
        expect(Math.abs(endSquash.scaleX - 1)).toBeLessThan(0.01)
    })

    it('cuts art crisply at midpoint t=0.5 and restores base transforms on completion', () => {
        const gFrom = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        const gTo = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        gFrom.setAttribute('transform', 'matrix(1 0 0 1 10 20)')
        gTo.setAttribute('transform', 'matrix(1 0 0 1 30 40)')

        const pairs: RigLayerPair[] = [
            {
                gFrom,
                gTo,
                dFrom: { tx: 10, ty: 20, rot: 0, sx: 1, sy: 1, shear: 0 },
                dTo: { tx: 30, ty: 40, rot: 0.5, sx: 1, sy: 1, shear: 0 },
                baseFrom: 'matrix(1 0 0 1 10 20)',
                baseTo: 'matrix(1 0 0 1 30 40)',
            },
        ]

        expect(applyRigMorphStep(pairs, 0.49).showTargetArt).toBe(false)
        expect(applyRigMorphStep(pairs, 0.5).showTargetArt).toBe(true)
        expect(gFrom.getAttribute('transform')).toBe(gTo.getAttribute('transform'))

        restoreRigTransforms(pairs)
        expect(gFrom.getAttribute('transform')).toBe('matrix(1 0 0 1 10 20)')
        expect(gTo.getAttribute('transform')).toBe('matrix(1 0 0 1 30 40)')
    })
})
