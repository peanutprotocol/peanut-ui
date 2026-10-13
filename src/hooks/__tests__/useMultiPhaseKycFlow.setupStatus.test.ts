/**
 * Who gets the setup status after the identity check: a flow started on the
 * document list shows it in place of the phases, every other flow keeps the
 * phases. The status survives the SDK closing, a review, and the steps it
 * starts (the proof of address, the bank terms).
 */
jest.mock('@/app/actions/kyc-workflow', () => ({
    getKycDocumentPlan: jest.fn(),
    findKycDocumentPlan: jest.fn(),
    getKycDocumentStatus: jest.fn(async () => 'IN_REVIEW'),
    resumeKycDocumentAttempt: jest.fn(),
    startKycDocumentAttempt: jest.fn(),
    startKycDocumentReplacement: jest.fn(),
    saveKycFeatures: jest.fn(),
}))
import { act } from '@testing-library/react'
import posthog from 'posthog-js'
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import {
    findKycDocumentPlan,
    getKycDocumentStatus,
    saveKycFeatures,
    startKycDocumentAttempt,
} from '@/app/actions/kyc-workflow'
import { initiateSumsubKyc, startKycAction } from '@/app/actions/sumsub'
import { confirmBridgeTos } from '@/app/actions/users'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import type { UserCapabilities } from '@/types/capabilities'

const mockWs: { handler?: (status: string, labels?: string[]) => void } = {}
const mockFetchUser = jest.fn()
let mockUser: Record<string, unknown> = {}
let mockCapabilities: UserCapabilities | undefined

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
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
jest.mock('@/hooks/useWebSocket', () => ({
    useWebSocket: (opts: { onSumsubKycStatusUpdate?: (status: string, labels?: string[]) => void }) => {
        mockWs.handler = opts.onSumsubKycStatusUpdate
    },
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false, isAndroidNative: () => false }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ fetchUser: mockFetchUser, user: { user: { username: 'test' }, ...mockUser } }),
}))
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ capabilities: mockCapabilities }) }))
jest.mock('@/hooks/useSumsubReloadResume', () => ({ useSumsubReloadResume: jest.fn() }))
jest.mock('@/hooks/useSubmissionWindow', () => ({ markSubmitted: jest.fn() }))
jest.mock('@/app/actions/users', () => ({ getBridgeTosLink: jest.fn(), confirmBridgeTos: jest.fn() }))

const mockCapture = posthog.capture as jest.MockedFunction<typeof posthog.capture>
const captured = (event: string) => mockCapture.mock.calls.filter(([name]) => name === event)

const features = { qr: true, local: false, bank: true, card: false }
const plan = {
    available: true,
    activeAttemptId: null,
    policyVersion: 'v1',
    features,
    routes: [
        {
            id: 'shared',
            documents: [
                {
                    key: 'identity',
                    code: 'IDENTITY' as const,
                    types: ['PASSPORT'],
                    countries: ['BR'],
                    requiredBy: ['SUMSUB' as const],
                },
            ],
        },
    ],
}
const session = {
    attemptId: 'attempt-1',
    token: 'token-1',
    applicantId: 'applicant-1',
    levelName: 'shared',
    status: 'COLLECTING',
    sdkConfig: {
        documentDefinitions: { IDENTITY: { country: 'BRA', idDocType: 'PASSPORT' } },
        autoSelectDocumentDefinitions: true as const,
    },
}
const supplement = { key: 'supplement:bridge', kind: 'sumsub' as const, purpose: 'requirements_missing' }
const bridgeRail = (currency: string, method: string, country: string) => ({
    id: `bridge.${method.toLowerCase()}` as const,
    provider: 'bridge' as const,
    method,
    channel: 'bank' as const,
    country,
    currency,
})
const qrRail = {
    id: 'manteca.pix_br' as const,
    provider: 'manteca' as const,
    method: 'PIX_BR',
    channel: 'bank' as const,
    country: 'BR',
    currency: 'BRL',
    status: 'enabled' as const,
    operations: { pay: 'enabled' as const, deposit: 'pending' as const },
}
/** api#1816 after the approval: QR pays, the accounts wait for a proof of address. */
const parked: UserCapabilities = {
    rails: [
        qrRail,
        ...[bridgeRail('USD', 'ACH_US', 'US'), bridgeRail('EUR', 'SEPA_EU', 'EU')].map((rail) => ({
            ...rail,
            status: 'blocked' as const,
            reason: { code: 'requirements_missing', userMessage: '' },
            blockingActions: ['supplement:bridge'],
            resolved: {
                status: 'fixable' as const,
                blocking: {
                    code: 'requirements_missing',
                    userMessage: '',
                    selfHealable: true,
                    selfHealKind: 'document-resubmit' as const,
                },
                nextAction: supplement,
            },
        })),
    ],
    nextActions: [supplement],
    restrictions: [],
}
const tos = { key: 'accept-tos', kind: 'accept-tos' as const, purpose: 'accept-bridge-tos' }
const onTerms: UserCapabilities = {
    rails: [
        qrRail,
        ...[bridgeRail('USD', 'ACH_US', 'US'), bridgeRail('EUR', 'SEPA_EU', 'EU')].map((rail) => ({
            ...rail,
            status: 'requires-info' as const,
            reason: { code: 'bridge_tos_required', userMessage: '' },
            blockingActions: ['accept-tos'],
        })),
    ],
    nextActions: [tos],
    restrictions: [],
}
const verifiedUser = (capabilities: UserCapabilities) => ({
    identityVerification: { status: 'verified' },
    residence: { declared: 'BR', verified: 'BR' },
    capabilities,
})

/** Picks the documents on the list, submits in the SDK, and optionally gets the approval. */
const submitOnDocumentList = async (options: Parameters<typeof useMultiPhaseKycFlow>[0] = {}) => {
    const view = renderHook(() => useMultiPhaseKycFlow(options))
    await act(async () => {
        await view.result.current.handleInitiateKyc()
    })
    await act(async () => {
        await view.result.current.confirmDocumentPlan('shared', [
            { key: 'identity', type: 'PASSPORT', issuingCountry: 'BR' },
        ])
    })
    expect(view.result.current.showWrapper).toBe(true)
    act(() => view.result.current.handleSdkComplete())
    return view
}
const approve = async (view: Awaited<ReturnType<typeof submitOnDocumentList>>, capabilities: UserCapabilities) => {
    mockUser = verifiedUser(capabilities)
    mockCapabilities = capabilities
    mockFetchUser.mockResolvedValue({ ...mockUser })
    await act(async () => {
        mockWs.handler?.('APPROVED')
    })
}

beforeEach(() => {
    jest.clearAllMocks()
    mockUser = {}
    mockCapabilities = undefined
    mockFetchUser.mockResolvedValue(null)
    jest.mocked(findKycDocumentPlan).mockResolvedValue(plan)
    jest.mocked(startKycDocumentAttempt).mockResolvedValue(session)
    jest.mocked(getKycDocumentStatus).mockResolvedValue('IN_REVIEW')
    jest.mocked(startKycAction).mockResolvedValue({
        data: { token: 'poa-token', levelName: 'provider-rfi-proof-of-address' },
    })
})

describe('useMultiPhaseKycFlow — the setup status of a document-first flow', () => {
    it('shows every saved feature under review once the SDK closes, and stays while a reviewer looks', async () => {
        const view = await submitOnDocumentList()
        const { setupStatus } = view.result.current
        expect(setupStatus?.open).toBe(true)
        expect(setupStatus?.rows).toEqual([
            { key: 'qr', state: 'under-review' },
            { key: 'bank', state: 'under-review' },
        ])
        expect(view.result.current.modalPhase).toBe('verifying')

        await act(async () => {
            mockWs.handler?.('PENDING')
        })
        expect(view.result.current.setupStatus?.open).toBe(true)
    })

    it('after the approval it reads the rails instead of running the phases', async () => {
        const onKycSuccess = jest.fn()
        const onKycApproved = jest.fn()
        const view = await submitOnDocumentList({ onKycSuccess, onKycApproved })
        await approve(view, parked)

        expect(onKycApproved).toHaveBeenCalledTimes(1)
        expect(mockFetchUser).toHaveBeenCalled()
        expect(view.result.current.modalPhase).toBe('verifying')
        expect(view.result.current.setupStatus?.open).toBe(true)
        expect(view.result.current.setupStatus?.residence).toBe('BR')
        expect(view.result.current.setupStatus?.rows).toEqual([
            { key: 'qr', state: 'available' },
            {
                key: 'bank',
                state: 'document-needed',
                reason: 'requirements_missing',
                step: { provider: 'bridge', action: supplement, reasonCode: 'requirements_missing' },
            },
        ])
        expect(onKycSuccess).not.toHaveBeenCalled()
    })

    it('the bank row starts the proof of address, and the status comes back under review after it', async () => {
        const onKycSuccess = jest.fn()
        const view = await submitOnDocumentList({ onKycSuccess })
        await approve(view, parked)
        const bank = view.result.current.setupStatus!.rows[1]

        await act(async () => {
            await view.result.current.handleSetupDocument(bank.step!)
        })
        expect(startKycAction).toHaveBeenCalledWith('supplement:bridge')
        expect(view.result.current.showWrapper).toBe(true)
        expect(view.result.current.setupStatus?.open).toBe(false)

        await act(async () => {
            view.result.current.handleSdkComplete()
        })
        expect(view.result.current.setupStatus?.open).toBe(true)
        expect(view.result.current.setupStatus?.rows[1]).toEqual({
            key: 'bank',
            state: 'under-review',
            reason: 'requirements_in_review',
        })
        expect(view.result.current.modalPhase).toBe('verifying')
        expect(onKycSuccess).not.toHaveBeenCalled()
    })

    it('closing the proof of address without sending it brings the status back', async () => {
        const view = await submitOnDocumentList()
        await approve(view, parked)
        await act(async () => {
            await view.result.current.handleSetupDocument(view.result.current.setupStatus!.rows[1].step!)
        })
        act(() => view.result.current.handleSdkClose())
        expect(view.result.current.setupStatus?.open).toBe(true)
        expect(view.result.current.setupStatus?.rows[1].state).toBe('document-needed')
    })

    it('the bank terms open the existing terms step and come back to the status once accepted', async () => {
        jest.mocked(confirmBridgeTos).mockResolvedValue({ data: { accepted: true } } as never)
        const view = await submitOnDocumentList()
        await approve(view, onTerms)
        expect(view.result.current.setupStatus?.rows[1].state).toBe('agreements-needed')

        act(() => view.result.current.handleSetupTerms())
        expect(view.result.current.modalPhase).toBe('bridge_tos')
        expect(view.result.current.setupStatus?.open).toBe(false)

        await act(async () => {
            await view.result.current.handleTosIframeClose('tos_accepted')
        })
        expect(confirmBridgeTos).toHaveBeenCalled()
        expect(view.result.current.modalPhase).toBe('verifying')
        expect(view.result.current.setupStatus?.open).toBe(true)
        expect(view.result.current.setupStatus?.rows[1].state).toBe('setting-up')
        expect(captured(ANALYTICS_EVENTS.KYC_TOS_ACCEPTED)).toHaveLength(1)
    })

    it('leaving the terms step without accepting goes back to the status', async () => {
        const view = await submitOnDocumentList()
        await approve(view, onTerms)
        act(() => view.result.current.handleSetupTerms())
        await act(async () => {
            await view.result.current.handleTosIframeClose()
        })
        expect(view.result.current.modalPhase).toBe('verifying')
        expect(view.result.current.setupStatus?.rows[1].state).toBe('agreements-needed')

        act(() => view.result.current.handleSetupTerms())
        act(() => view.result.current.handleSetupBack())
        expect(view.result.current.modalPhase).toBe('verifying')
        expect(view.result.current.setupStatus?.open).toBe(true)
    })

    it('Continue completes the flow once everything is available; Go to Home leaves as the progress modal did', async () => {
        const onKycSuccess = jest.fn()
        const view = await submitOnDocumentList({ onKycSuccess })
        await approve(view, parked)

        act(() => view.result.current.handleSetupClose())
        expect(view.result.current.isModalOpen).toBe(false)
        expect(view.result.current.setupStatus?.open).toBe(false)
        expect(captured(ANALYTICS_EVENTS.KYC_ABANDONED)).toHaveLength(1)
        expect(onKycSuccess).not.toHaveBeenCalled()

        act(() => view.result.current.handleSetupContinue())
        expect(onKycSuccess).toHaveBeenCalledTimes(1)
        expect(captured(ANALYTICS_EVENTS.KYC_APPROVED)).toHaveLength(1)
    })

    it('saving new features for a verified identity shows their status, not the phases', async () => {
        const onKycSuccess = jest.fn()
        mockUser = verifiedUser(parked)
        mockCapabilities = parked
        mockFetchUser.mockResolvedValue({ ...mockUser })
        jest.mocked(findKycDocumentPlan)
            .mockResolvedValueOnce({ ...plan, available: false, routes: [] })
            .mockResolvedValue(plan)
        jest.mocked(getKycDocumentStatus).mockResolvedValue('APPROVED')
        const added = { ...features, bank: true, qr: true }
        jest.mocked(saveKycFeatures).mockResolvedValue({
            plan: { ...plan, available: false, routes: [], features: added },
        })
        const view = renderHook(() => useMultiPhaseKycFlow({ onKycSuccess }))
        await act(async () => {
            await view.result.current.handleInitiateKyc()
        })
        expect(view.result.current.documentPreferencesOnly).toBe(true)

        await act(async () => {
            await view.result.current.confirmDocumentPlan('', [], { ...added, qr: false })
        })
        expect(view.result.current.modalPhase).toBe('verifying')
        expect(view.result.current.setupStatus?.open).toBe(true)
        expect(view.result.current.setupStatus?.rows.map((row) => row.key)).toEqual(['bank'])
        expect(onKycSuccess).not.toHaveBeenCalled()
    })
})

describe('useMultiPhaseKycFlow — a returning user opens the status from the identity status', () => {
    it('shows the saved features and closes without reporting an abandonment or an approval', async () => {
        mockUser = verifiedUser(parked)
        mockCapabilities = parked
        const onManualClose = jest.fn()
        const onKycSuccess = jest.fn()
        const view = renderHook(() => useMultiPhaseKycFlow({ onManualClose, onKycSuccess }))

        act(() => view.result.current.openSetupStatus(features))
        expect(view.result.current.setupStatus?.open).toBe(true)
        expect(view.result.current.setupStatus?.rows.map((row) => row.state)).toEqual(['available', 'document-needed'])

        act(() => view.result.current.handleSetupClose())
        expect(view.result.current.setupStatus?.open).toBe(false)
        expect(onManualClose).toHaveBeenCalledTimes(1)
        expect(captured(ANALYTICS_EVENTS.KYC_ABANDONED)).toHaveLength(0)

        act(() => view.result.current.openSetupStatus(features))
        act(() => view.result.current.handleSetupContinue())
        expect(onKycSuccess).not.toHaveBeenCalled()
        expect(captured(ANALYTICS_EVENTS.KYC_APPROVED)).toHaveLength(0)
    })
})

describe('useMultiPhaseKycFlow — every other flow keeps the phases', () => {
    it('a flow the document list did not start runs the phases after the approval, with no setup status', async () => {
        jest.mocked(findKycDocumentPlan).mockResolvedValue({ ...plan, available: false, routes: [] })
        jest.mocked(initiateSumsubKyc).mockResolvedValue({
            data: { token: 'tok', applicantId: 'app', status: 'PENDING' },
        })
        mockFetchUser.mockResolvedValue({ capabilities: parked })
        const view = renderHook(() => useMultiPhaseKycFlow({}))
        await act(async () => {
            await view.result.current.handleInitiateKyc('EU')
        })
        act(() => view.result.current.handleSdkComplete())
        expect(view.result.current.setupStatus).toBeNull()
        expect(view.result.current.isModalOpen).toBe(true)

        await act(async () => {
            mockWs.handler?.('APPROVED')
        })
        expect(view.result.current.setupStatus).toBeNull()
        expect(view.result.current.modalPhase).toBe('supplement')
    })

    it('a legacy start after a document-first one in the same mount drops the setup status', async () => {
        const view = await submitOnDocumentList()
        expect(view.result.current.setupStatus).not.toBeNull()

        jest.mocked(findKycDocumentPlan).mockResolvedValue({ ...plan, available: false, routes: [] })
        jest.mocked(initiateSumsubKyc).mockResolvedValue({
            data: { token: 'tok', applicantId: 'app', status: 'PENDING' },
        })
        await act(async () => {
            await view.result.current.handleInitiateKyc('EU')
        })
        expect(view.result.current.setupStatus).toBeNull()
    })
})
