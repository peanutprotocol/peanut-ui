import { renderHook } from '@testing-library/react'
import { useBrazilPixPaused, useBrazilResident } from '../useBrazilPixPaused'
import { storeDeclaredResidence } from '@/utils/declared-residence.storage'

type Residence = { verified?: { country: string } | null; declared?: { country: string } | null }

let mockBrazilPaused = false
let mockUser: { user: { userId: string }; residence?: Residence }

jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: mockUser }) }))
jest.mock('@/utils/native-platform', () => ({
    useHydrationSnapshot: (read: () => unknown) => read(),
}))
jest.mock('../useBrazilServicesPaused', () => ({ useBrazilServicesPaused: () => mockBrazilPaused }))

const withResidence = (residence?: Residence) => {
    mockUser = { user: { userId: 'pix-pause-user' }, ...(residence !== undefined ? { residence } : {}) }
}

beforeEach(() => {
    mockBrazilPaused = false
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

    it('follows the Brazil pause for a user who lives elsewhere', () => {
        mockBrazilPaused = true
        withResidence({ verified: { country: 'AR' } })
        expect(renderHook(() => useBrazilPixPaused()).result.current).toBe(true)
        expect(renderHook(() => useBrazilResident()).result.current).toBe(false)
    })
})
