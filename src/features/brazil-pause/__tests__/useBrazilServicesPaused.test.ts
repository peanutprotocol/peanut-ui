import { renderHook } from '@testing-library/react'
import type { RailCapabilityStatus } from '@/types/capabilities'
import { useBrazilServicesPaused } from '../useBrazilServicesPaused'
import { storeSecondResidence } from '@/utils/declared-residence.storage'

let mockSwitchOn = false
let mockResidence: string[] = []
let mockPixDeposit: RailCapabilityStatus | undefined
let mockUser: { user: { userId: string }; residence?: { secondaryDeclaredCountry?: string | null } }

jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: mockUser }) }))
jest.mock('@/utils/native-platform', () => ({
    useHydrationSnapshot: (read: () => unknown) => read(),
}))

jest.mock('@/features/kill-switches/useKillSwitches', () => ({
    useKillSwitches: () => ({ brazilServicesPaused: mockSwitchOn }),
}))
jest.mock('@/features/deposit-accounts/useResidenceIso2s', () => ({ useResidenceIso2s: () => mockResidence }))
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({
        operationStatus: (railId: string, op: string) =>
            railId === 'manteca.pix_br' && op === 'deposit' ? mockPixDeposit : undefined,
    }),
}))

beforeEach(() => {
    mockSwitchOn = false
    mockResidence = []
    mockPixDeposit = undefined
    mockUser = { user: { userId: 'brazil-pause-user-a' } }
    localStorage.clear()
})

describe('useBrazilServicesPaused', () => {
    it('is off while the switch is off, even for a Brazil resident', () => {
        mockResidence = ['BR']
        expect(renderHook(() => useBrazilServicesPaused()).result.current).toBe(false)
    })

    it('is on for a Brazil resident once the switch is on', () => {
        mockSwitchOn = true
        mockResidence = ['BR']
        expect(renderHook(() => useBrazilServicesPaused()).result.current).toBe(true)
    })

    it('is on for a Brazil account holder with no residence on file', () => {
        mockSwitchOn = true
        mockPixDeposit = 'enabled'
        expect(renderHook(() => useBrazilServicesPaused()).result.current).toBe(true)
    })

    it('stays off for a user the pause does not cover', () => {
        mockSwitchOn = true
        mockResidence = ['AR']
        expect(renderHook(() => useBrazilServicesPaused()).result.current).toBe(false)
    })

    it('still covers a second declared Brazil residence when the primary residence is elsewhere', () => {
        mockSwitchOn = true
        mockResidence = ['PT']
        mockUser.residence = { secondaryDeclaredCountry: 'BR' }
        expect(renderHook(() => useBrazilServicesPaused()).result.current).toBe(true)
    })

    it('uses the account-scoped second-residence mirror when the API omits the field', () => {
        mockSwitchOn = true
        mockResidence = ['PT']
        storeSecondResidence(mockUser.user.userId, 'BR')
        expect(renderHook(() => useBrazilServicesPaused()).result.current).toBe(true)
    })

    it('prefers an explicit server null over a stale second-residence mirror', () => {
        mockSwitchOn = true
        mockResidence = ['PT']
        storeSecondResidence(mockUser.user.userId, 'BR')
        mockUser.residence = { secondaryDeclaredCountry: null }
        expect(renderHook(() => useBrazilServicesPaused()).result.current).toBe(false)
    })

    it('does not carry a second-residence mirror into another account', () => {
        mockSwitchOn = true
        mockResidence = ['PT']
        storeSecondResidence(mockUser.user.userId, 'BR')
        const { result, rerender } = renderHook(() => useBrazilServicesPaused())
        expect(result.current).toBe(true)

        mockUser = { user: { userId: 'brazil-pause-user-b' } }
        rerender()
        expect(result.current).toBe(false)
    })

    it('leaves a second Brazil resident unaffected while the switch is off', () => {
        mockUser.residence = { secondaryDeclaredCountry: 'BR' }
        expect(renderHook(() => useBrazilServicesPaused()).result.current).toBe(false)
    })
})
