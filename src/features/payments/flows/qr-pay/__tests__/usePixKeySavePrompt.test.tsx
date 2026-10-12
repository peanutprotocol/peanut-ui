import { act, renderHook, waitFor } from '@testing-library/react'
import { usePixKeySavePrompt } from '../usePixKeySavePrompt'
import { mantecaApi } from '@/services/manteca'

jest.mock('@/services/manteca', () => ({ mantecaApi: { savePixKey: jest.fn() } }))
const mockFetchUser = jest.fn()
let mockAccounts: Array<{ type: string; identifier: string }> | undefined = []
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
    it('offers to save a key the user has not saved, named after its owner', () => {
        const { result } = renderHook(() => usePixKeySavePrompt(KEY, 'MARIA DA SILVA'))

        expect(result.current.isOffered).toBe(true)
        expect(result.current.nickname).toBe('MARIA DA SILVA')
    })

    it('shortens a long owner name to the first name', () => {
        const { result } = renderHook(() => usePixKeySavePrompt(KEY, 'Arthur de Jesus Lima Alvino Pereira'))

        expect(result.current.nickname).toBe('Arthur')
    })

    it('is not offered for a key already in the address book, or for a merchant QR', () => {
        mockAccounts = [{ type: 'manteca', identifier: 'Maria@Silva.com.br' }]
        expect(renderHook(() => usePixKeySavePrompt(KEY, 'MARIA DA SILVA')).result.current.isOffered).toBe(false)
        expect(renderHook(() => usePixKeySavePrompt(null, undefined)).result.current.isOffered).toBe(false)
    })

    it('is not offered until the account list has loaded', () => {
        mockAccounts = undefined
        expect(renderHook(() => usePixKeySavePrompt(KEY, 'MARIA DA SILVA')).result.current.isOffered).toBe(false)
    })

    it('saves once, however often a success is reported', () => {
        const { result } = renderHook(() => usePixKeySavePrompt(KEY, 'MARIA DA SILVA'))
        act(() => result.current.setChecked(true))

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

    it('saves the key with the trimmed name only when the box is ticked, then refreshes the account list', async () => {
        const { result } = renderHook(() => usePixKeySavePrompt(KEY, 'MARIA DA SILVA'))

        act(() => result.current.saveAfterPayment())
        expect(mockSavePixKey).not.toHaveBeenCalled()

        act(() => {
            result.current.setChecked(true)
            result.current.setNickname('  Maria  ')
        })
        act(() => result.current.saveAfterPayment())

        expect(mockSavePixKey).toHaveBeenCalledWith(KEY, 'Maria')
        await waitFor(() => expect(mockFetchUser).toHaveBeenCalledTimes(1))
    })

    it('never throws when the save fails, so the payment goes on', async () => {
        mockSavePixKey.mockRejectedValue(new Error('network'))
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
        const { result } = renderHook(() => usePixKeySavePrompt(KEY, 'MARIA DA SILVA'))
        act(() => result.current.setChecked(true))

        expect(() => act(() => result.current.saveAfterPayment())).not.toThrow()
        await waitFor(() => expect(consoleError).toHaveBeenCalled())
        expect(mockFetchUser).not.toHaveBeenCalled()
        consoleError.mockRestore()
    })
})
