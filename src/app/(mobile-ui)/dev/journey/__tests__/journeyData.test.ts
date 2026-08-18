import { FINDINGS, FUNNEL_STATES, IN_APP_SURFACES } from '../journeyData'
import type { FunnelStateId } from '../journeyTypes'

describe('journeyData', () => {
    const stateIds = new Set<FunnelStateId>(FUNNEL_STATES.map((s) => s.id))

    it('has the 7 funnel states in order', () => {
        expect(FUNNEL_STATES.map((s) => s.id)).toEqual([
            'no-access',
            'access-pre-kyc',
            'kycd-no-card',
            'application-in-flight',
            'card-active-unfunded',
            'funded-no-spend',
            'spent',
        ])
    })

    it('every surface maps to at least one valid state and carries a source file', () => {
        for (const surface of IN_APP_SURFACES) {
            expect(surface.states.length).toBeGreaterThan(0)
            for (const state of surface.states) expect(stateIds.has(state)).toBe(true)
            expect(surface.sourceFile).toMatch(/^src\//)
            expect(surface.copy.length).toBeGreaterThan(0)
            expect(surface.condition.length).toBeGreaterThan(0)
        }
    })

    it('surface ids are unique', () => {
        const ids = IN_APP_SURFACES.map((s) => s.id)
        expect(new Set(ids).size).toBe(ids.length)
    })

    it('every funnel state has at least one in-app surface', () => {
        for (const state of FUNNEL_STATES) {
            const surfaces = IN_APP_SURFACES.filter((s) => s.states.includes(state.id))
            expect(surfaces.length).toBeGreaterThan(0)
        }
    })

    it('the #2475 chooser surfaces are marked NEW in this PR', () => {
        const newOnes = IN_APP_SURFACES.filter((s) => s.isNewInThisPr).map((s) => s.id)
        expect(newOnes).toEqual(
            expect.arrayContaining(['step-outbound-spend', 'modal-spend-chooser', 'step-email-blocked'])
        )
    })

    it('maps each lifecycle spec stage to exactly one column', () => {
        const mapped = FUNNEL_STATES.flatMap((s) => s.specStages)
        // the machine's five v2 stages, each mapped once (finish_setup deleted; win_back added)
        expect([...mapped].sort()).toEqual(['create_card', 'first_spend', 'fund', 'verify', 'win_back'])
    })

    it('carries all 7 inventory findings, each source-file-annotated', () => {
        expect(FINDINGS).toHaveLength(7)
        expect(FINDINGS.map((f) => f.id)).toEqual([1, 2, 3, 4, 5, 6, 7])
        for (const finding of FINDINGS) {
            expect(finding.sourceFiles.length).toBeGreaterThan(0)
            for (const file of finding.sourceFiles) expect(file).toMatch(/^src\//)
        }
    })
})
