/**
 * KYC capability matrix — country × documents × provider outcome → what the
 * user sees next.
 *
 * Two levels per fixture, both driven off the SAME {@link KYC_PROFILES} entry:
 *
 *   1. GATE — the real `deriveGate` turns the capability block into a gate
 *      kind. This is the decision "can this user deposit here, and if not,
 *      what kind of not".
 *   2. COPY — the real `resolveKycModalVariant` + `getGateUserMessage` feed a
 *      real `InitiateKycModal` render, and we assert the exact strings on
 *      screen. A gate kind nobody can read is not a passing test.
 *
 * Why this and not just more `add-money-states.test.tsx` cases: that suite
 * stubs `gateFor` and hands the component a hardcoded gate alongside the rails,
 * so it cannot catch a rails→gate regression — the two halves are asserted to
 * agree because the fixture says they do. Here the rails are the only input and
 * `deriveGate` runs for real.
 *
 * Scope: this is the fixture tier. It proves the SCREEN is right for a given
 * capability block. That the BACKEND emits that block for a given country and
 * document set is nutcracker's job (mono/engineering/qa) — the `outcome` field
 * on each profile names the provider response being represented so the two can
 * be cross-checked by hand.
 */

import { render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { KYC_PROFILES, type KycProfile } from '@/test-utils/kyc-profiles'
import {
    deriveGate,
    getGateReasonCode,
    getGateUserMessage,
    resolveKycModalVariant,
    type GateScope,
    type GateState,
} from '@/utils/capability-gate'
import { InitiateKycModal } from '@/components/Kyc/InitiateKycModal'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }) }))
// Returns a bare boolean, not an object — an object here is truthy and
// silently swaps every screen for the outage modal.
jest.mock('@/hooks/useKycDegraded', () => ({ useKycDegraded: () => false }))

// The ONLY thing stubbed on the render path. `useIdentityVerification` (and so
// InitiateKycModal) reads the identity read-model off the auth user, and the
// fixture is the source of that read-model — so the mock hands back the
// profile's own `identityVerification` rather than a hand-written status that
// could disagree with the capability block it is paired with.
let authUser: { identityVerification: KycProfile['identityVerification'] } | null = null
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: authUser, isFetchingUser: false, fetchUser: jest.fn() }),
}))

function gateFor(profile: KycProfile, scope: GateScope): GateState {
    return deriveGate(
        {
            rails: profile.capabilities.rails,
            nextActions: profile.capabilities.nextActions,
            identityVerified: profile.identityVerification.status === 'verified',
            isLoading: false,
        },
        'deposit',
        scope
    )
}

/** The bank-deposit gate for one jurisdiction — the scope every bank screen uses. */
const bankIn = (country: string): GateScope => ({ channel: 'bank', country })

interface MatrixCase {
    profile: KycProfile
    /** Rail jurisdiction the user navigated into (railJurisdictionForBank output). */
    jurisdiction: string
    expectedGate: GateState['kind']
    expectedVariant: ReturnType<typeof resolveKycModalVariant>
    /** Copy that must be on screen once the modal renders for this gate. */
    mustSee: string[]
    /** Copy that must NOT be on screen — the wrong-wall regressions. */
    mustNotSee: string[]
}

const MATRIX: MatrixCase[] = [
    {
        profile: KYC_PROFILES.usBridgeApproved,
        jurisdiction: 'US',
        expectedGate: 'ready',
        // A ready gate never opens the modal; variant is asserted for
        // completeness so a future regression that DOES open it is visible.
        expectedVariant: 'default',
        mustSee: [],
        mustNotSee: [],
    },
    {
        profile: KYC_PROFILES.usBridgeNeedsProofOfAddress,
        jurisdiction: 'US',
        expectedGate: 'fixable-rejection',
        expectedVariant: 'provider_rejection',
        mustSee: [
            'We need extra documents',
            // The localized catalog entry for `proof_of_address`, NOT the
            // fixture's raw userMessage: a mapped reason code outranks the
            // backend prose, which is only the fallback for codes this build
            // does not know.
            'We need a valid proof of address document.',
        ],
        mustNotSee: ["We couldn't unlock this", 'Unlock your account'],
    },
    {
        profile: KYC_PROFILES.euSepaApprovedTriesUs,
        jurisdiction: 'US',
        expectedGate: 'needs-enrollment',
        expectedVariant: 'cross_region',
        // Identity is already verified: the copy must offer to EXTEND coverage,
        // not to re-verify from scratch and not to give up.
        mustSee: ['Unlock United States'],
        mustNotSee: ['Unlock your account', "We couldn't unlock this", 'We need extra documents'],
    },
    {
        profile: KYC_PROFILES.arMantecaPoolTier,
        jurisdiction: 'AR',
        expectedGate: 'fixable-rejection',
        expectedVariant: 'provider_rejection',
        mustSee: ['We need extra documents', 'To deposit from an Argentine bank we need your CUIT.'],
        mustNotSee: ["We couldn't unlock this"],
        // `manteca_tax_id_required` is not in the reason catalog, so the raw
        // userMessage IS what renders — the fallback branch.
    },
]

describe('KYC capability matrix', () => {
    describe.each(MATRIX)('$profile.id', (testCase) => {
        const { profile, jurisdiction, expectedGate, expectedVariant, mustSee, mustNotSee } = testCase

        it(`bank deposit in ${jurisdiction} → gate "${expectedGate}"`, () => {
            expect(gateFor(profile, bankIn(jurisdiction)).kind).toBe(expectedGate)
        })

        it(`bank deposit in ${jurisdiction} → modal variant "${expectedVariant}"`, () => {
            expect(resolveKycModalVariant(gateFor(profile, bankIn(jurisdiction)))).toBe(expectedVariant)
        })

        if (mustSee.length > 0) {
            it(`bank deposit in ${jurisdiction} → shows the right message`, () => {
                const gate = gateFor(profile, bankIn(jurisdiction))
                authUser = { identityVerification: profile.identityVerification }
                render(
                    <IntlWrapper>
                        <InitiateKycModal
                            visible
                            // The bank screens render this full-page (see
                            // add-money/[country]/bank). The modal presentation
                            // goes through a headlessui Transition portal, which
                            // needs animation frames jsdom does not run.
                            presentation="page"
                            onClose={jest.fn()}
                            onVerify={jest.fn()}
                            variant={resolveKycModalVariant(gate)}
                            providerMessage={getGateUserMessage(gate)}
                            // The real call sites pass this too, and the
                            // localized catalog entry for a known code WINS over
                            // the backend prose. Omitting it here asserted copy
                            // the app never actually shows — caught by the
                            // e2e/__shots__ capture, not by this suite.
                            reasonCode={getGateReasonCode(gate)}
                            regionName="United States"
                        />
                    </IntlWrapper>
                )

                // getAllBy, not getBy: the page presentation prints its title
                // twice (NavHeader + the heading under the icon) by design.
                for (const copy of mustSee) {
                    expect(screen.getAllByText(copy, { exact: false }).length).toBeGreaterThan(0)
                }
                for (const copy of mustNotSee) {
                    expect(screen.queryAllByText(copy, { exact: false })).toHaveLength(0)
                }
            })
        }
    })

    /**
     * The pool-tier case is the one where a single capability block has to give
     * two different answers depending on the operation. Asserting only the bank
     * gate would let a regression that also breaks QR pay through unnoticed.
     */
    it('AR pool tier can pay QR while bank deposit stays locked', () => {
        const profile = KYC_PROFILES.arMantecaPoolTier
        const state = {
            rails: profile.capabilities.rails,
            nextActions: profile.capabilities.nextActions,
            identityVerified: true,
            isLoading: false,
        }

        expect(deriveGate(state, 'pay', { country: 'AR' }).kind).toBe('ready')
        expect(deriveGate(state, 'deposit', bankIn('AR')).kind).toBe('fixable-rejection')
    })

    /**
     * Fixture hygiene: a rail naming an action nobody declared would silently
     * downgrade to the actionless "document-punt" verdict, so the matrix would
     * still pass while documenting a state the backend never emits.
     */
    it('every blocking action a rail names is declared in nextActions', () => {
        for (const profile of Object.values(KYC_PROFILES)) {
            const declared = new Set(profile.capabilities.nextActions.map((action) => action.key))
            for (const rail of profile.capabilities.rails) {
                for (const key of rail.blockingActions ?? []) {
                    expect([profile.id, rail.id, declared.has(key)]).toEqual([profile.id, rail.id, true])
                }
            }
        }
    })
})
