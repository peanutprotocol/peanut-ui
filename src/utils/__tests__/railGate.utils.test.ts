import { hasEnabledRail, hasFullMantecaRail, hasRailInProgress, hasFunctionalRail } from '../railGate.utils'
import { type IUserRail, type UserRailStatus } from '@/interfaces/interfaces'

function rail(
    provider: string,
    status: UserRailStatus,
    opts: { country?: string; mantecaUserId?: string } = {}
): IUserRail {
    return {
        id: `ur-${provider}-${status}-${opts.country ?? ''}`,
        railId: `r-${provider}-${opts.country ?? ''}`,
        status,
        metadata: opts.mantecaUserId ? { mantecaUserId: opts.mantecaUserId } : null,
        rail: {
            id: `r-${provider}-${opts.country ?? ''}`,
            provider: { code: provider, name: provider },
            method: { code: `M_${provider}`, name: provider, country: opts.country ?? 'BR', currency: 'BRL' },
        },
    }
}

describe('hasEnabledRail', () => {
    test('true when an ENABLED rail for the provider exists', () => {
        expect(hasEnabledRail([rail('MANTECA', 'ENABLED')], 'MANTECA')).toBe(true)
        expect(hasEnabledRail([rail('BRIDGE', 'ENABLED')], 'BRIDGE')).toBe(true)
    })

    test('false for a different provider, non-ENABLED status, or no rails', () => {
        expect(hasEnabledRail([rail('MANTECA', 'ENABLED')], 'BRIDGE')).toBe(false)
        expect(hasEnabledRail([rail('MANTECA', 'PENDING')], 'MANTECA')).toBe(false)
        expect(hasEnabledRail([], 'MANTECA')).toBe(false)
        expect(hasEnabledRail(undefined, 'MANTECA')).toBe(false)
    })
})

describe('hasFullMantecaRail', () => {
    test('true only for an ENABLED Manteca rail carrying a mantecaUserId', () => {
        expect(hasFullMantecaRail([rail('MANTECA', 'ENABLED', { mantecaUserId: '2414356' })])).toBe(true)
    })

    test('false for a QR-tier rail — ENABLED but no mantecaUserId', () => {
        expect(hasFullMantecaRail([rail('MANTECA', 'ENABLED')])).toBe(false)
    })

    test('false for a full rail that is not ENABLED', () => {
        expect(hasFullMantecaRail([rail('MANTECA', 'PENDING', { mantecaUserId: '2414356' })])).toBe(false)
    })

    test('country narrows to the matching rail method country', () => {
        const rails = [
            rail('MANTECA', 'ENABLED', { country: 'BR', mantecaUserId: 'm-br' }),
            rail('MANTECA', 'ENABLED', { country: 'AR' }), // AR is QR-tier only
        ]
        expect(hasFullMantecaRail(rails, 'BR')).toBe(true)
        expect(hasFullMantecaRail(rails, 'AR')).toBe(false)
        expect(hasFullMantecaRail(rails, 'br')).toBe(true) // case-insensitive
    })
})

describe('hasRailInProgress', () => {
    test('true for PENDING / REQUIRES_INFORMATION / REQUIRES_EXTRA_INFORMATION', () => {
        expect(hasRailInProgress([rail('MANTECA', 'PENDING')], 'MANTECA')).toBe(true)
        expect(hasRailInProgress([rail('BRIDGE', 'REQUIRES_INFORMATION')], 'BRIDGE')).toBe(true)
        expect(hasRailInProgress([rail('BRIDGE', 'REQUIRES_EXTRA_INFORMATION')], 'BRIDGE')).toBe(true)
    })

    test('false for ENABLED / REJECTED / FAILED', () => {
        expect(hasRailInProgress([rail('MANTECA', 'ENABLED')], 'MANTECA')).toBe(false)
        expect(hasRailInProgress([rail('MANTECA', 'REJECTED')], 'MANTECA')).toBe(false)
        expect(hasRailInProgress([rail('MANTECA', 'FAILED')], 'MANTECA')).toBe(false)
    })
})

describe('hasFunctionalRail', () => {
    test('true for ENABLED or any in-progress status', () => {
        expect(hasFunctionalRail([rail('BRIDGE', 'ENABLED')], 'BRIDGE')).toBe(true)
        expect(hasFunctionalRail([rail('BRIDGE', 'PENDING')], 'BRIDGE')).toBe(true)
    })

    test('false when the only rail is REJECTED / FAILED, or none exists', () => {
        expect(hasFunctionalRail([rail('BRIDGE', 'REJECTED')], 'BRIDGE')).toBe(false)
        expect(hasFunctionalRail([rail('BRIDGE', 'FAILED')], 'BRIDGE')).toBe(false)
        expect(hasFunctionalRail([], 'BRIDGE')).toBe(false)
    })
})
