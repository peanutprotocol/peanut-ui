/**
 * ActivationCTAs — the provider-rejection override must respect that a user can
 * already transact.
 *
 * A Sumsub-approved user whose *bank* rail is rejected used to always get the
 * "Complete your setup → Upload document" (fixable) / "Verification issue"
 * (blocked) home card, even when they hold an active card or another enabled
 * rail. For a card-holder that's a nag on a capability they don't need — and,
 * for a terminally-rejected bank rail, one they can't fix. The gate below
 * suppresses the override whenever the user can already transact (any enabled
 * rail — the card's rail reads `enabled` — or BE-marked `isActivated`). A
 * genuinely-fixable bank RFI still surfaces in the /add-money bank flow.
 */
import React from 'react'
import { render as rtlRender, screen, fireEvent } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: IntlWrapper })

let mockRails: Array<{
    id: string
    provider?: string
    channel: string
    status: string
    operations?: Record<string, string>
    reason?: { userMessage: string; code?: string }
    resolved?: {
        status: 'fixable' | 'blocked'
        blocking: {
            code: string
            userMessage: string
            selfHealable: boolean
            selfHealKind: 'document-resubmit' | 'restart-identity'
        }
        nextAction?: { key: string; kind: 'sumsub'; purpose: string; levelKey: string }
    }
}> = []
let mockUser: { user?: { isActivated?: boolean; userId?: string } } | null = null
let mockHasCardAccess: boolean | undefined = false
let mockDisableCardPromotion = false
jest.mock('@/config/underMaintenance.config', () => {
    const actual = jest.requireActual('@/config/underMaintenance.config').default
    return {
        __esModule: true,
        default: {
            ...actual,
            get disableCardPromotion() {
                return mockDisableCardPromotion
            },
        },
    }
})
const mockHeal = jest.fn()
const mockRestartIdentity = jest.fn()
const mockInitiateKyc = jest.fn()
const mockOpenSupport = jest.fn()
const mockPush = jest.fn()
const mockSetIsQRScannerOpen = jest.fn()

jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({
        rails: mockRails,
        channelOf: (rail: { channel: string }) => rail.channel,
        operationStatus: (railId: string, op: string) => {
            const rail = mockRails.find((r) => r.id === railId)
            return rail?.operations?.[op] ?? rail?.status
        },
        // Mirrors the real hook: per-op refinement falling back to rail status.
        canDo: (op: string, opts?: { provider?: string }) =>
            mockRails.some(
                (rail) =>
                    (opts?.provider === undefined || rail.provider === opts.provider) &&
                    (rail.operations?.[op] ?? rail.status) === 'enabled'
            ),
        nextActionsForRail: () => [],
        nextActions: [],
    }),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockUser }),
}))
let mockRegionRestricted = false
let mockIdentityReason: { code: string; userMessage: string } | undefined
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({
        identity: { status: 'not_started', reason: mockIdentityReason },
        isProcessing: false,
        needsAction: false,
        isRegionRestricted: mockRegionRestricted,
    }),
}))
let mockResidenceRestrictions = { banking: false, card: false }
jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => mockResidenceRestrictions,
}))
// Happy-path funnel steps render the checklist; these suites test the
// interrupt cards, so the checklist itself is a marker (own suite covers it).
jest.mock('@/components/Home/GettingStartedChecklist', () => ({
    __esModule: true,
    default: ({
        onStartIdentityCheck,
        onStartQrIdentityCheck,
    }: {
        onStartIdentityCheck?: () => void
        onStartQrIdentityCheck?: () => void
    }) => (
        <div>
            getting-started-checklist
            {/* not buttons: the slot suites assert the checklist brings no big-card button */}
            <span onClick={onStartIdentityCheck}>start-identity-check</span>
            <span onClick={onStartQrIdentityCheck}>start-qr-identity-check</span>
        </div>
    ),
}))
jest.mock('@/components/Kyc/InitiateKycModal', () => ({
    InitiateKycModal: ({ visible, onVerify }: { visible: boolean; onVerify: () => void }) =>
        visible ? <button onClick={onVerify}>initiate-kyc-modal</button> : null,
}))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({
        setIsQRScannerOpen: mockSetIsQRScannerOpen,
        openSupportWithMessage: mockOpenSupport,
    }),
}))
jest.mock('@/hooks/useCardSurfaceAccess', () => ({
    useCardSurfaceAccess: () => ({ showCardSurface: mockHasCardAccess, canSpendPathViaCard: mockHasCardAccess }),
}))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => ({
        handleFixableRejection: mockHeal,
        handleRestartIdentity: mockRestartIdentity,
        handleInitiateKyc: mockInitiateKyc,
        showWrapper: false,
    }),
}))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({
    SumsubKycModals: () => null,
}))

import ActivationCTAs from '../ActivationCTAs'
import type { OnboardingState } from '@/utils/activation-step.utils'

const bankRejected = {
    id: 'bridge.sepa_eu',
    provider: 'bridge',
    channel: 'bank',
    status: 'requires-info',
    reason: { userMessage: 'We need a valid proof of address document.' },
}
const enabledCardRail = { id: 'rain.card_rain', channel: 'card', status: 'enabled' }
const NEW_USER: OnboardingState = {
    verify: 'todo',
    addMoneyDone: false,
    firstPaymentDone: false,
    firstPaymentRoute: 'card_qr',
    step: 'verify',
}
const IN_REVIEW: OnboardingState = { ...NEW_USER, verify: 'in_review', step: 'add_money' }
const VERIFIED: OnboardingState = { ...NEW_USER, verify: 'done', step: 'add_money' }
const FUNDED: OnboardingState = { ...VERIFIED, addMoneyDone: true, step: 'first_payment' }
const COMPLETED: OnboardingState = { ...FUNDED, firstPaymentDone: true, step: 'completed' }

beforeEach(() => {
    jest.clearAllMocks()
    mockRails = []
    mockUser = { user: { isActivated: false, userId: 'u1' } }
    mockHasCardAccess = false
    mockDisableCardPromotion = false
    mockResidenceRestrictions = { banking: false, card: false }
    mockRegionRestricted = false
    mockIdentityReason = undefined
})

describe('ActivationCTAs — residence restrictions', () => {
    it('a fully restricted residence keeps the checklist: QR pay is open to every verified user', () => {
        mockResidenceRestrictions = { banking: true, card: true }
        render(<ActivationCTAs onboarding={NEW_USER} />)
        expect(screen.getByText('getting-started-checklist')).toBeInTheDocument()
    })

    it('a partial restriction keeps the checklist', () => {
        mockResidenceRestrictions = { banking: false, card: true }
        render(<ActivationCTAs onboarding={NEW_USER} />)
        expect(screen.getByText('getting-started-checklist')).toBeInTheDocument()
    })
})

describe('ActivationCTAs — the Verify row starts the ID check in place', () => {
    it('opens the shared start modal, whose Verify starts the one ID check (no corridor)', () => {
        render(<ActivationCTAs onboarding={NEW_USER} />)
        expect(screen.queryByText('initiate-kyc-modal')).not.toBeInTheDocument()
        fireEvent.click(screen.getByText('start-identity-check'))
        fireEvent.click(screen.getByText('initiate-kyc-modal'))
        expect(mockInitiateKyc).toHaveBeenCalledWith()
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('the QR ID check starts the verification QR pay uses', () => {
        mockResidenceRestrictions = { banking: true, card: true }
        render(<ActivationCTAs onboarding={NEW_USER} />)
        fireEvent.click(screen.getByText('start-qr-identity-check'))
        expect(mockInitiateKyc).toHaveBeenCalledWith('LATAM')
    })
})

describe('ActivationCTAs — an ID check that ended on a final decision', () => {
    const FAILED: OnboardingState = { ...NEW_USER, verify: 'failed', firstPaymentRoute: 'none' }

    it('replaces the checklist with the verification-issue card', () => {
        render(<ActivationCTAs onboarding={FAILED} />)
        expect(screen.getByText('Verification issue')).toBeInTheDocument()
        expect(screen.queryByText('getting-started-checklist')).not.toBeInTheDocument()
    })

    it('its button opens support with the context, never a new ID check', () => {
        mockIdentityReason = { code: 'identity_rejected', userMessage: 'Your verification was not approved.' }
        render(<ActivationCTAs onboarding={FAILED} />)
        fireEvent.click(screen.getByText('Contact support'))
        expect(mockOpenSupport).toHaveBeenCalledWith(expect.stringContaining('Your verification was not approved.'))
        expect(mockInitiateKyc).not.toHaveBeenCalled()
    })

    it('can be hidden under its own key', () => {
        const onHide = jest.fn()
        render(<ActivationCTAs onboarding={FAILED} onHideBlockedCard={onHide} />)
        fireEvent.click(screen.getByText('Hide'))
        expect(onHide).toHaveBeenCalledWith('blocked-card:verification-issue:identity_failed')
    })

    it('the region card still outranks it', () => {
        mockRegionRestricted = true
        render(<ActivationCTAs onboarding={FAILED} />)
        expect(screen.getByText("We can't verify IDs from this country")).toBeInTheDocument()
    })
})

describe('ActivationCTAs — region-restricted outranks every funnel step', () => {
    it('replaces the verify nag, which this user can never satisfy', () => {
        mockRegionRestricted = true
        render(<ActivationCTAs onboarding={NEW_USER} />)

        expect(screen.getByText("We can't verify IDs from this country")).toBeInTheDocument()
        expect(screen.queryByText('Verification issue')).not.toBeInTheDocument()
    })

    it('outranks the getting-started checklist — every listed step is a closed door', () => {
        mockRegionRestricted = true
        mockHasCardAccess = true
        render(<ActivationCTAs onboarding={FUNDED} />)

        expect(screen.getByText("We can't verify IDs from this country")).toBeInTheDocument()
        expect(screen.queryByText('getting-started-checklist')).not.toBeInTheDocument()
        fireEvent.click(screen.getByText('Send or request money'))
        expect(mockPush).toHaveBeenCalledWith('/send')
        expect(mockPush).not.toHaveBeenCalledWith('/shhhhh')
    })

    it('never opens support — support cannot lift a jurisdictional block', () => {
        mockRegionRestricted = true
        mockRails = [bankRejected]
        render(<ActivationCTAs onboarding={VERIFIED} />)

        fireEvent.click(screen.getByText('Send or request money'))
        expect(mockPush).toHaveBeenCalledWith('/send')
    })
})

describe('ActivationCTAs — rejection override respects existing transacting ability', () => {
    it('a card-holder (enabled card rail) with a rejected bank rail does NOT see "Complete setup"', () => {
        mockRails = [enabledCardRail, bankRejected]
        render(<ActivationCTAs onboarding={VERIFIED} />)
        expect(screen.queryByText('Complete setup')).not.toBeInTheDocument()
        // Falls through to the checklist instead of the rejection card.
        expect(screen.getByText('getting-started-checklist')).toBeInTheDocument()
    })

    it('a BE-activated user with a rejected bank rail does NOT see the nag', () => {
        mockRails = [bankRejected]
        mockUser = { user: { isActivated: true, userId: 'u1' } }
        render(<ActivationCTAs onboarding={VERIFIED} />)
        expect(screen.queryByText('Complete setup')).not.toBeInTheDocument()
    })

    it('a user with NO working rail still sees the fixable-rejection nag (unchanged behavior)', () => {
        mockRails = [bankRejected]
        render(<ActivationCTAs onboarding={VERIFIED} />)
        expect(screen.getByText('Complete setup')).toBeInTheDocument()
        expect(screen.getByText('We need a valid proof of address document.')).toBeInTheDocument()
    })

    it('a card-ELIGIBLE user (access, no card) with a rejected bank rail sees the checklist, not the nag', () => {
        // The 2026-08-20 deposit-first gate moved this cohort off the card
        // step; without this shield they would trade the card banner for a
        // "Contact support" dead end over a rail the old region-picker detour
        // auto-enrolled. Crypto deposit → card is their working path.
        mockRails = [bankRejected]
        mockHasCardAccess = true
        render(<ActivationCTAs onboarding={VERIFIED} />)
        expect(screen.queryByText('Complete setup')).not.toBeInTheDocument()
        expect(screen.getByText('getting-started-checklist')).toBeInTheDocument()
    })

    it('fixable rejection: Upload document heals inline (handleFixableRejection), does not navigate away', () => {
        mockRails = [bankRejected]
        render(<ActivationCTAs onboarding={VERIFIED} />)
        fireEvent.click(screen.getByText('Upload document'))
        expect(mockHeal).toHaveBeenCalledWith({ provider: 'BRIDGE', actionKey: null, reasonCode: null })
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('a BRIDGE residence park hands the reason code over, or the heal cannot route it', () => {
        // The heal sends a residence park to start-action and everything else to
        // resubmit, and the code is the only thing that distinguishes them. Without
        // it this CTA falls through to /kyc/resubmit, which 404s for a rail the
        // residence gate parked before Bridge ever saw the user — so the hook-level
        // test can pass while every real button still errors (TASK-22286).
        mockRails = [
            {
                id: 'bridge.sepa_eu',
                provider: 'bridge',
                channel: 'bank',
                status: 'requires-info',
                reason: { userMessage: 'We still need your home address to finish setting up bank transfers.' },
                resolved: {
                    status: 'fixable',
                    blocking: {
                        code: 'residence_unresolved',
                        userMessage: 'We still need your home address to finish setting up bank transfers.',
                        selfHealable: true,
                        selfHealKind: 'document-resubmit',
                    },
                    nextAction: {
                        key: 'sumsub:address_of_residence',
                        kind: 'sumsub',
                        purpose: 'bridge-rfi',
                        levelKey: 'address_of_residence',
                    },
                },
            },
        ]
        render(<ActivationCTAs onboarding={VERIFIED} />)
        fireEvent.click(screen.getByText('Upload document'))
        expect(mockHeal).toHaveBeenCalledWith({
            provider: 'BRIDGE',
            actionKey: 'sumsub:address_of_residence',
            reasonCode: 'residence_unresolved',
        })
    })

    it('Manteca RFI (sumsub nextAction on the verdict) hands the action key to the heal, not the generic resubmit', () => {
        mockRails = [
            {
                id: 'manteca.pix_br',
                provider: 'manteca',
                channel: 'bank',
                status: 'requires-info',
                reason: { userMessage: 'We need information about your source of funds.' },
                resolved: {
                    status: 'fixable',
                    blocking: {
                        code: 'source_of_funds',
                        userMessage: 'We need information about your source of funds.',
                        selfHealable: true,
                        selfHealKind: 'document-resubmit',
                    },
                    nextAction: {
                        key: 'sumsub:source_of_funds',
                        kind: 'sumsub',
                        purpose: 'unlock-manteca',
                        levelKey: 'source_of_funds',
                    },
                },
            },
        ]
        render(<ActivationCTAs onboarding={VERIFIED} />)
        fireEvent.click(screen.getByText('Upload document'))
        expect(mockHeal).toHaveBeenCalledWith({
            provider: 'MANTECA',
            actionKey: 'sumsub:source_of_funds',
            reasonCode: 'source_of_funds',
        })
    })
})

describe('ActivationCTAs — the checklist is the slot until the first payment', () => {
    it.each([
        ['new user', NEW_USER],
        ['ID check in review (no longer an empty slot)', IN_REVIEW],
        ['verified, $0', VERIFIED],
        ['verified and funded', FUNDED],
    ])('%s renders the checklist, never a big step card', (_label, onboarding) => {
        render(<ActivationCTAs onboarding={onboarding} />)
        expect(screen.getByText('getting-started-checklist')).toBeInTheDocument()
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('three rows done (no card, no QR) with a rejected bank rail still shows the rejection card', () => {
        mockRails = [bankRejected]
        render(<ActivationCTAs onboarding={{ ...FUNDED, firstPaymentRoute: 'none', step: 'completed' }} />)
        expect(screen.getByText('Complete setup')).toBeInTheDocument()
    })

    it('first payment done without rejection renders nothing', () => {
        const { container } = render(<ActivationCTAs onboarding={COMPLETED} />)
        expect(container.firstChild).toBeNull()
    })
})

describe('ActivationCTAs — activation_step_viewed reports each step once', () => {
    it('fires once per step per session, with the new step names', () => {
        const posthog = jest.requireMock('posthog-js').default as { capture: jest.Mock }
        sessionStorage.clear()
        const { rerender } = render(<ActivationCTAs onboarding={NEW_USER} />)
        rerender(<ActivationCTAs onboarding={NEW_USER} />)
        render(<ActivationCTAs onboarding={NEW_USER} />)
        rerender(<ActivationCTAs onboarding={VERIFIED} />)
        const steps = posthog.capture.mock.calls
            .filter(([event]) => event === 'activation_step_viewed')
            .map(([, props]) => props.step)
        expect(steps).toEqual(['verify', 'add_money'])
    })
})

describe('ActivationCTAs — a restart-eligible block starts a fresh ID check, not support', () => {
    // The Brazilian this exists for: their pool-tier PIX_BR row is published
    // `blocked` with `selfHealKind: 'restart-identity'` because the document on
    // file carries no CPF. The restart endpoint admits them, but the Home CTA
    // read "no longer enabled" as terminal and opened Crisp — so the main CTA
    // contradicted the remediation.
    const restartBlockedPix = {
        id: 'manteca.pix_br',
        provider: 'manteca',
        channel: 'qr-only',
        status: 'blocked',
        reason: { userMessage: 'We could not resolve a tax ID from your document.' },
        resolved: {
            status: 'blocked' as const,
            blocking: {
                code: 'tax_id_unresolved',
                userMessage: 'We could not resolve a tax ID from your document.',
                selfHealable: false,
                selfHealKind: 'restart-identity' as const,
            },
        },
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockRegionRestricted = false
        mockResidenceRestrictions = { banking: false, card: false }
        mockHasCardAccess = false
        mockUser = { user: { userId: 'user-1' } }
        mockRails = [restartBlockedPix]
    })

    it('offers the restart copy instead of "Verification issue"', () => {
        render(<ActivationCTAs onboarding={VERIFIED} />)

        // Title and CTA share the string, as they do on the Accounts page.
        expect(screen.getByRole('button', { name: 'Verify with a different document' })).toBeInTheDocument()
        // ...and the description is the localized reason for THIS code, which
        // already tells the user QR still works — the point of the whole change.
        expect(
            screen.getByText(
                "We couldn't read the tax ID that local deposits and withdrawals need. You can verify again to provide it. QR payments aren't affected."
            )
        ).toBeInTheDocument()
        expect(screen.queryByText('Verification issue')).not.toBeInTheDocument()
        expect(screen.queryByText('Contact support')).not.toBeInTheDocument()
    })

    it('starts the identity restart on click, and never opens support', () => {
        render(<ActivationCTAs onboarding={VERIFIED} />)
        fireEvent.click(screen.getByRole('button', { name: 'Verify with a different document' }))

        expect(mockRestartIdentity).toHaveBeenCalled()
        expect(mockOpenSupport).not.toHaveBeenCalled()
    })

    it('a terminal block still goes to support — restart cannot lift it', () => {
        // The discriminator is `selfHealKind`, not merely being blocked. Sending a
        // terminal rejection into a fresh ID check burns the user's Sumsub
        // attempts on something re-verifying can never fix.
        mockRails = [
            {
                ...restartBlockedPix,
                resolved: {
                    status: 'blocked' as const,
                    blocking: {
                        code: 'terminal_rejection',
                        userMessage: 'Your verification was declined.',
                        selfHealable: false,
                        selfHealKind: 'document-resubmit' as const,
                    },
                },
            },
        ]
        render(<ActivationCTAs onboarding={VERIFIED} />)
        fireEvent.click(screen.getByRole('button', { name: 'Contact support' }))

        expect(mockOpenSupport).toHaveBeenCalled()
        expect(mockRestartIdentity).not.toHaveBeenCalled()
    })
})

describe('ActivationCTAs — a blocked card can be hidden', () => {
    const posthog = () => jest.requireMock('posthog-js').default as { capture: jest.Mock }

    it('the region card hides with its kind and reason in the key and the event', () => {
        mockRegionRestricted = true
        const onHide = jest.fn()
        render(<ActivationCTAs onboarding={NEW_USER} onHideBlockedCard={onHide} />)
        fireEvent.click(screen.getByText('Hide'))
        expect(onHide).toHaveBeenCalledWith('blocked-card:region-restricted:identity_region_restricted')
        expect(posthog().capture).toHaveBeenCalledWith('home_blocked_card_hidden', {
            card_kind: 'region-restricted',
            reason_code: 'identity_region_restricted',
        })
    })

    it('the verification-issue card hides under its rail reason code', () => {
        mockRails = [
            {
                id: 'bridge.ach_us',
                provider: 'bridge',
                channel: 'bank',
                status: 'blocked',
                reason: { userMessage: 'declined', code: 'provider_rejected' },
            },
        ]
        const onHide = jest.fn()
        render(<ActivationCTAs onboarding={VERIFIED} onHideBlockedCard={onHide} />)
        expect(screen.getByText('Verification issue')).toBeInTheDocument()
        fireEvent.click(screen.getByText('Hide'))
        expect(onHide).toHaveBeenCalledWith('blocked-card:verification-issue:provider_rejected')
    })

    it('the checklist itself shows no blocked-card Hide', () => {
        render(<ActivationCTAs onboarding={NEW_USER} onHideBlockedCard={jest.fn()} />)
        expect(screen.queryByText('Hide')).not.toBeInTheDocument()
    })
})
