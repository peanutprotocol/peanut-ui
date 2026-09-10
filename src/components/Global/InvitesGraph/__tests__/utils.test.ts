import { getExternalNodeUsers, getModeConfigs, getNodePoints, sizeLabelToPoints } from '../utils'
import {
    DEFAULT_ACTIVITY_FILTER,
    DEFAULT_EXTERNAL_NODES_CONFIG,
    DEFAULT_FORCE_CONFIG,
    DEFAULT_VISIBILITY_CONFIG,
} from '../types'

describe('sizeLabelToPoints', () => {
    it('maps qualitative size labels to numeric points', () => {
        expect(sizeLabelToPoints('tiny')).toBe(5)
        expect(sizeLabelToPoints('small')).toBe(50)
        expect(sizeLabelToPoints('medium')).toBe(500)
        expect(sizeLabelToPoints('large')).toBe(5000)
        expect(sizeLabelToPoints('huge')).toBe(50000)
    })

    it('defaults to 10 when size is undefined', () => {
        expect(sizeLabelToPoints(undefined)).toBe(10)
    })
})

describe('getNodePoints', () => {
    it('uses real totalPoints in full mode', () => {
        expect(getNodePoints({ totalPoints: 1234 })).toBe(1234)
    })

    it('converts size label in payment mode (no totalPoints)', () => {
        expect(getNodePoints({ size: 'medium' })).toBe(500)
    })

    it('prefers totalPoints when both are present', () => {
        expect(getNodePoints({ size: 'huge', totalPoints: 42 })).toBe(42)
    })

    it('falls back to 0 when nothing is present', () => {
        expect(getNodePoints({})).toBe(0)
    })
})

describe('getExternalNodeUsers', () => {
    it('counts userIds in payment mode', () => {
        expect(getExternalNodeUsers({ userIds: ['a', 'b', 'c'] })).toBe(3)
    })

    it('uses uniqueUsers in full mode', () => {
        expect(getExternalNodeUsers({ uniqueUsers: 7 })).toBe(7)
    })

    it('prefers userIds over uniqueUsers when both are present', () => {
        expect(getExternalNodeUsers({ userIds: ['a'], uniqueUsers: 7 })).toBe(1)
    })

    it('falls back to 1 when nothing is present', () => {
        expect(getExternalNodeUsers({})).toBe(1)
    })
})

describe('getModeConfigs', () => {
    const defaults = {
        initialActivityFilter: DEFAULT_ACTIVITY_FILTER,
        initialForceConfig: DEFAULT_FORCE_CONFIG,
        initialVisibilityConfig: DEFAULT_VISIBILITY_CONFIG,
    }

    it('full mode passes initial configs through unchanged', () => {
        const result = getModeConfigs({ mode: 'full', ...defaults })
        expect(result.modeActivityFilter).toBe(DEFAULT_ACTIVITY_FILTER)
        expect(result.modeVisibilityConfig).toBe(DEFAULT_VISIBILITY_CONFIG)
        expect(result.finalModeForceConfig).toBe(DEFAULT_FORCE_CONFIG)
        expect(result.modeExternalNodesConfig).toBe(DEFAULT_EXTERNAL_NODES_CONFIG)
    })

    it('payment mode fixes the 120-day window, disables invite edges, and weakens external links', () => {
        const result = getModeConfigs({ mode: 'payment', ...defaults })
        expect(result.modeActivityFilter.activityDays).toBe(120)
        expect(result.modeVisibilityConfig.inviteEdges).toBe(false)
        expect(result.finalModeForceConfig.inviteLinks.enabled).toBe(false)
        expect(result.finalModeForceConfig.externalLinks.strength).toBeCloseTo(
            DEFAULT_FORCE_CONFIG.externalLinks.strength * 0.1
        )
        expect(result.modeExternalNodesConfig).toEqual({
            enabled: true,
            minConnections: 10,
            limit: 5000,
            types: { WALLET: false, BANK: false, MERCHANT: true },
        })
    })

    it('user mode disables p2p, triples charge, and lengthens invite link distance', () => {
        const result = getModeConfigs({ mode: 'user', ...defaults })
        expect(result.modeVisibilityConfig.p2pEdges).toBe(false)
        expect(result.finalModeForceConfig.p2pLinks.enabled).toBe(false)
        expect(result.finalModeForceConfig.charge.strength).toBe(DEFAULT_FORCE_CONFIG.charge.strength * 3)
        expect(result.finalModeForceConfig.inviteLinks.distance).toBe(80)
        expect(result.modeExternalNodesConfig).toBe(DEFAULT_EXTERNAL_NODES_CONFIG)
    })
})
