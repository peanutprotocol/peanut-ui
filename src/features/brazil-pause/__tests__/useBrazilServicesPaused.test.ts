import { renderHook } from '@testing-library/react'
import type { RailCapabilityStatus } from '@/types/capabilities'
import { useBrazilServicesPaused } from '../useBrazilServicesPaused'

let mockSwitchOn = false
let mockResidence: string[] = []
let mockPixDeposit: RailCapabilityStatus | undefined

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
})
