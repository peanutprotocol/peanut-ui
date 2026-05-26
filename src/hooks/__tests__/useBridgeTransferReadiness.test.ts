import { renderHook } from '@testing-library/react'
import {
    useBridgeTransferReadiness,
    getKycModalVariant,
    getGateProviderMessage,
    getGateProviderTitle,
    getGateActionLabel,
} from '../useBridgeTransferReadiness'
import type { BridgeGateAction } from '../useBridgeTransferReadiness'
import { type IUserRail, type UserRailStatus } from '@/interfaces'

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

function bridgeRail(status: UserRailStatus): IUserRail {
    return {
        id: `ur-bridge-${status}`,
        railId: 'r-bridge',
        status,
        metadata: null,
        rail: {
            id: 'r-bridge',
            provider: { code: 'BRIDGE', name: 'Bridge' },
            method: { code: 'ACH_US', name: 'ACH', country: 'US', currency: 'USD' },
        },
    }
}

function setup({
    needsBridgeTos = false,
    bridgeState = 'happy' as ProviderRejectionState,
    bridgeUserMessage = null as string | null,
    bridgeModalTitle = null as string | null,
    bridgeActionLabel = null as string | null,
    bridgeRejectedRailCount = 0,
    isSumsubApproved = false,
    // null → no Bridge rails (not enrolled); otherwise the user's single Bridge rail status
    bridgeRailStatus = null as UserRailStatus | null,
} = {}) {
    const bridgeRails = bridgeRailStatus ? [bridgeRail(bridgeRailStatus)] : []
    mockTosStatus.mockReturnValue({
        needsBridgeTos,
        isBridgeFullyEnabled: bridgeRailStatus === 'ENABLED',
        bridgeRails,
    })
    mockRejectionStatus.mockReturnValue({
        bridge: {
            ...defaultRejection,
            state: bridgeState,
            userMessage: bridgeUserMessage,
            modalTitle: bridgeModalTitle,
            actionLabel: bridgeActionLabel,
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
        isUserBridgeKycApproved: false,
        isUserBridgeKycUnderReview: false,
        isUserBridgeKycIncomplete: false,
        isUserMantecaKycApproved: false,
        isUserKycApproved: false,
    })
}

describe('useBridgeTransferReadiness', () => {
    afterEach(() => jest.resetAllMocks())

    it('returns ready when bridge rail is ENABLED', () => {
        setup({ isSumsubApproved: true, bridgeRailStatus: 'ENABLED' })
        const { result } = renderHook(() => useBridgeTransferReadiness())
        expect(result.current.gate.type).toBe('ready')
    })

    it('blocked_rejection takes priority over accept_tos', () => {
        setup({ needsBridgeTos: true, bridgeState: 'blocked', bridgeUserMessage: 'permanently rejected' })
        const { result } = renderHook(() => useBridgeTransferReadiness())
        expect(result.current.gate.type).toBe('blocked_rejection')
        expect((result.current.gate as { userMessage?: string }).userMessage).toBe('permanently rejected')
    })

    it('accept_tos fires when tos needed and no hard rejection', () => {
        setup({ needsBridgeTos: true })
        const { result } = renderHook(() => useBridgeTransferReadiness())
        expect(result.current.gate.type).toBe('accept_tos')
    })

    it('fixable_rejection when selfHealable and no tos needed', () => {
        setup({
            bridgeState: 'fixable',
            bridgeUserMessage: 'upload clearer photo',
            bridgeModalTitle: 'We need an updated document',
            bridgeActionLabel: 'Upload ID',
        })
        const { result } = renderHook(() => useBridgeTransferReadiness())
        expect(result.current.gate.type).toBe('fixable_rejection')
        expect((result.current.gate as any).userMessage).toBe('upload clearer photo')
        expect((result.current.gate as any).modalTitle).toBe('We need an updated document')
        expect((result.current.gate as any).actionLabel).toBe('Upload ID')
    })

    it('needs_enrollment when sumsub approved but no bridge rail exists', () => {
        setup({ isSumsubApproved: true, bridgeRailStatus: null })
        const { result } = renderHook(() => useBridgeTransferReadiness())
        expect(result.current.gate.type).toBe('needs_enrollment')
    })

    it('provider_processing blocks enrollment while Bridge is reviewing submitted remediation', () => {
        setup({
            bridgeState: 'processing',
            bridgeUserMessage: "We're reviewing your documents.",
            bridgeRejectedRailCount: 1,
            isSumsubApproved: true,
            bridgeRailStatus: 'REQUIRES_EXTRA_INFORMATION',
        })
        const { result } = renderHook(() => useBridgeTransferReadiness())
        expect(result.current.gate.type).toBe('provider_processing')
        expect((result.current.gate as any).userMessage).toBe("We're reviewing your documents.")
    })

    it('ready when sumsub approved and bridge rail is PENDING (enrollment already started)', () => {
        setup({ isSumsubApproved: true, bridgeRailStatus: 'PENDING' })
        const { result } = renderHook(() => useBridgeTransferReadiness())
        expect(result.current.gate.type).toBe('ready')
    })

    it('ready when sumsub approved and bridge rail is REQUIRES_INFORMATION', () => {
        setup({ isSumsubApproved: true, bridgeRailStatus: 'REQUIRES_INFORMATION' })
        const { result } = renderHook(() => useBridgeTransferReadiness())
        expect(result.current.gate.type).toBe('ready')
    })

    it('needs_kyc when user has not started standard verification', () => {
        setup({ isSumsubApproved: false, bridgeRailStatus: null })
        const { result } = renderHook(() => useBridgeTransferReadiness())
        expect(result.current.gate.type).toBe('needs_kyc')
    })

    it('needs_kyc when standard verification is not approved and bridge rail is pending', () => {
        setup({ isSumsubApproved: false, bridgeRailStatus: 'PENDING' })
        const { result } = renderHook(() => useBridgeTransferReadiness())
        expect(result.current.gate.type).toBe('needs_kyc')
    })

    it('ready when standard verification is not approved but bridge rail is enabled', () => {
        setup({ isSumsubApproved: false, bridgeRailStatus: 'ENABLED' })
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
})

describe('getKycModalVariant', () => {
    it('maps gate types to modal variants', () => {
        expect(getKycModalVariant('blocked_rejection')).toBe('blocked')
        expect(getKycModalVariant('fixable_rejection')).toBe('provider_rejection')
        expect(getKycModalVariant('provider_processing')).toBe('processing')
        expect(getKycModalVariant('needs_enrollment')).toBe('cross_region')
        expect(getKycModalVariant('needs_kyc')).toBe('default')
        expect(getKycModalVariant('accept_tos')).toBe('default')
        expect(getKycModalVariant('ready')).toBe('default')
    })
})

describe('getGateProviderMessage', () => {
    it('returns userMessage for rejection gates', () => {
        expect(getGateProviderMessage({ type: 'blocked_rejection', userMessage: 'blocked msg' })).toBe('blocked msg')
        expect(
            getGateProviderMessage({
                type: 'fixable_rejection',
                userMessage: 'fix msg',
                modalTitle: null,
                actionLabel: null,
            })
        ).toBe('fix msg')
        expect(getGateProviderMessage({ type: 'provider_processing', userMessage: 'processing msg' })).toBe(
            'processing msg'
        )
    })

    it('returns undefined for null userMessage', () => {
        expect(getGateProviderMessage({ type: 'blocked_rejection', userMessage: null })).toBeUndefined()
    })

    it('returns undefined for non-rejection gates', () => {
        expect(getGateProviderMessage({ type: 'accept_tos' })).toBeUndefined()
        expect(getGateProviderMessage({ type: 'needs_kyc' })).toBeUndefined()
        expect(getGateProviderMessage({ type: 'needs_enrollment' })).toBeUndefined()
        expect(getGateProviderMessage({ type: 'ready' })).toBeUndefined()
    })
})

describe('getGateProviderTitle and getGateActionLabel', () => {
    it('returns fixable rejection modal copy', () => {
        const gate: BridgeGateAction = {
            type: 'fixable_rejection',
            userMessage: 'details needed',
            modalTitle: 'We need more details',
            actionLabel: 'Provide required details',
        }

        expect(getGateProviderTitle(gate)).toBe('We need more details')
        expect(getGateActionLabel(gate)).toBe('Provide required details')
    })

    it('returns undefined for non-fixable gates', () => {
        expect(getGateProviderTitle({ type: 'accept_tos' })).toBeUndefined()
        expect(getGateActionLabel({ type: 'ready' })).toBeUndefined()
    })
})
