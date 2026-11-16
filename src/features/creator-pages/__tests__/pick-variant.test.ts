import { pickVariant } from '../pick-variant'

const experiment = {
    id: 'test-b',
    variants: [
        { id: 'a1', weight: 1 },
        { id: 'g2', weight: 2 },
        { id: 'e1', weight: 0 },
    ],
}
const never = () => {
    throw new Error('a sticky visitor must not be re-randomised')
}

describe('pickVariant', () => {
    it('keeps the variant the cookie names for this experiment', () => {
        expect(pickVariant(experiment, 'test-b.a1', never)).toBe('a1')
        expect(pickVariant(experiment, 'test-b.g2', never)).toBe('g2')
    })

    it('picks again when the cookie names an older experiment', () => {
        expect(pickVariant(experiment, 'test-a.a1', () => 0.99)).toBe('g2')
    })

    it('picks again when the cookie names a parked or unknown variant, or is malformed', () => {
        expect(pickVariant(experiment, 'test-b.e1', () => 0)).toBe('a1')
        expect(pickVariant(experiment, 'test-b.zz', () => 0)).toBe('a1')
        expect(pickVariant(experiment, 'test-b', () => 0)).toBe('a1')
        expect(pickVariant(experiment, undefined, () => 0)).toBe('a1')
    })

    it('never picks a variant with weight 0', () => {
        for (let i = 0; i < 1000; i++) expect(pickVariant(experiment, null, () => i / 1000)).not.toBe('e1')
    })

    it('splits by weight', () => {
        const counts: Record<string, number> = {}
        for (let i = 0; i < 3000; i++) {
            const id = pickVariant(experiment, null, () => (i + 0.5) / 3000)!
            counts[id] = (counts[id] ?? 0) + 1
        }
        expect(counts).toEqual({ a1: 1000, g2: 2000 })
    })

    it('returns the last live variant at the top of the range, and null when every weight is 0', () => {
        expect(pickVariant(experiment, null, () => 0.999999999)).toBe('g2')
        expect(pickVariant({ id: 'x', variants: [{ id: 'a1', weight: 0 }] }, null)).toBeNull()
    })
})
