/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react'
import { useQrClaimFlow } from '../useQrClaimFlow'

const mockPush = jest.fn()
const mockSaveRedirectUrl = jest.fn()
const mockSanitizeRedirectURL = jest.fn()
const mockServerFetch = jest.fn()

let mockUser: any = null
let mockQrStatus: { data: any; isLoading: boolean; error: any } = { data: undefined, isLoading: true, error: null }

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
    useParams: () => ({ code: 'abc123' }),
    useSearchParams: () => ({ get: () => null }),
}))
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockUser }),
}))
jest.mock('@/hooks/useRedirectQrStatus', () => ({
    useRedirectQrStatus: () => mockQrStatus,
}))
jest.mock('@/utils/api-fetch', () => ({
    serverFetch: (...args: unknown[]) => mockServerFetch(...args),
}))
jest.mock('@/utils/general.utils', () => ({
    saveRedirectUrl: (...args: unknown[]) => mockSaveRedirectUrl(...args),
    generateInviteCodeLink: (username: string) => ({ inviteLink: `https://peanut.me/${username}/i/123` }),
    sanitizeRedirectURL: (url: string) => mockSanitizeRedirectURL(url),
}))
jest.mock('@/utils/native-routes', () => ({
    qrSuccessUrl: (code: string) => `/qr/${code}/success`,
}))

describe('useQrClaimFlow', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockUser = null
        mockQrStatus = { data: undefined, isLoading: true, error: null }
        jest.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    it('does nothing while the status is loading', () => {
        renderHook(() => useQrClaimFlow())
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('redirects internally when the qr is claimed and the url sanitizes', () => {
        mockQrStatus = {
            data: { claimed: true, available: false, redirectUrl: '/kush/i/123' },
            isLoading: false,
            error: null,
        }
        mockSanitizeRedirectURL.mockReturnValue('/kush/i/123')
        renderHook(() => useQrClaimFlow())
        expect(mockPush).toHaveBeenCalledWith('/kush/i/123')
    })

    it('blocks untrusted external redirects and surfaces an error', () => {
        mockQrStatus = {
            data: { claimed: true, available: false, redirectUrl: 'https://evil.example/steal' },
            isLoading: false,
            error: null,
        }
        mockSanitizeRedirectURL.mockReturnValue(null)
        const { result } = renderHook(() => useQrClaimFlow())
        expect(mockPush).not.toHaveBeenCalled()
        expect(result.current.error).toBe('claim.invalidDestination')
    })

    it('sends a logged-out visitor to setup when the qr is unclaimed', () => {
        mockQrStatus = { data: { claimed: false, available: true }, isLoading: false, error: null }
        renderHook(() => useQrClaimFlow())
        expect(mockSaveRedirectUrl).toHaveBeenCalled()
        expect(mockPush).toHaveBeenCalledWith('/setup')
    })

    it('claims the qr with the invite link and routes to the success page', async () => {
        mockUser = { user: { username: 'kush' } }
        mockQrStatus = { data: { claimed: false, available: true }, isLoading: false, error: null }
        mockServerFetch.mockResolvedValue({ ok: true, json: async () => ({}) })

        const { result } = renderHook(() => useQrClaimFlow())
        await act(async () => {
            await result.current.handleClaim()
        })

        expect(mockServerFetch).toHaveBeenCalledWith('/qr/abc123/claim', {
            method: 'POST',
            body: JSON.stringify({ targetUrl: 'https://peanut.me/kush/i/123' }),
        })
        expect(mockPush).toHaveBeenCalledWith('/qr/abc123/success')
        expect(result.current.error).toBeNull()
    })

    it('shows the generic claim error when the backend rejects', async () => {
        mockUser = { user: { username: 'kush' } }
        mockQrStatus = { data: { claimed: false, available: true }, isLoading: false, error: null }
        mockServerFetch.mockResolvedValue({ ok: false, json: async () => ({ message: 'nope' }) })

        const { result } = renderHook(() => useQrClaimFlow())
        await act(async () => {
            await result.current.handleClaim()
        })

        expect(result.current.error).toBe('claim.claimFailed')
        expect(result.current.isLoading).toBe(false)
        expect(mockPush).not.toHaveBeenCalledWith('/qr/abc123/success')
    })
})
