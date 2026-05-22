import { renderHook, waitFor } from '@testing-library/react'
import { useAuth } from '@/context/authContext'
import {
    MANTECA_US_NATIONALITY_RESTRICTION_CODE,
    MANTECA_US_NATIONALITY_RESTRICTION_MESSAGE,
} from '@/constants/manteca.consts'
import { QrKycState, useQrKycGate } from '../useQrKycGate'

jest.mock('@/context/authContext', () => ({
    useAuth: jest.fn(),
}))

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

describe('useQrKycGate', () => {
    afterEach(() => jest.resetAllMocks())

    it('blocks restricted Manteca users and returns the restriction message', async () => {
        mockUseAuth.mockReturnValue({
            isFetchingUser: false,
            fetchUser: jest.fn(),
            user: {
                user: {
                    bridgeKycStatus: null,
                    kycVerifications: [
                        { provider: 'SUMSUB', status: 'APPROVED' },
                        {
                            provider: 'MANTECA',
                            status: 'REJECTED',
                            rejectType: 'PROVIDER_FINAL',
                            updatedAt: '2026-05-22T00:00:00.000Z',
                            metadata: { restrictionCode: MANTECA_US_NATIONALITY_RESTRICTION_CODE },
                        },
                    ],
                },
                rails: [
                    {
                        status: 'REJECTED',
                        metadata: {
                            restrictionCode: MANTECA_US_NATIONALITY_RESTRICTION_CODE,
                            selfHealable: false,
                        },
                        rail: {
                            provider: { code: 'MANTECA' },
                            method: { code: 'MERCADOPAGO_QR_AR', country: 'AR' },
                        },
                    },
                ],
            },
        } as unknown as ReturnType<typeof useAuth>)

        const { result } = renderHook(() => useQrKycGate('MANTECA'))

        await waitFor(() => expect(result.current.kycGateState).toBe(QrKycState.PROVIDER_REJECTION_BLOCKED))
        expect(result.current.shouldBlockPay).toBe(true)
        expect(result.current.userMessage).toBe(MANTECA_US_NATIONALITY_RESTRICTION_MESSAGE)
    })
})
