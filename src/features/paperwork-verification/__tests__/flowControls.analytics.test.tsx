import { fireEvent, screen } from '@testing-library/react'
import posthog from 'posthog-js'
import { renderWithIntl } from '@/test-utils/intl'
import { KycControlScreenProvider, PaperworkVerificationTrackingProvider } from '../analytics'
import { StepsScreen } from '../components/StepsScreen'
import { SavedScreen, ReviewScreen, FeatureReadyScreen, ProofOfAddressScreen } from '../components/StatusScreens'
import { LoadFailed, VerificationOutage, VerifyLoading } from '../components/LoadScreens'
import { IdentityCheckIntroScreen } from '../components/IdentityCheckIntroScreen'
import { VerifyHeroLayout, VerifyQuestionLayout } from '../components/VerifyLayout'
import { KycFeatureActivationStatus } from '../KycFeatureActivationStatus'
import { FeatureAction } from '../FeatureAction'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn(), setPersonProperties: jest.fn() } }))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))
jest.mock('@/utils/confetti', () => ({ confettiPresets: { success: jest.fn() } }))
jest.mock('@/components/Provider/ProviderRow', () => ({
    ProviderRow: ({
        onOpenChange,
        onDocumentClick,
    }: {
        onOpenChange: (open: boolean) => void
        onDocumentClick: (document: 'terms' | 'privacy') => void
    }) => (
        <>
            <button onClick={() => onOpenChange(true)}>provider-open</button>
            <button onClick={() => onOpenChange(false)}>provider-close</button>
            <button onClick={() => onDocumentClick('terms')}>provider-terms</button>
            <button onClick={() => onDocumentClick('privacy')}>provider-privacy</button>
        </>
    ),
}))
const mockBack = jest.fn()
jest.mock('@/hooks/useBackHandler', () => ({
    useBackHandler: (handler: () => boolean) => {
        mockBack.mockImplementation(handler)
    },
}))
const flowContext = { flow: 'paperwork_verification' as const, residence: 'PT' }
const inFlow = (ui: React.ReactElement) => (
    <PaperworkVerificationTrackingProvider value={flowContext}>{ui}</PaperworkVerificationTrackingProvider>
)
const mockStart = jest.fn()
const mockClose = jest.fn()
jest.mock('@/hooks/useSumsubKycFlow', () => ({
    useSumsubKycFlow: () => ({
        handleStartAction: mockStart,
        handleClose: mockClose,
        showWrapper: true,
        isLoading: false,
        error: 'private-error-text',
    }),
}))
jest.mock('@/components/Kyc/SumsubKycWrapper', () => ({
    SumsubKycWrapper: function MockSumsubWrapper({ onClose }: { onClose: () => void }) {
        const { useKycControl } = jest.requireActual('../analytics')
        const controls = useKycControl('id-check', 'kyc_legacy')
        return (
            <>
                <button onClick={onClose}>sdk-close</button>
                <button
                    onClick={() => {
                        controls.track('exit', 'tap')
                        onClose()
                    }}
                >
                    sdk-exit
                </button>
            </>
        )
    },
}))

const capture = jest.mocked(posthog.capture)
const controls = () =>
    capture.mock.calls.filter(([event]) => event === 'control_used').map(([, properties]) => properties)
const expectControls = (screenId: string, expected: [string, string, string?][]) => {
    expect(controls()).toEqual(
        expected.map(([control, action, value]) =>
            expect.objectContaining({ screen_id: screenId, control, action, ...(value === undefined ? {} : { value }) })
        )
    )
}
beforeEach(() => jest.clearAllMocks())
afterEach(() => {
    expect(JSON.stringify(capture.mock.calls)).not.toContain('private-error-text')
    expect(JSON.stringify(capture.mock.calls)).not.toContain('private-country-name')
})

it.each([
    ['intro', 'steps-overview', 'verify-steps-continue', 'continue'],
    ['review', 'id-checking', 'verify-review-home', 'home'],
    ['verified', 'id-confirmed', 'verify-verified-payments', 'set_up_payments'],
] as const)('tracks %s timeline buttons once each with the provider context', (phase, id, testId, control) => {
    renderWithIntl(
        <PaperworkVerificationTrackingProvider
            value={{ flow: 'paperwork_verification', residence: 'PT', restart: true }}
        >
            <StepsScreen phase={phase} onBack={jest.fn()} onContinue={jest.fn()} />
        </PaperworkVerificationTrackingProvider>
    )
    fireEvent.click(screen.getByTestId('verify-back'))
    fireEvent.click(screen.getByTestId(testId))
    expectControls(id, [
        ['back', 'tap'],
        [control, 'tap'],
    ])
    expect(controls()).toEqual(
        expect.arrayContaining([
            expect.objectContaining({ flow: 'paperwork_verification', residence: 'PT', restart: true }),
        ])
    )
})

it('tracks the loading overview Back and keeps its disabled continue silent', () => {
    renderWithIntl(inFlow(<VerifyLoading onBack={jest.fn()} />))
    fireEvent.click(screen.getByTestId('verify-back'))
    fireEvent.click(screen.getByTestId('verify-steps-continue'))
    expectControls('steps-overview', [['back', 'tap']])
})

it.each(['hero', 'question'] as const)('tracks the %s layout chrome with its screen id', (layout) => {
    renderWithIntl(
        layout === 'hero' ? (
            <VerifyHeroLayout
                screenId="feature-status"
                pose="thinking"
                title="Title"
                onBack={jest.fn()}
                footer={null}
            />
        ) : (
            <KycControlScreenProvider value="address+phone">
                <VerifyQuestionLayout onBack={jest.fn()} footer={null}>
                    Question
                </VerifyQuestionLayout>
            </KycControlScreenProvider>
        )
    )
    fireEvent.click(screen.getByTestId('verify-back'))
    expectControls(layout === 'hero' ? 'feature-status' : 'address+phone', [['back', 'tap']])
    expect(controls()[0]).toMatchObject({ flow: 'kyc_status' })
})

it('tracks saved answers Continue', () => {
    renderWithIntl(inFlow(<SavedScreen onContinue={jest.fn()} />))
    fireEvent.click(screen.getByTestId('verify-saved-continue'))
    expectControls('answers-saved', [['continue', 'tap']])
})

it('tracks failed review retry and Home without capturing error text', () => {
    renderWithIntl(inFlow(<ReviewScreen onHome={jest.fn()} onRetry={jest.fn()} error="private-error-text" />))
    fireEvent.click(screen.getByTestId('verify-review-retry'))
    fireEvent.click(screen.getByTestId('verify-review-home'))
    expectControls('id-failed', [
        ['retry', 'tap'],
        ['home', 'tap'],
    ])
})

it('tracks the add-feature ready action', () => {
    renderWithIntl(<FeatureReadyScreen feature="card" onDone={jest.fn()} />)
    fireEvent.click(screen.getByTestId('verify-feature-done'))
    expectControls('feature-ready', [['done', 'tap']])
    expect(controls()[0]).toMatchObject({ flow: 'kyc_status' })
})

it('sends nothing from /verify-only screens rendered outside the flow', () => {
    renderWithIntl(<SavedScreen onContinue={jest.fn()} />)
    fireEvent.click(screen.getByTestId('verify-saved-continue'))
    expect(controls()).toEqual([])
})

it('tracks PoA upload and skip without its display country or error', () => {
    renderWithIntl(
        inFlow(
            <ProofOfAddressScreen
                residenceName="private-country-name"
                error="private-error-text"
                uploading={false}
                onUpload={jest.fn()}
                onSkip={jest.fn()}
            />
        )
    )
    fireEvent.click(screen.getByTestId('verify-poa-upload'))
    fireEvent.click(screen.getByTestId('verify-poa-skip'))
    expectControls('poa', [
        ['upload', 'tap'],
        ['skip', 'tap'],
    ])
})

it('tracks failed load retry and Home', () => {
    renderWithIntl(inFlow(<LoadFailed onHome={jest.fn()} onRetry={jest.fn()} />))
    screen.getAllByRole('button').forEach((button) => fireEvent.click(button))
    expectControls('load-failed', [
        ['retry', 'tap'],
        ['home', 'tap'],
    ])
})

it('tracks outage chrome and notify beside its existing outcome event', () => {
    renderWithIntl(<VerificationOutage onBack={jest.fn()} />)
    screen.getAllByRole('button').forEach((button) => fireEvent.click(button))
    expectControls('outage', [
        ['back', 'tap'],
        ['notify_me', 'tap'],
    ])
    expect(capture).toHaveBeenCalledWith('kyc_degraded_notify_requested')
})

it('tracks the legacy identity handoff and its provider sheet, not the hardware Back', () => {
    renderWithIntl(
        <IdentityCheckIntroScreen visible hasQuestions providerId="bridge" onBack={jest.fn()} onContinue={jest.fn()} />
    )
    fireEvent.click(screen.getByTestId('verify-back'))
    fireEvent.click(screen.getByTestId('verify-steps-continue'))
    fireEvent.click(screen.getByText('provider-open'))
    fireEvent.click(screen.getByText('provider-close'))
    fireEvent.click(screen.getByText('provider-terms'))
    fireEvent.click(screen.getByText('provider-privacy'))
    mockBack()
    expectControls('id-handoff', [
        ['back', 'tap'],
        ['continue', 'tap'],
        ['provider_help', 'open'],
        ['provider_help', 'dismiss'],
        ['provider_terms', 'tap'],
        ['provider_privacy', 'tap'],
    ])
    expect(controls().every((properties) => properties?.flow === 'kyc_legacy')).toBe(true)
})

it('tracks feature activation consent and Back', () => {
    renderWithIntl(
        <KycFeatureActivationStatus
            feature="bank"
            result={null}
            isLoading={false}
            onRetry={jest.fn()}
            onBack={jest.fn()}
        />
    )
    fireEvent.click(screen.getByTestId('verify-back'))
    fireEvent.click(screen.getByTestId('kyc-activation-continue'))
    expectControls('feature-status', [
        ['back', 'tap'],
        ['continue', 'tap'],
    ])
})

it('tracks feature activation retry after failure', () => {
    renderWithIntl(
        <KycFeatureActivationStatus
            feature="bank"
            result={{ kind: 'failed' }}
            isLoading={false}
            onRetry={jest.fn()}
            onBack={jest.fn()}
        />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expectControls('feature-status', [['retry', 'tap']])
})

it('tracks feature activation done after refusal', () => {
    renderWithIntl(
        <KycFeatureActivationStatus
            feature="bank"
            result={{ kind: 'conflict', code: 'feature_not_open' }}
            isLoading={false}
            onRetry={jest.fn()}
            onBack={jest.fn()}
        />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expectControls('feature-status', [['done', 'tap']])
})

it('tracks supplement retry and Back without duplicating SDK callbacks or exposing action/error text', () => {
    renderWithIntl(<FeatureAction action="supplement:private-error-text" onBack={jest.fn()} onDone={jest.fn()} />)
    expect(controls()).toEqual([])
    fireEvent.click(screen.getByTestId('verify-back'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.click(screen.getByText('sdk-close'))
    expectControls('provider-request', [
        ['back', 'tap'],
        ['continue', 'tap'],
    ])
    expect(mockClose).toHaveBeenCalledTimes(1)
})

it.each([
    ['bridge', 'poa'],
    ['manteca', 'manteca-rfi'],
    ['rain', 'provider-request'],
] as const)(
    'attributes %s supplement controls and its SDK shell to the provider request flow',
    (provider, screenId) => {
        const action = `supplement:${provider}`
        renderWithIntl(<FeatureAction action={action} onBack={jest.fn()} onDone={jest.fn()} />)
        fireEvent.click(screen.getByTestId('verify-back'))
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        fireEvent.click(screen.getByText('sdk-exit'))
        fireEvent.click(screen.getByText('sdk-close'))
        expect(controls()).toEqual([
            expect.objectContaining({
                flow: 'kyc_provider_request',
                screen_id: screenId,
                control: 'back',
                action: 'tap',
            }),
            expect.objectContaining({
                flow: 'kyc_provider_request',
                screen_id: screenId,
                control: 'continue',
                action: 'tap',
            }),
            expect.objectContaining({
                flow: 'kyc_provider_request',
                screen_id: 'id-check',
                control: 'exit',
                action: 'tap',
            }),
        ])
        expect(mockClose).toHaveBeenCalledTimes(2)
        expect(JSON.stringify(capture.mock.calls)).not.toContain(action)
    }
)

it('retains paperwork context over the supplement fallback for Back, Continue and SDK controls', () => {
    renderWithIntl(
        <PaperworkVerificationTrackingProvider value={{ flow: 'add_later', residence: 'AR', feature: 'local' }}>
            <FeatureAction action="supplement:manteca" onBack={jest.fn()} onDone={jest.fn()} />
        </PaperworkVerificationTrackingProvider>
    )
    fireEvent.click(screen.getByTestId('verify-back'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.click(screen.getByText('sdk-exit'))
    expect(controls()).toHaveLength(3)
    expect(
        controls().every(
            (properties) =>
                properties?.flow === 'add_later' && properties.residence === 'AR' && properties.feature === 'local'
        )
    ).toBe(true)
    expect(JSON.stringify(capture.mock.calls)).not.toContain('supplement:manteca')
})
