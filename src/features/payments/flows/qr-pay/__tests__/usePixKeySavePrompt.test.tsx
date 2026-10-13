import { act, renderHook, waitFor } from '@testing-library/react'
import { usePixKeySavePrompt } from '../usePixKeySavePrompt'
import { mantecaApi } from '@/services/manteca'

jest.mock('@/services/manteca', () => ({ mantecaApi: { savePixKey: jest.fn() } }))
const mockFetchUser = jest.fn()
let mockAccounts:
    | Array<{ type: string; identifier: string; label?: string | null; details?: { countryName: string } }>
    | undefined = []
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockAccounts ? { accounts: mockAccounts } : null, fetchUser: mockFetchUser }),
}))

const mockSavePixKey = mantecaApi.savePixKey as jest.Mock
const KEY = 'maria@silva.com.br'

beforeEach(() => {
    jest.clearAllMocks()
    mockAccounts = []
    mockSavePixKey.mockResolvedValue(undefined)
})

describe('usePixKeySavePrompt', () => {
    it('offers to save a key the user has not saved, ticked and named after its owner', () => {
        const { result } = renderHook(() => usePixKeySavePrompt(KEY, 'MARIA DA SILVA'))

        expect(result.current.isOffered).toBe(true)
        expect(result.current.checked).toBe(true)
        expect(result.current.nickname).toBe('MARIA DA SILVA')
        expect(result.current.savedName).toBeNull()
    })

    it('starts unticked when the owner lookup gave no name, so Pay is not held for one', () => {
        const { result } = renderHook(() => usePixKeySavePrompt(KEY, undefined))

        expect(result.current.isOffered).toBe(true)
        expect(result.current.checked).toBe(false)
        expect(result.current.blocksPay).toBe(false)
    })

    it('names a key the user already saved instead of offering it again', () => {
        mockAccounts = [
            { type: 'manteca', identifier: 'Maria@Silva.com.br', label: 'Maria', details: { countryName: 'brazil' } },
        ]
        const { result } = renderHook(() => usePixKeySavePrompt(KEY, 'MARIA DA SILVA'))

        expect(result.current.isOffered).toBe(false)
        expect(result.current.savedName).toBe('Maria')
    })

    it('names a saved key the user never named after the key itself', () => {
        mockAccounts = [{ type: 'manteca', identifier: KEY, label: null, details: { countryName: 'brazil' } }]
        const { result } = renderHook(() => usePixKeySavePrompt(KEY, 'MARIA DA SILVA'))

        expect(result.current.savedName).toMatch(/^PIX · /)
    })

    it('shortens a long owner name to the first name', () => {
        const { result } = renderHook(() => usePixKeySavePrompt(KEY, 'Arthur de Jesus Lima Alvino Pereira'))

        expect(result.current.nickname).toBe('Arthur')
    })

    it('is neither offered nor named for a merchant QR', () => {
        mockAccounts = [{ type: 'manteca', identifier: 'Maria@Silva.com.br', label: 'Maria' }]
        const { result } = renderHook(() => usePixKeySavePrompt(null, undefined))

        expect(result.current.isOffered).toBe(false)
        expect(result.current.savedName).toBeNull()
    })

    it('is not offered until the account list has loaded', () => {
        mockAccounts = undefined
        expect(renderHook(() => usePixKeySavePrompt(KEY, 'MARIA DA SILVA')).result.current.isOffered).toBe(false)
    })

    it('saves once, however often a success is reported', () => {
        const { result } = renderHook(() => usePixKeySavePrompt(KEY, 'MARIA DA SILVA'))

        act(() => result.current.saveAfterPayment())
        act(() => result.current.saveAfterPayment())

        expect(mockSavePixKey).toHaveBeenCalledTimes(1)
    })

    it('holds Pay while the box is ticked and the name is blank', () => {
        const { result } = renderHook(() => usePixKeySavePrompt(KEY, undefined))

        act(() => result.current.setChecked(true))
        expect(result.current.blocksPay).toBe(true)

        act(() => result.current.setNickname('Maria'))
        expect(result.current.blocksPay).toBe(false)
    })

    it('saves nothing once the user unticks the box', () => {
        const { result } = renderHook(() => usePixKeySavePrompt(KEY, 'MARIA DA SILVA'))

        act(() => result.current.setChecked(false))
        act(() => result.current.saveAfterPayment())

        expect(mockSavePixKey).not.toHaveBeenCalled()
    })

    it('saves the key with the trimmed name, then refreshes the account list', async () => {
        const { result } = renderHook(() => usePixKeySavePrompt(KEY, 'MARIA DA SILVA'))

        act(() => result.current.setNickname('  Maria  '))
        act(() => result.current.saveAfterPayment())

        expect(mockSavePixKey).toHaveBeenCalledWith(KEY, 'Maria')
        await waitFor(() => expect(mockFetchUser).toHaveBeenCalledTimes(1))
    })

    it('never throws when the save fails, so the payment goes on', async () => {
        mockSavePixKey.mockRejectedValue(new Error('network'))
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
        const { result } = renderHook(() => usePixKeySavePrompt(KEY, 'MARIA DA SILVA'))

        expect(() => act(() => result.current.saveAfterPayment())).not.toThrow()
        await waitFor(() => expect(consoleError).toHaveBeenCalled())
        expect(mockFetchUser).not.toHaveBeenCalled()
        consoleError.mockRestore()
    })
})
