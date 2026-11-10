import { renderHook } from '@testing-library/react'
import type { RailCapabilityStatus } from '@/types/capabilities'
import { useBrazilPixPaused, useBrazilResident } from '../useBrazilPixPaused'
import { storeDeclaredResidence } from '@/utils/declared-residence.storage'

type Residence = {
    verified?: { country: string } | null
    declared?: { country: string } | null
    secondaryDeclaredCountry?: string | null
}

let mockSwitchOn = false
let mockPixFirstParty: RailCapabilityStatus | undefined
let mockUser: { user: { userId: string }; residence?: Residence }

jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: mockUser }) }))
jest.mock('@/utils/native-platform', () => ({
    useHydrationSnapshot: (read: () => unknown) => read(),
}))
jest.mock('@/features/kill-switches/useKillSwitches', () => ({
    useKillSwitches: () => ({ brazilServicesPaused: mockSwitchOn }),
}))
// Pix deposit and withdraw, as the API rates them for the user's Manteca account
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({
        operationStatus: (railId: string, op: string) =>
            railId === 'manteca.pix_br' && op !== 'pay' ? mockPixFirstParty : undefined,
    }),
}))

const withResidence = (residence?: Residence) => {
    mockUser = { user: { userId: 'pix-pause-user' }, ...(residence !== undefined ? { residence } : {}) }
}

beforeEach(() => {
    mockSwitchOn = false
    mockPixFirstParty = undefined
    withResidence({ verified: null, declared: null })
    localStorage.clear()
})

describe('useBrazilPixPaused', () => {
    it('pauses Pix for a verified Brazil resident while the Brazil pause is off', () => {
        withResidence({ verified: { country: 'BR' }, declared: { country: 'PT' } })
        expect(renderHook(() => useBrazilPixPaused()).result.current).toBe(true)
    })

    it('pauses Pix for a declared Brazil resident with nothing verified', () => {
        withResidence({ verified: null, declared: { country: 'br' } })
        expect(renderHook(() => useBrazilPixPaused()).result.current).toBe(true)
    })

    it('keeps Pix for a verified resident elsewhere while a move to Brazil is pending', () => {
        withResidence({ verified: { country: 'PT' }, declared: { country: 'BR' } })
        expect(renderHook(() => useBrazilPixPaused()).result.current).toBe(false)
    })

    it('keeps Pix for a user with no residence or another residence', () => {
        expect(renderHook(() => useBrazilPixPaused()).result.current).toBe(false)
        withResidence({ verified: null, declared: { country: 'AR' } })
        expect(renderHook(() => useBrazilPixPaused()).result.current).toBe(false)
    })

    it('reads the residence stored on the device until the server answers', () => {
        withResidence(undefined)
        storeDeclaredResidence('pix-pause-user', 'BR')
        expect(renderHook(() => useBrazilPixPaused()).result.current).toBe(true)
    })

    it('keeps Pix during the Brazil pause for a resident elsewhere whose account reads as a Brazil rail (TASK-24724)', () => {
        mockSwitchOn = true
        mockPixFirstParty = 'enabled'
        withResidence({ verified: { country: 'AR' } })
        expect(renderHook(() => useBrazilPixPaused()).result.current).toBe(false)
        expect(renderHook(() => useBrazilResident()).result.current).toBe(false)
    })

    it('follows the Brazil pause for a Brazil rail holder with no residence on file', () => {
        mockSwitchOn = true
        mockPixFirstParty = 'enabled'
        expect(renderHook(() => useBrazilPixPaused()).result.current).toBe(true)
    })

    it('follows the Brazil pause for a second declared Brazil residence', () => {
        mockSwitchOn = true
        withResidence({ verified: { country: 'AR' }, secondaryDeclaredCountry: 'BR' })
        expect(renderHook(() => useBrazilPixPaused()).result.current).toBe(true)
    })
})
