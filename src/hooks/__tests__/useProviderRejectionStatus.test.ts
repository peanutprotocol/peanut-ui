import { renderHook } from '@testing-library/react'
import { useAuth } from '@/context/authContext'
import {
    MANTECA_US_NATIONALITY_RESTRICTION_CODE,
    MANTECA_US_NATIONALITY_RESTRICTION_MESSAGE,
} from '@/constants/manteca.consts'
import useProviderRejectionStatus from '../useProviderRejectionStatus'

jest.mock('@/context/authContext', () => ({
    useAuth: jest.fn(),
}))

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

describe('useProviderRejectionStatus', () => {
    afterEach(() => jest.resetAllMocks())

    it('returns the Manteca restriction message for US-nationality provider rejection metadata', () => {
        mockUseAuth.mockReturnValue({
            user: {
                user: {
                    kycVerifications: [
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
                            method: { code: 'BANK_TRANSFER_AR', country: 'AR' },
                        },
                    },
                ],
            },
        } as unknown as ReturnType<typeof useAuth>)

        const { result } = renderHook(() => useProviderRejectionStatus())

        expect(result.current.manteca.state).toBe('blocked')
        expect(result.current.manteca.userMessage).toBe(MANTECA_US_NATIONALITY_RESTRICTION_MESSAGE)
    })
})
