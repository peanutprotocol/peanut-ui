/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react'
import type { RailCapability } from '@/types/capabilities'

let mockUser: unknown
let mockRails: RailCapability[] = []
let mockLoading = false
let mockVerified = true
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: mockUser }) }))
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({
        isLoading: mockLoading,
        getRail: (id: string) => mockRails.find((rail) => rail.id === id),
    }),
}))
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ isVerified: mockVerified }),
}))

import { useAveniaPixPath } from '../hooks/useAveniaPixPath'
import { __resetAveniaAvailabilityForTests, markAveniaUnavailable } from '../aveniaAvailability'

const brazilian = (userId = 'user-1') => ({ user: { userId }, residence: { verified: { country: 'BR' } } })

describe('useAveniaPixPath', () => {
    beforeEach(() => {
        __resetAveniaAvailabilityForTests()
        mockUser = brazilian()
        mockRails = []
        mockLoading = false
        mockVerified = true
    })

    it('routes a verified Brazilian resident to Avenia, and the rail comes with it once held', () => {
        expect(renderHook(() => useAveniaPixPath()).result.current).toEqual({ path: 'avenia', rail: undefined })

        const rail: RailCapability = {
            id: 'avenia.pix_br',
            provider: 'avenia',
            method: 'PIX_BR',
            channel: 'bank',
            country: 'BR',
            currency: 'BRL',
            status: 'enabled',
        }
        mockRails = [rail]
        expect(renderHook(() => useAveniaPixPath()).result.current).toEqual({ path: 'avenia', rail })
    })

    it('keeps Manteca for a resident elsewhere and for an unverified user', () => {
        mockUser = { user: { userId: 'user-1' }, residence: { verified: { country: 'AR' } } }
        expect(renderHook(() => useAveniaPixPath()).result.current.path).toBe('manteca')
        mockUser = brazilian()
        mockVerified = false
        expect(renderHook(() => useAveniaPixPath()).result.current.path).toBe('manteca')
    })

    it('moves to Manteca when the API refuses Avenia for this user, and only for them', () => {
        const { result } = renderHook(() => useAveniaPixPath())
        act(() => markAveniaUnavailable('user-2'))
        expect(result.current.path).toBe('avenia')
        act(() => markAveniaUnavailable('user-1'))
        expect(result.current.path).toBe('manteca')
    })

    it('waits for the capabilities', () => {
        mockLoading = true
        expect(renderHook(() => useAveniaPixPath()).result.current.path).toBe('loading')
    })
})
