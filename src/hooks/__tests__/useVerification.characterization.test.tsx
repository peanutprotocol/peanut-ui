/**
 * Characterization of "is the user verified?" (state census UI part 7a).
 *
 * Seven derivations answered two different questions under one name. This test
 * pins each caller's answer before and after they move to one owner: a frozen
 * copy of every base derivation runs against the live code over the whole cohort
 * matrix (identity status × rail sets × demo mode, plus every `/users/me` in the
 * dev fixture registry). Each mismatch is a changed cell; the expected count is 0.
 */
import { renderHook } from '@testing-library/react'
import { useAuth } from '@/context/authContext'
import { isMantecaSupportedCountryCode } from '@/constants/manteca.consts'
import { FIXTURES } from '@/dev/fixtures/registry'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useIdentityVerification } from '@/hooks/useIdentityVerification'
import type { IUserProfile } from '@/interfaces/interfaces'
import type {
    IdentityVerification,
    IdentityVerificationStatus,
    RailCapability,
    RailCapabilityStatus,
    RailOperation,
} from '@/types/capabilities'
import { capabilityStateForProfile } from '@/utils/capability-gate'
import { deriveRegionAccess, isVerifiedForCountry } from '@/utils/regions.utils'

jest.mock('@/context/authContext', () => ({ useAuth: jest.fn() }))
let mockDemoMode = false
jest.mock('@/utils/demo', () => ({ ...jest.requireActual('@/utils/demo'), isDemoMode: () => mockDemoMode }))

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

// ── Frozen copies of the base derivations (feat/state-machines-wave-2 @ 242f55b07) ──

/** useCapabilities().isKycApproved: any enabled rail, or demo mode. */
const frozenIsKycApproved = (rails: RailCapability[], demo: boolean) =>
    demo || rails.some((rail) => rail.status === 'enabled')
/** deriveRegionAccess's local isKycApproved: unlocks "Rest of the world" (no demo mode). */
const frozenRestOfWorldUnlocked = (rails: RailCapability[]) => rails.some((rail) => rail.status === 'enabled')
/**
 * useIdentityVerification().isVerified, capabilityStateForProfile().identityVerified,
 * BankSendIdentityGate's fetched-profile check and ActivationCTAs (with `!oneShot`).
 */
const frozenIdentityVerified = (identity: IdentityVerification | undefined) => identity?.status === 'verified'
/** isVerifiedForCountry (regions.utils), read by the Manteca add-money and withdraw flows. */
function frozenIsVerifiedForCountry(rails: RailCapability[], countryCode: string, op: RailOperation): boolean {
    const upper = countryCode.toUpperCase()
    if (isMantecaSupportedCountryCode(upper)) {
        return rails.some(
            (rail) =>
                rail.channel === 'bank' &&
                rail.country.toUpperCase() === upper &&
                (rail.operations?.[op] ?? rail.status) === 'enabled'
        )
    }
    return rails.some((rail) => rail.channel === 'bank' && rail.status === 'enabled')
}

// ── Cohort matrix ──

type Template = Omit<RailCapability, 'status' | 'operations'>
const rail = (id: string, channel: RailCapability['channel'], country: string, currency: string): Template => {
    const [provider, method] = id.split('.')
    return {
        id: id as RailCapability['id'],
        provider: provider as RailCapability['provider'],
        method: method.toUpperCase(),
        channel,
        country,
        currency,
    }
}
const TEMPLATES: Template[] = [
    rail('bridge.ach_us', 'bank', 'US', 'USD'),
    rail('bridge.sepa_eu', 'bank', 'EU', 'EUR'),
    rail('bridge.spei_mx', 'bank', 'MX', 'MXN'),
    rail('manteca.bank_transfer_ar', 'bank', 'AR', 'ARS'),
    rail('manteca.pix_br', 'bank', 'BR', 'BRL'),
    rail('avenia.pix_br', 'bank', 'BR', 'BRL'),
    rail('manteca.mercadopago_qr_ar', 'qr-only', 'AR', 'ARS'),
    rail('rain.card', 'card', 'GLOBAL', 'USD'),
]
const STATUSES: RailCapabilityStatus[] = ['enabled', 'pending', 'requires-info', 'blocked']
// none (Bridge), a pool tier (pay only), the reverse split
const OPERATION_SPLITS: Array<RailCapability['operations']> = [
    undefined,
    { pay: 'enabled', deposit: 'requires-info', withdraw: 'requires-info' },
    { pay: 'blocked', deposit: 'enabled', withdraw: 'enabled' },
]

function railSets(): RailCapability[][] {
    const sets: RailCapability[][] = [[]]
    for (const template of TEMPLATES)
        for (const status of STATUSES)
            for (const operations of OPERATION_SPLITS)
                sets.push([{ ...template, status, ...(operations ? { operations } : {}) }])
    // two rails, one enabled and one not: the legacy Bridge-only user, Avenia beside a pending Manteca, …
    for (const a of TEMPLATES)
        for (const b of TEMPLATES)
            if (a !== b)
                sets.push([
                    { ...a, status: 'enabled' },
                    { ...b, status: 'pending' },
                ])
    return sets
}

const IDENTITY_STATUSES: IdentityVerificationStatus[] = [
    'not_started',
    'processing',
    'verified',
    'action_required',
    'failed',
]
const IDENTITIES: Array<IdentityVerification | undefined> = [
    undefined,
    ...IDENTITY_STATUSES.map((status) => ({ status })),
    { status: 'verified', oneShot: true },
    { status: 'action_required', rejectLabels: ['DUPLICATE_EMAIL'] },
]

type Cell = { name: string; user: IUserProfile | null }

function matrixCells(): Cell[] {
    const cells: Cell[] = [{ name: 'logged out', user: null }]
    railSets().forEach((rails, railIndex) =>
        IDENTITIES.forEach((identity, identityIndex) =>
            cells.push({
                name: `rails#${railIndex} identity#${identityIndex}`,
                user: {
                    ...(identity ? { identityVerification: identity } : {}),
                    capabilities: { rails, nextActions: [], restrictions: [] },
                } as unknown as IUserProfile,
            })
        )
    )
    return cells
}

/** Every `/users/me` the dev fixtures serve with rails or an identity block. */
function fixtureCells(): Cell[] {
    return Object.entries(FIXTURES).flatMap(([name, fixture]) => {
        const me = fixture.responses?.['GET /users/me'] as Partial<IUserProfile> | undefined
        if (!me || (!Array.isArray(me.capabilities?.rails) && !me.identityVerification)) return []
        // a fixture overrides part of the demo `/users/me`; the API always serves the full capability block
        const capabilities = {
            nextActions: [],
            restrictions: [],
            ...me.capabilities,
            rails: me.capabilities?.rails ?? [],
        }
        return [{ name: `fixture ${name}`, user: { ...me, capabilities } as IUserProfile }]
    })
}

const OPS: RailOperation[] = ['pay', 'deposit', 'withdraw']
const COUNTRIES = ['AR', 'ar', 'BR', 'US', 'MX', 'DE', 'GB']

// ── The live answers, per caller meaning ──

function useLiveAnswers() {
    const { isKycApproved } = useCapabilities()
    const { isVerified } = useIdentityVerification()
    return { hasAnyEnabledRail: isKycApproved, identityVerified: isVerified }
}

function liveAnswers(user: IUserProfile | null) {
    const rails = user?.capabilities?.rails ?? []
    mockUseAuth.mockReturnValue({ user, isFetchingUser: false } as unknown as ReturnType<typeof useAuth>)
    const { result, unmount } = renderHook(() => useLiveAnswers())
    const hook = result.current
    unmount()
    return {
        hasAnyEnabledRail: hook.hasAnyEnabledRail,
        restOfWorldUnlocked: deriveRegionAccess(rails).unlockedRegions.some((r) => r.name === 'Rest of the world'),
        identityVerified: hook.identityVerified,
        gateIdentityVerified: capabilityStateForProfile(user, false).identityVerified,
        canUse: (op: RailOperation, country: string) => isVerifiedForCountry(rails, country, op),
    }
}

describe('useVerification characterization: every caller keeps its answer', () => {
    const cells = [...matrixCells(), ...fixtureCells()]

    it('covers the matrix and the fixture registry', () => {
        expect(cells.length).toBeGreaterThan(1000)
        expect(fixtureCells().length).toBeGreaterThan(0)
    })

    it.each([false, true])('demo mode %s: 0 changed cells', (demo) => {
        mockDemoMode = demo
        const changed: string[] = []
        for (const { name, user } of cells) {
            const rails = user?.capabilities?.rails ?? []
            const identity = user?.identityVerification
            const live = liveAnswers(user)
            const expectations: Array<[string, boolean, boolean]> = [
                ['hasAnyEnabledRail', frozenIsKycApproved(rails, demo), live.hasAnyEnabledRail],
                ['restOfWorldUnlocked', frozenRestOfWorldUnlocked(rails), live.restOfWorldUnlocked],
                ['identityVerified', frozenIdentityVerified(identity), live.identityVerified],
                ['gateIdentityVerified', frozenIdentityVerified(identity), live.gateIdentityVerified ?? false],
            ]
            for (const op of OPS)
                for (const country of COUNTRIES)
                    expectations.push([
                        `canUse(${op}, ${country})`,
                        frozenIsVerifiedForCountry(rails, country, op),
                        live.canUse(op, country),
                    ])
            for (const [answer, before, after] of expectations)
                if (before !== after) changed.push(`${name} demo=${demo} ${answer}: ${before} → ${after}`)
        }
        expect(changed).toEqual([])
    })
})
