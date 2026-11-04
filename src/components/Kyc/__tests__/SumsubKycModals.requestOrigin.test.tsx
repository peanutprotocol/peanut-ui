jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import React from 'react'
import { act, fireEvent, screen } from '@testing-library/react'
import posthog from 'posthog-js'
import { renderWithIntl } from '@/test-utils/intl'
import { withFeatureReport } from '@/test-utils/featureReport.fixture'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { initiateSelfHealResubmission, initiateSumsubKyc, startKycAction } from '@/app/actions/sumsub'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { useDocumentRequestFlow } from '@/hooks/useDocumentRequestFlow'
import type { NextAction } from '@/types/capabilities'
import { SumsubKycModals } from '../SumsubKycModals'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn(), setPersonProperties: jest.fn() } }))
jest.mock('@/app/actions/kyc-workflow', () => ({
    getKycDocumentPlan: jest.fn(async () => ({ available: false, routes: [] })),
    findKycDocumentPlan: jest.fn(async () => ({ available: false, routes: [] })),
    getKycDocumentStatus: jest.fn(),
    resumeKycDocumentAttempt: jest.fn(),
    findKycReplacementPlan: jest.fn(async () => null),
}))
jest.mock('@/app/actions/sumsub', () => ({
    ...jest.requireActual('@/app/actions/sumsub'),
    initiateSumsubKyc: jest.fn(),
    getVerificationSession: jest.fn(),
    refreshVerificationSession: jest.fn(),
    initiateSelfHealResubmission: jest.fn(),
    restartIdentityVerification: jest.fn(),
    startResidenceChangeVerification: jest.fn(),
    startKycAction: jest.fn(),
}))
jest.mock('@/hooks/useWebSocket', () => ({ useWebSocket: () => undefined }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false, isAndroidNative: () => false }))
const mockFetchUser = jest.fn()
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ fetchUser: mockFetchUser, user: { user: { username: 'test' } } }),
}))
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ capabilities: undefined }) }))
jest.mock('@/hooks/useSumsubReloadResume', () => ({ useSumsubReloadResume: jest.fn() }))
jest.mock('@/hooks/useSubmissionWindow', () => ({ markSubmitted: jest.fn() }))
jest.mock('@/hooks/useBridgeProviderId', () => ({ useBridgeProviderId: () => 'bridge' }))
jest.mock('@/app/actions/users', () => ({ getBridgeTosLink: jest.fn(), confirmBridgeTos: jest.fn() }))
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }) }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/DocsLink', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Modal', () => ({
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
        visible ? <div>{children}</div> : null,
}))
jest.mock('@/components/Global/VerificationFrameHeader', () => ({
    __esModule: true,
    default: ({ onClose }: { onClose: () => void }) => <button onClick={onClose}>frame-close</button>,
}))
let mockSdk: { onComplete?: () => void } = {}
jest.mock('../useSumsubWebSdk', () => ({
    useSumsubWebSdk: (props: { onComplete?: () => void }) => {
        mockSdk = props
        return { sdkLoadError: false, setSdkContainer: jest.fn(), hasSubmittedRef: { current: false } }
    },
}))
jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: ({
        visible,
        ctas = [],
        tertiaryCta,
    }: {
        visible: boolean
        ctas?: Array<{ text: string; onClick: () => void }>
        tertiaryCta?: { text: string; onClick: () => void }
    }) =>
        visible ? (
            <div>
                {ctas.map((cta) => (
                    <button key={cta.text} onClick={cta.onClick}>
                        {cta.text}
                    </button>
                ))}
                {tertiaryCta && <button onClick={tertiaryCta.onClick}>{tertiaryCta.text}</button>}
            </div>
        ) : null,
}))

const parkedOnProofOfAddress = {
    capabilities: withFeatureReport(
        {
            rails: [
                {
                    id: 'bridge.sepa_eu',
                    provider: 'bridge',
                    channel: 'bank',
                    country: 'EU',
                    currency: 'EUR',
                    status: 'blocked',
                    reason: { code: 'requirements_missing', userMessage: 'x' },
                    blockingActions: ['supplement:bridge'],
                    resolved: {
                        status: 'fixable',
                        nextAction: { key: 'supplement:bridge', kind: 'sumsub', purpose: 'requirements_missing' },
                    },
                },
            ],
            nextActions: [{ key: 'supplement:bridge', kind: 'sumsub', purpose: 'requirements_missing' }],
            restrictions: [],
        } as never,
        { identity: { status: 'verified' } }
    ),
}

const capture = posthog.capture as jest.Mock
const controls = () =>
    capture.mock.calls
        .filter(([event]) => event === ANALYTICS_EVENTS.CONTROL_USED)
        .map(([, { flow, screen_id, control, action }]) => [flow, screen_id, `${control}:${action}`])
const tap = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const completeSdk = () =>
    act(async () => {
        mockSdk.onComplete?.()
    })

let flow: ReturnType<typeof useMultiPhaseKycFlow>
function FlowHarness() {
    flow = useMultiPhaseKycFlow({})
    return <SumsubKycModals flow={flow} />
}

beforeEach(() => {
    jest.clearAllMocks()
    mockSdk = {}
    mockFetchUser.mockResolvedValue(parkedOnProofOfAddress)
})
afterEach(() => {
    const payload = JSON.stringify(capture.mock.calls)
    for (const secret of ['private-token', 'private-action', 'private-requirement'])
        expect(payload).not.toContain(secret)
})

it('keeps a provider action the provider request through its SDK and the modal after it, until a legacy start', async () => {
    jest.mocked(startKycAction).mockResolvedValue({
        data: { token: 'private-token', levelName: 'provider-rfi-pep' },
    } as never)
    renderWithIntl(<FlowHarness />)

    await act(async () => {
        await flow.handleStartAction('sumsub:private-action')
    })
    tap('frame-close')
    tap('Continue')
    await completeSdk()
    // The action is done and the account asks for its proof of address next.
    tap('Do this later')

    expect(controls()).toEqual([
        ['kyc_provider_request', 'id-check', 'close:tap'],
        ['kyc_provider_request', 'id-check', 'continue:tap'],
        ['kyc_provider_request', 'poa', 'not_now:tap'],
    ])

    capture.mockClear()
    jest.mocked(initiateSumsubKyc).mockResolvedValue({
        data: { token: 'private-token', applicantId: 'applicant', status: 'PENDING' },
    } as never)
    await act(async () => {
        await flow.handleInitiateKyc('ROW')
    })
    tap('frame-close')
    expect(controls()).toEqual([['kyc_legacy', 'id-check', 'close:tap']])
})

it("labels a Home document request's SDK shell and progress modal as the provider request", async () => {
    jest.mocked(initiateSelfHealResubmission).mockResolvedValue({ data: { token: 'private-token' } } as never)
    function HomeHarness() {
        const request = useDocumentRequestFlow()
        return (
            <>
                <button
                    onClick={() =>
                        request.start({
                            key: 'bridge-requirement',
                            kind: 'sumsub',
                            purpose: 'requirements_missing',
                            requirementKey: 'private-requirement',
                        } as NextAction)
                    }
                >
                    Upload document
                </button>
                {request.modals}
            </>
        )
    }
    renderWithIntl(<HomeHarness />)

    await act(async () => tap('Upload document'))
    expect(initiateSelfHealResubmission).toHaveBeenCalledWith('BRIDGE', 'private-requirement')
    tap('frame-close')
    tap('Continue')
    await completeSdk()
    tap('Close and notify me')

    expect(controls()).toEqual([
        ['kyc_provider_request', 'id-check', 'close:tap'],
        ['kyc_provider_request', 'id-check', 'continue:tap'],
        ['kyc_provider_request', 'id-checking', 'home:tap'],
    ])
})
