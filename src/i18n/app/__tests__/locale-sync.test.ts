import { syncLocaleToBackend } from '../locale-sync'
import { updateUserById } from '@/app/actions/users'

jest.mock('@/app/actions/users', () => ({
    updateUserById: jest.fn(),
}))

const mockUpdate = updateUserById as jest.MockedFunction<typeof updateUserById>

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('syncLocaleToBackend', () => {
    beforeEach(() => {
        localStorage.clear()
        mockUpdate.mockReset()
        mockUpdate.mockResolvedValue({ data: {} as never })
    })

    it('sends the locale once and dedupes repeats', async () => {
        syncLocaleToBackend('u1', 'pt-BR')
        await flush()
        expect(mockUpdate).toHaveBeenCalledWith({ userId: 'u1', locale: 'pt-BR' })

        syncLocaleToBackend('u1', 'pt-BR')
        await flush()
        expect(mockUpdate).toHaveBeenCalledTimes(1)
    })

    it('re-syncs when the locale or user changes', async () => {
        syncLocaleToBackend('u1', 'pt-BR')
        await flush()
        syncLocaleToBackend('u1', 'es-AR')
        await flush()
        syncLocaleToBackend('u2', 'es-AR')
        await flush()
        expect(mockUpdate).toHaveBeenCalledTimes(3)
        expect(mockUpdate).toHaveBeenLastCalledWith({ userId: 'u2', locale: 'es-AR' })
    })

    it('retries after a failed write (no synced marker stored)', async () => {
        mockUpdate.mockResolvedValueOnce({ error: 'nope' })
        syncLocaleToBackend('u1', 'pt-BR')
        await flush()

        syncLocaleToBackend('u1', 'pt-BR')
        await flush()
        expect(mockUpdate).toHaveBeenCalledTimes(2)
    })
})
