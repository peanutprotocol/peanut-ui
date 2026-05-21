import { renderHook } from '@testing-library/react'
import { useBridgeTransferReadiness, getKycModalVariant, getGateProviderMessage } from '../useBridgeTransferReadiness'
import type { BridgeGateAction } from '../useBridgeTransferReadiness'

// mock the three dependency hooks
jest.mock('../useBridgeTosStatus', () => ({
    useBridgeTosStatus: jest.fn(),
}))
jest.mock('../useProviderRejectionStatus', () => ({
    __esModule: true,
    default: jest.fn(),
}))
jest.mock('../useKycStatus', () => ({
    __esModule: true,
    default: jest.fn(),
}))

import { useBridgeTosStatus } from '../useBridgeTosStatus'
import useProviderRejectionStatus from '../useProviderRejectionStatus'
import type { ProviderRejectionState } from '../useProviderRejectionStatus'
import useKycStatus from '../useKycStatus'

const mockTosStatus = useBridgeTosStatus as jest.MockedFunction<typeof useBridgeTosStatus>
const mockRejectionStatus = useProviderRejectionStatus as jest.MockedFunction<typeof useProviderRejectionStatus>
const mockKycStatus = useKycStatus as jest.MockedFunction<typeof useKycStatus>

const defaultRejection = {
    provider: 'BRIDGE' as const,
    state: 'happy' as ProviderRejectionState,
    userMessage: null,
    rejectedRails: [],
    kycVerification: null,
    selfHealAttempt: 0,
    maxAttempts: 3,
    requiredAction: null,
    actionTitle: null,
    modalTitle: null,
    modalDescription: null,
    actionLabel: null,
    actionHandler: null,
}

function setup({
    needsBridgeTos = false,
    bridgeState = 'happy' as ProviderRejectionState,
    bridgeUserMessage = null as string | null,
    bridgeRejectedRailCount = 0,
    isSumsubApproved = false,
    isBridgeApproved = false,
    isBridgeUnderReview = false,
    isBridgeIncomplete = false,
} = {}) {
    mockTosStatus.mockReturnValue({
        needsBridgeTos,
        isBridgeFullyEnabled: false,
        bridgeRails: [],
    })
    mockRejectionStatus.mockReturnValue({
        bridge: {
            ...defaultRejection,
            state: bridgeState,
            userMessage: bridgeUserMessage,
            rejectedRails: Array.from(
                { length: bridgeRejectedRailCount },
                (_, index) => ({ id: `rail-${index}` }) as any
            ),
        },
        manteca: { ...defaultRejection, provider: 'MANTECA' },
        hasFixableRejection: bridgeState === 'fixable',
        hasBlockedRejection: bridgeState === 'blocked',
        hasAnyRejection: bridgeState === 'fixable' || bridgeState === 'blocked',
        primaryRejection: null,
    })
    mockKycStatus.mockReturnValue({
        isUserSumsubKycApproved: isSumsubApproved,
        isUserBridgeKycApproved: isBridgeApproved,
        isUserBridgeKycUnderReview: isBridgeUnderReview,
        isUserBridgeKycIncomplete: isBridgeIncomplete,
        isUserMantecaKycApproved: false,
        isUserKycApproved: isBridgeApproved,
    })
}

describe('useBridgeTransferReadiness', () => {
    afterEach(() => jest.resetAllMocks())

    it('returns ready when no issues', () => {
        setup({ isSumsubApproved: true, isBridgeApproved: true })
        const { result } = renderHook(() => useBridgeTransferReadiness())
        expect(result.current.gate.type).toBe('ready')
    })

    it('blocked_rejection takes priority over accept_tos', () => {
        setup({ needsBridgeTos: true, bridgeState: 'blocked', bridgeUserMessage: 'permanently rejected' })
        const { result } = renderHook(() => useBridgeTransferReadiness())
        expect(result.current.gate.type).toBe('blocked_rejection')
        expect((result.current.gate as any).userMessage).toBe('permanently rejected')
    })

    it('accept_tos fires when tos needed and no hard rejection', () => {
        setup({ needsBridgeTos: true })
        const { result } = renderHook(() => useBridgeTransferReadiness())
        expect(result.current.gate.type).toBe('accept_tos')
    })

    it('fixable_rejection when selfHealable and no tos needed', () => {
        setup({ bridgeState: 'fixable', bridgeUserMessage: 'upload clearer photo' })
        const { result } = renderHook(() => useBridgeTransferReadiness())
        expect(result.current.gate.type).toBe('fixable_rejection')
        expect((result.current.gate as any).userMessage).toBe('upload clearer photo')
    })

    it('needs_enrollment when sumsub approved but bridge not started', () => {
        setup({ isSumsubApproved: true })
        const { result } = renderHook(() => useBridgeTransferReadiness())
        expect(result.current.gate.type).toBe('needs_enrollment')
    })

    it('provider_processing blocks enrollment while Bridge is reviewing submitted remediation', () => {
        setup({
            bridgeState: 'processing',
            bridgeUserMessage: "We're reviewing your documents.",
            bridgeRejectedRailCount: 1,
            isSumsubApproved: true,
        })
        const { result } = renderHook(() => useBridgeTransferReadiness())
        expect(result.current.gate.type).toBe('provider_processing')
        expect((result.current.gate as any).userMessage).toBe("We're reviewing your documents.")
    })

    it('ready when sumsub approved and bridge under review (enrollment not needed)', () => {
        setup({ isSumsubApproved: true, isBridgeUnderReview: true })
        const { result } = renderHook(() => useBridgeTransferReadiness())
        expect(result.current.gate.type).toBe('ready')
    })

    it('ready when sumsub approved and bridge incomplete (enrollment not needed)', () => {
        setup({ isSumsubApproved: true, isBridgeIncomplete: true })
        const { result } = renderHook(() => useBridgeTransferReadiness())
        expect(result.current.gate.type).toBe('ready')
    })

    it('ready when sumsub approved and bridge approved', () => {
        setup({ isSumsubApproved: true, isBridgeApproved: true })
        const { result } = renderHook(() => useBridgeTransferReadiness())
        expect(result.current.gate.type).toBe('ready')
    })

    it('accept_tos takes priority over fixable_rejection', () => {
        setup({ needsBridgeTos: true, bridgeState: 'fixable' })
        const { result } = renderHook(() => useBridgeTransferReadiness())
        expect(result.current.gate.type).toBe('accept_tos')
    })

    it('accept_tos takes priority over needs_enrollment', () => {
        setup({ needsBridgeTos: true, isSumsubApproved: true })
        const { result } = renderHook(() => useBridgeTransferReadiness())
        expect(result.current.gate.type).toBe('accept_tos')
    })

    it('accept_tos when bridge incomplete and tos needed (main bug scenario)', () => {
        setup({ needsBridgeTos: true, isBridgeIncomplete: true, isSumsubApproved: true })
        const { result } = renderHook(() => useBridgeTransferReadiness())
        expect(result.current.gate.type).toBe('accept_tos')
    })
})

describe('getKycModalVariant', () => {
    it('maps gate types to modal variants', () => {
        expect(getKycModalVariant('blocked_rejection')).toBe('blocked')
        expect(getKycModalVariant('fixable_rejection')).toBe('provider_rejection')
        expect(getKycModalVariant('provider_processing')).toBe('processing')
        expect(getKycModalVariant('needs_enrollment')).toBe('cross_region')
        expect(getKycModalVariant('accept_tos')).toBe('default')
        expect(getKycModalVariant('ready')).toBe('default')
    })
})

describe('getGateProviderMessage', () => {
    it('returns userMessage for rejection gates', () => {
        expect(getGateProviderMessage({ type: 'blocked_rejection', userMessage: 'blocked msg' })).toBe('blocked msg')
        expect(getGateProviderMessage({ type: 'fixable_rejection', userMessage: 'fix msg' })).toBe('fix msg')
        expect(getGateProviderMessage({ type: 'provider_processing', userMessage: 'processing msg' })).toBe(
            'processing msg'
        )
    })

    it('returns undefined for null userMessage', () => {
        expect(getGateProviderMessage({ type: 'blocked_rejection', userMessage: null })).toBeUndefined()
    })

    it('returns undefined for non-rejection gates', () => {
        expect(getGateProviderMessage({ type: 'accept_tos' })).toBeUndefined()
        expect(getGateProviderMessage({ type: 'needs_enrollment' })).toBeUndefined()
        expect(getGateProviderMessage({ type: 'ready' })).toBeUndefined()
    })
})
