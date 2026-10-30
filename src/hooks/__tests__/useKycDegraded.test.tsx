import { act, renderHook } from '@testing-library/react'
import { refreshKillSwitches } from '@/features/kill-switches/kill-switches-store'
import { useKycDegraded } from '../useKycDegraded'

const mockApiFetch = jest.fn()
jest.mock('@/utils/api-fetch', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))

const respond = (body: unknown) => mockApiFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => body })

describe('useKycDegraded', () => {
    it('is off by default and follows the kycVerificationDown kill switch', async () => {
        const { result } = renderHook(() => useKycDegraded())
        expect(result.current).toBe(false)

        respond({ kycVerificationDown: true })
        await act(() => refreshKillSwitches())
        expect(result.current).toBe(true)

        respond({ kycVerificationDown: false })
        await act(() => refreshKillSwitches())
        expect(result.current).toBe(false)
    })
})
