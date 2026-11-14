import React from 'react'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { PaperworkVerificationTrackingProvider } from '@/features/paperwork-verification/analytics'
import { AdditionalVerificationView } from '../AdditionalVerificationView'
import { BridgeTermsCard } from '../BridgeTermsCard'
import { BridgeTosStep } from '../BridgeTosStep'
import { DocumentRequestState } from '../DocumentRequestState'
import { InitiateKycModal } from '../InitiateKycModal'
import { KycStatusDrawer } from '../KycStatusDrawer'
import { KycStatusItem } from '../KycStatusItem'
import { KycVerificationInProgressModal } from '../KycVerificationInProgressModal'
import { KycReverificationPendingModal } from '../KycReverificationPendingModal'
import { KycRestartCooldownModal } from '../KycRestartCooldownModal'
import ProvideEmailStep from '../ProvideEmailStep'
import { SumsubHelpModal } from '../SumsubHelpModal'
import { SumsubSdkErrorView } from '../SumsubSdkErrorView'
import { SumsubWebSdkModal } from '../SumsubWebSdkModal'
import { KycActionRequiredModal } from '../modals/KycActionRequiredModal'
import { KycFailedModal } from '../modals/KycFailedModal'
import { KycProcessingModal } from '../modals/KycProcessingModal'
import { KycRegionRestrictedModal } from '../modals/KycRegionRestrictedModal'
import ApplicationStatusScreen from '@/components/Card/ApplicationStatusScreen'
import type { UseIdentityVerificationResult } from '@/hooks/useIdentityVerification'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn(), setPersonProperties: jest.fn() } }))
jest.mock('@/utils/capacitor', () => ({ openExternalUrl: jest.fn() }))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({ children, onClick, disabled, ...rest }: React.ComponentProps<'button'>) => (
        <button onClick={onClick} disabled={disabled} data-testid={rest['data-testid' as keyof typeof rest]}>
            {children}
        </button>
    ),
}))
jest.mock('@/components/0_Bruddle/LinkButton', () => ({
    LinkButton: ({ children, href, onClick }: { children?: React.ReactNode; href?: string; onClick?: () => void }) =>
        href ? (
            <a
                href={href}
                onClick={(event) => {
                    event.preventDefault()
                    onClick?.()
                }}
            >
                {children}
            </a>
        ) : (
            <button onClick={onClick}>{children}</button>
        ),
}))
jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: ({
        visible,
        content,
        ctas = [],
        tertiaryCta,
        footer,
        onClose,
    }: {
        visible: boolean
        content?: React.ReactNode
        footer?: React.ReactNode
        onClose: () => void
        ctas?: Array<{ text: string; onClick: () => void; disabled?: boolean }>
        tertiaryCta?: { text: string; onClick: () => void }
    }) =>
        visible ? (
            <div>
                <button onClick={onClose}>modal-dismiss</button>
                {content}
                {ctas.map((cta, index) => (
                    <button key={index} disabled={cta.disabled} onClick={cta.onClick}>
                        {cta.text}
                    </button>
                ))}
                {tertiaryCta && <button onClick={tertiaryCta.onClick}>{tertiaryCta.text}</button>}
                {footer}
            </div>
        ) : null,
}))
jest.mock('@/components/Global/Drawer', () => ({
    Drawer: ({
        open,
        onOpenChange,
        children,
    }: {
        open: boolean
        onOpenChange: (open: boolean) => void
        children: React.ReactNode
    }) =>
        open ? (
            <div>
                <button onClick={() => onOpenChange(false)}>drawer-dismiss</button>
                {children}
            </div>
        ) : null,
    DrawerContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DrawerHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DrawerTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DrawerDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: ({ onPrev }: { onPrev?: () => void }) => (onPrev ? <button onClick={onPrev}>Back</button> : null),
}))
jest.mock('@/components/Global/DocsLink', () => ({
    __esModule: true,
    default: ({ children, onOpen }: { children: React.ReactNode; onOpen?: () => void }) => (
        <a role="button" tabIndex={0} onClick={onOpen}>
            {children}
        </a>
    ),
}))
jest.mock('@/components/Global/Modal', () => ({
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
        visible ? <div>{children}</div> : null,
}))
jest.mock('@/components/Global/VerificationFrameHeader', () => ({
    __esModule: true,
    default: ({ onSupport, onClose }: { onSupport: () => void; onClose: () => void }) => (
        <>
            <button onClick={onSupport}>frame-help</button>
            <button onClick={onClose}>frame-close</button>
        </>
    ),
}))
jest.mock('../useSumsubWebSdk', () => ({
    useSumsubWebSdk: () => ({ sdkLoadError: false, setSdkContainer: jest.fn(), hasSubmittedRef: { current: false } }),
}))
jest.mock('@/components/Global/IframeWrapper', () => ({
    __esModule: true,
    default: ({ visible, onClose }: { visible: boolean; onClose: () => void }) =>
        visible ? <button onClick={() => onClose()}>iframe-close</button> : null,
}))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => null }))
jest.mock('../KYCStatusDrawerItem', () => ({ KYCStatusDrawerItem: () => null }))
jest.mock('../KYCStatusIcon', () => ({ KYCStatusIcon: () => null }))
jest.mock('@/components/0_Bruddle/ListItem', () => ({
    ListItem: ({ title, onClick }: { title: string; onClick: () => void }) => (
        <button onClick={onClick}>{title}</button>
    ),
}))
jest.mock('../RejectLabelsList', () => ({ RejectLabelsList: () => null }))
jest.mock('../SumsubKycModals', () => ({ SumsubKycModals: () => null }))
jest.mock('@/features/paperwork-verification/components/IdentityCheckIntroScreen', () => ({
    IdentityCheckIntroScreen: () => null,
}))
jest.mock('@/features/paperwork-verification/usePaperworkVerificationRedirect', () => ({
    usePaperworkVerificationRedirect: () => false,
}))
jest.mock('@/hooks/useBridgeProviderId', () => ({ useBridgeProviderId: () => 'bridge' }))
let mockDegraded = false
jest.mock('@/hooks/useKycDegraded', () => ({ useKycDegraded: () => mockDegraded }))
jest.mock('@/hooks/useResidenceRestrictions', () => ({ useResidenceRestrictions: () => ({ banking: false }) }))
const mockRouter = { push: jest.fn(), replace: jest.fn() }
jest.mock('next/navigation', () => ({
    useRouter: () => mockRouter,
    usePathname: () => '/profile/accounts/additional',
}))
// the hosted check's page reads where to go back to; opened here with nowhere named
jest.mock('nuqs', () => ({ useQueryState: () => [null, jest.fn()] }))
const mockBack = jest.fn()
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => mockBack, useReturnTo: () => mockBack }))
const mockStart = jest.fn()
jest.mock('@/hooks/useHostedVerification', () => ({
    useHostedVerification: () => ({ start: mockStart, isStarting: false, isSettling: false }),
}))
let mockHostedPending = true
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({
        capabilities: { features: {} },
        nextActions: mockHostedPending ? [{ key: 'bridge-hosted', kind: 'bridge-hosted' }] : [],
        isLoading: false,
    }),
}))
jest.mock('@/utils/bridge-tasks.utils', () => ({
    selectBridgeTasks: (actions: unknown[]) => actions,
    selectRouteHostedTask: () => undefined,
    hasNativeBridgeStep: () => false,
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: { user: { userId: 'private-user', email: 'saved-private@example.com' } },
        fetchUser: jest.fn(),
        logoutUser: jest.fn(),
    }),
}))
const mockTosLink = { data: { tosLink: 'https://private-provider.example/secret-token' } }
const mockGetTosLink = jest.fn()
jest.mock('@/app/actions/users', () => ({
    updateUserById: jest.fn().mockResolvedValue({}),
    getBridgeTosLink: (...args: unknown[]) => mockGetTosLink(...args),
}))
jest.mock('@/app/actions/kyc-workflow', () => ({ isPaperworkVerificationIdentity: jest.fn().mockResolvedValue(false) }))
const mockSupport = jest.fn()
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: mockSupport, openSupportWithMessage: mockSupport }),
    useModalsContextOptional: () => undefined,
}))
let mockIdentity: Partial<UseIdentityVerificationResult>
jest.mock('@/hooks/useIdentityVerification', () => ({ useIdentityVerification: () => mockIdentity }))
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => ({
        handleInitiateKyc: jest.fn().mockResolvedValue(undefined),
        handleRestartIdentity: jest.fn().mockResolvedValue(undefined),
        isLoading: false,
    }),
    resolveBridgeTosClose: jest.fn(),
}))

const capture = posthog.capture as jest.Mock
const controls = () =>
    capture.mock.calls.filter(([event]) => event === ANALYTICS_EVENTS.CONTROL_USED).map(([, props]) => props)
const expectControls = (expected: Array<[string, string]>, flow?: string) => {
    expect(
        controls().map(({ control, action, value }) => [control, action, ...(value === undefined ? [] : [value])])
    ).toEqual(expected)
    if (flow) expect(controls().every((props) => props.flow === flow)).toBe(true)
}
const tap = (label: string | RegExp) => fireEvent.click(screen.getByRole('button', { name: label }))
const close = jest.fn()

beforeEach(() => {
    jest.clearAllMocks()
    mockGetTosLink.mockResolvedValue(mockTosLink)
    mockDegraded = false
    mockHostedPending = true
    mockIdentity = {
        status: 'action_required',
        identity: { status: 'action_required' },
        isRegionRestricted: false,
        isTerminalFailure: false,
        isEmailCollision: false,
    }
})
afterEach(() => {
    const payload = JSON.stringify(capture.mock.calls)
    for (const secret of [
        'typed-private@example.com',
        'saved-private@example.com',
        'private-user',
        'secret-token',
        'private-provider',
        'private typed reason',
    ])
        expect(payload).not.toContain(secret)
})

it('records provider document continue/support without provider prose', () => {
    renderWithIntl(
        <DocumentRequestState reason="private typed reason" ctaLabel="Upload" onCta={close} onContactSupport={close} />
    )
    tap('Upload')
    tap('Contact support')
    expectControls(
        [
            ['continue', 'tap'],
            ['support', 'tap'],
        ],
        'kyc_provider_request'
    )
})

it('uses the paperwork context for shared provider request controls', () => {
    renderWithIntl(
        <PaperworkVerificationTrackingProvider
            value={{ flow: 'add_later', residence: 'AR', feature: 'card', step: 'tax' }}
        >
            <DocumentRequestState ctaLabel="Upload" onCta={close} />
        </PaperworkVerificationTrackingProvider>
    )
    tap('Upload')
    expect(controls()).toEqual([
        expect.objectContaining({
            flow: 'add_later',
            residence: 'AR',
            feature: 'card',
            step: 'tax',
            screen_id: 'provider-request',
            control: 'continue',
            action: 'tap',
        }),
    ])
})

it('records AdditionalVerificationView back/start/privacy help and its completed-screen CTA', () => {
    const view = renderWithIntl(<AdditionalVerificationView />)
    tap('Back')
    tap(/i have these, start/i)
    tap(/doesn.t store/i)
    mockHostedPending = false
    view.rerender(<AdditionalVerificationView />)
    tap('See status')
    expectControls(
        [
            ['back', 'tap'],
            ['continue', 'tap'],
            ['privacy_help', 'tap'],
            ['done', 'tap'],
        ],
        'kyc_provider_request'
    )
    expect(controls().every((props) => props.screen_id === 'hosted-check')).toBe(true)
})

it('records bridge terms links and the provider help open, legal links and dismissal', () => {
    renderWithIntl(<BridgeTermsCard providerId="bridge-row" />)
    fireEvent.click(screen.getByRole('link', { name: 'Bridge user terms' }))
    tap('About Bridge')
    tap('View terms')
    tap('View privacy policy')
    tap('Got it')
    expectControls(
        [
            ['terms', 'tap'],
            ['provider_help', 'open'],
            ['provider_terms', 'tap'],
            ['provider_privacy', 'tap'],
            ['provider_help', 'dismiss'],
        ],
        'kyc_legacy'
    )
})

it('keeps the existing ToS-open event and records Continue and the exits beside it', async () => {
    const view = renderWithIntl(<BridgeTosStep visible onComplete={close} onSkip={close} />)
    tap('Not now')
    tap('modal-dismiss')
    await act(async () => tap('Continue'))
    tap('iframe-close')
    expectControls(
        [
            ['not_now', 'tap'],
            ['tos', 'dismiss'],
            ['continue', 'tap'],
            ['tos_page', 'dismiss'],
        ],
        'kyc_legacy'
    )
    expect(capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.KYC_TOS_OPENED)
    view.unmount()
})

it('records a ToS Continue that failed to load, and the retry after it', async () => {
    mockGetTosLink.mockResolvedValueOnce({ error: 'private typed reason' })
    renderWithIntl(<BridgeTosStep visible onComplete={close} onSkip={close} />)
    await act(async () => tap('Continue'))
    await act(async () => tap('Try again'))
    expectControls(
        [
            ['continue', 'tap'],
            ['retry', 'tap'],
        ],
        'kyc_legacy'
    )
})

it('records an email edit once per mount, save and exits without any email payload', async () => {
    renderWithIntl(<ProvideEmailStep visible onComplete={close} onSkip={close} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'typed-private@example.com' } })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'typed-private@example.com ' } })
    await act(async () => tap(/save/i))
    tap('Not now')
    tap('modal-dismiss')
    expectControls(
        [
            ['email', 'change'],
            ['save', 'tap'],
            ['not_now', 'tap'],
            ['provide_email', 'dismiss'],
        ],
        'kyc_provider_request'
    )
})

it('records initiate recovery/back/dismiss, with shared provider CTA counted once', () => {
    const view = renderWithIntl(
        <InitiateKycModal visible variant="restart_identity" onClose={close} onVerify={close} />
    )
    tap('Verify with a different document')
    tap('drawer-dismiss')
    view.rerender(
        <InitiateKycModal
            visible
            variant="blocked"
            presentation="page"
            onBack={close}
            onClose={close}
            onVerify={close}
        />
    )
    tap('Back')
    tap('Contact support')
    view.rerender(
        <InitiateKycModal
            visible
            variant="provider_rejection"
            presentation="page"
            onBack={close}
            onClose={close}
            onVerify={close}
        />
    )
    tap(/upload/i)
    expectControls([
        ['restart_identity', 'tap'],
        ['initiate_kyc', 'dismiss'],
        ['back', 'tap'],
        ['support', 'tap'],
        ['continue', 'tap'],
    ])
    expect(controls().map((props) => [props.flow, props.screen_id])).toEqual([
        ['kyc_legacy', 'initiate-kyc'],
        ['kyc_legacy', 'initiate-kyc'],
        ['kyc_legacy', 'initiate-kyc'],
        ['kyc_legacy', 'initiate-kyc'],
        ['kyc_provider_request', 'provider-request'],
    ])
})

it('names the initiate CTA by what it does, with the privacy help beside it', () => {
    const view = renderWithIntl(
        <InitiateKycModal
            visible
            onClose={close}
            onVerify={close}
            onContactSupport={close}
            error="private typed reason"
        />
    )
    tap('Contact support')
    tap(/doesn.t store/i)
    // A supplement in review keeps its Got it even when the start errored.
    view.rerender(
        <InitiateKycModal
            visible
            reasonCode="requirements_in_review"
            onClose={close}
            onVerify={close}
            onContactSupport={close}
            error="private typed reason"
        />
    )
    tap('Got it')
    expectControls(
        [
            ['support', 'tap'],
            ['privacy_help', 'tap'],
            ['got_it', 'tap'],
        ],
        'kyc_legacy'
    )
})

it('records the region-restricted status Send from the status drawer', async () => {
    mockIdentity = { ...mockIdentity, status: 'failed', isRegionRestricted: true }
    renderWithIntl(<KycStatusDrawer isOpen onClose={close} />)
    fireEvent.click(await screen.findByRole('button', { name: /send/i }))
    expectControls([['send', 'tap']], 'kyc_status')
})

it('records status resume, support, logout, retry and drawer exits', async () => {
    const view = renderWithIntl(<KycStatusDrawer isOpen onClose={close} />)
    await screen.findByRole('button', { name: /re-submit verification/i })
    await act(async () => tap(/re-submit verification/i))
    mockIdentity = { ...mockIdentity, isEmailCollision: true }
    view.rerender(<KycStatusDrawer isOpen onClose={close} />)
    tap('Contact support')
    tap('Log out')
    tap('drawer-dismiss')
    mockIdentity = { ...mockIdentity, status: 'failed', isEmailCollision: false }
    view.rerender(<KycStatusDrawer isOpen onClose={close} />)
    await act(async () => tap('Retry verification'))
    expectControls(
        [
            ['resubmit', 'tap'],
            ['support', 'tap'],
            ['log_out', 'tap'],
            ['kyc_status', 'dismiss'],
            ['retry', 'tap'],
        ],
        'kyc_status'
    )
})

it('records opening the identity status drawer from its history row', async () => {
    renderWithIntl(<KycStatusItem />)
    tap('Identity verification')
    await screen.findByRole('button', { name: /re-submit verification/i })
    expectControls([['kyc_status', 'open']], 'kyc_status')
})

it.each([
    ['verifying', 'Close and notify me', 'home', 'id-checking'],
    ['preparing', 'Go to Home', 'home', 'account-setup'],
    ['bridge_tos', 'Continue', 'continue', 'tos'],
    ['supplement', 'Add proof of address', 'continue', 'poa'],
    ['complete', 'Continue', 'continue', 'id-confirmed'],
] as const)('records progress modal %s primary control', (phase, label, control, screenId) => {
    renderWithIntl(
        <KycVerificationInProgressModal
            isOpen
            phase={phase}
            preparingTimedOut
            onClose={close}
            onAcceptTerms={close}
            onStartSupplement={close}
        />
    )
    tap(label)
    expect(controls()).toEqual([
        expect.objectContaining({ control, action: 'tap', flow: 'kyc_legacy', screen_id: screenId }),
    ])
})

it('records supplement not-now and dismissal', () => {
    renderWithIntl(<KycVerificationInProgressModal isOpen phase="supplement" onClose={close} />)
    tap('Do this later')
    tap('modal-dismiss')
    expectControls(
        [
            ['not_now', 'tap'],
            ['poa', 'dismiss'],
        ],
        'kyc_legacy'
    )
})

it('records provider pending home/support and close', () => {
    const view = renderWithIntl(<KycReverificationPendingModal isOpen onClose={close} />)
    tap('Go to Home')
    tap('modal-dismiss')
    view.rerender(<KycReverificationPendingModal isOpen onClose={close} onContactSupport={close} />)
    tap('Contact support')
    expectControls(
        [
            ['home', 'tap'],
            ['kyc_status', 'dismiss'],
            ['support', 'tap'],
        ],
        'kyc_status'
    )
})

it('records cooldown acknowledgement and dismissal', () => {
    renderWithIntl(<KycRestartCooldownModal cooldown={{}} onClose={close} />)
    tap("I'll try later")
    tap('modal-dismiss')
    expectControls(
        [
            ['got_it', 'tap'],
            ['cooldown', 'dismiss'],
        ],
        'kyc_status'
    )
})

it('records the waiting modal privacy help on the ID-checking screen', () => {
    renderWithIntl(<KycVerificationInProgressModal isOpen phase="verifying" onClose={close} />)
    tap(/doesn.t store/i)
    tap('modal-dismiss')
    expectControls(
        [
            ['privacy_help', 'tap'],
            ['verification', 'dismiss'],
        ],
        'kyc_legacy'
    )
    expect(controls().every((props) => props.screen_id === 'id-checking')).toBe(true)
})

it('records Sumsub help, stop confirmation, and SDK error controls', () => {
    const view = renderWithIntl(<SumsubHelpModal visible variant="trouble" onDismiss={close} onExit={close} />)
    tap(/chat with support/i)
    tap('Cancel')
    tap('modal-dismiss')
    view.rerender(<SumsubHelpModal visible variant="stop-verification" onDismiss={close} onExit={close} />)
    tap('Exit')
    tap('Continue')
    view.rerender(<SumsubSdkErrorView message="private typed reason" onClose={close} />)
    tap('Close')
    expectControls(
        [
            ['support', 'tap'],
            ['cancel', 'tap'],
            ['help', 'dismiss'],
            ['exit', 'tap'],
            ['continue', 'tap'],
            ['close', 'tap'],
        ],
        'kyc_legacy'
    )
})

it('records Sumsub web header help and close controls', () => {
    renderWithIntl(
        <SumsubWebSdkModal
            visible
            sessionKey="session"
            accessToken="secret-token"
            onClose={close}
            onComplete={close}
            onRefreshToken={async () => 'secret-token'}
        />
    )
    tap('frame-help')
    tap('Cancel')
    tap('frame-close')
    expectControls(
        [
            ['help', 'open'],
            ['cancel', 'tap'],
            ['close', 'tap'],
        ],
        'kyc_legacy'
    )
})

it('records action-required continue and dismissal', () => {
    renderWithIntl(<KycActionRequiredModal visible onClose={close} onResubmit={close} />)
    tap('Continue')
    tap('drawer-dismiss')
    expectControls(
        [
            ['continue', 'tap'],
            ['kyc_status', 'dismiss'],
        ],
        'kyc_status'
    )
})

it('records failed retry/support and dismissal', () => {
    const view = renderWithIntl(<KycFailedModal visible onClose={close} onRetry={close} />)
    tap('Try again')
    tap('drawer-dismiss')
    view.rerender(<KycFailedModal visible onClose={close} onRetry={close} isTerminal />)
    tap('Contact support')
    expectControls(
        [
            ['retry', 'tap'],
            ['kyc_status', 'dismiss'],
            ['support', 'tap'],
        ],
        'kyc_status'
    )
})

it('records processing got-it, stale resume/support, and dismissal', () => {
    const view = renderWithIntl(<KycProcessingModal visible onClose={close} />)
    tap('Got it')
    tap('drawer-dismiss')
    view.rerender(
        <KycProcessingModal
            visible
            onClose={close}
            onResume={close}
            onContactSupport={close}
            pendingSince="2020-01-01"
        />
    )
    tap('Continue verification')
    tap('Contact support')
    expectControls(
        [
            ['got_it', 'tap'],
            ['kyc_status', 'dismiss'],
            ['continue', 'tap'],
            ['support', 'tap'],
        ],
        'kyc_status'
    )
})

it('records restricted-region available action and dismissal', () => {
    renderWithIntl(<KycRegionRestrictedModal visible onClose={close} />)
    tap(/send/i)
    tap('drawer-dismiss')
    expectControls(
        [
            ['send', 'tap'],
            ['kyc_status', 'dismiss'],
        ],
        'kyc_status'
    )
})

it('records Rain information continue/support/back, policy and residence controls', () => {
    const view = renderWithIntl(
        <ApplicationStatusScreen
            variant="requires-info"
            reasonMessage="private typed reason"
            informationActions={[{ key: 'private-action', kind: 'taxId', label: 'Tax ID', onClick: close }]}
            onContactSupport={close}
            onPrev={close}
        />
    )
    tap('Tax ID')
    tap('Contact support')
    tap('Back')
    expectControls(
        [
            ['tax_id', 'tap'],
            ['support', 'tap'],
            ['back', 'tap'],
        ],
        'kyc_provider_request'
    )
    expect(controls().every((props) => props.screen_id === 'provider-request')).toBe(true)
    capture.mockClear()
    view.rerender(<ApplicationStatusScreen variant="geo-blocked" />)
    fireEvent.click(screen.getByRole('link'))
    view.rerender(<ApplicationStatusScreen variant="pending-residence-blocked" />)
    fireEvent.click(screen.getByRole('link'))
    expectControls(
        [
            ['policy', 'tap'],
            ['change_residence', 'tap'],
        ],
        'kyc_status'
    )
    expect(controls().every((props) => props.screen_id === 'card-status')).toBe(true)
    cleanup()
})

it.each(['pending', 'pending-identity', 'manual-review', 'requires-support', 'rejected'] as const)(
    'records the %s card status as a status screen, not a provider request',
    (variant) => {
        renderWithIntl(<ApplicationStatusScreen variant={variant} onContactSupport={close} onPrev={close} />)
        tap('Back')
        expect(controls()).toEqual([
            expect.objectContaining({ flow: 'kyc_status', screen_id: 'card-status', control: 'back', action: 'tap' }),
        ])
    }
)

it('records the outage Notify me beside its notify event', () => {
    mockDegraded = true
    renderWithIntl(<InitiateKycModal visible onClose={close} onVerify={close} />)
    tap(/notify me/i)
    tap('Got it')
    expectControls(
        [
            ['notify_me', 'tap'],
            ['got_it', 'tap'],
        ],
        'kyc_legacy'
    )
    expect(controls().every((props) => props.screen_id === 'outage')).toBe(true)
    expect(capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.KYC_DEGRADED_NOTIFY_REQUESTED)
})
