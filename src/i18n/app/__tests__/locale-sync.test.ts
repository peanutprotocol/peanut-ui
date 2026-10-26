import { updateUserById } from '@/app/actions/users'

jest.mock('@/app/actions/users', () => ({
    updateUserById: jest.fn(),
}))

const mockIsCapacitor = jest.fn()
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => mockIsCapacitor(),
}))

const mockChosen = jest.fn()
jest.mock('../locale-store', () => ({
    isLocaleExplicitlyChosen: () => mockChosen(),
}))

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

type SyncFn = typeof import('../locale-sync').syncLocaleToBackend

// A fresh module copy has no in-memory state, like a new app start; localStorage survives.
function startApp(): SyncFn {
    let sync!: SyncFn
    jest.isolateModules(() => {
        sync = require('../locale-sync').syncLocaleToBackend
    })
    return sync
}

describe('syncLocaleToBackend', () => {
    let mockUpdate: jest.MockedFunction<typeof updateUserById>

    beforeEach(() => {
        localStorage.clear()
        mockIsCapacitor.mockReturnValue(false)
        mockChosen.mockReturnValue(false)
        mockUpdate = updateUserById as jest.MockedFunction<typeof updateUserById>
        mockUpdate.mockReset()
        mockUpdate.mockResolvedValue({ data: {} as never })
    })

    describe('native', () => {
        beforeEach(() => mockIsCapacitor.mockReturnValue(true))

        it('sends the device source', async () => {
            startApp()('u1', 'pt-BR')
            await flush()
            expect(mockUpdate).toHaveBeenCalledWith({ userId: 'u1', locale: 'pt-BR', localeSource: 'device' })
        })

        it('sends again on a new start, even with a web-style marker in storage', async () => {
            localStorage.setItem('app-locale-synced', 'u1:pt-BR')
            startApp()('u1', 'pt-BR')
            await flush()
            startApp()('u1', 'pt-BR')
            await flush()
            expect(mockUpdate).toHaveBeenCalledTimes(2)
        })

        it('dedupes a repeat within one start and sends again after a switch', async () => {
            const sync = startApp()
            sync('u1', 'pt-BR')
            await flush()
            sync('u1', 'pt-BR')
            await flush()
            expect(mockUpdate).toHaveBeenCalledTimes(1)

            sync('u1', 'es-AR')
            await flush()
            expect(mockUpdate).toHaveBeenCalledTimes(2)
            expect(mockUpdate).toHaveBeenLastCalledWith({ userId: 'u1', locale: 'es-AR', localeSource: 'device' })
        })

        it('retries after a failed write', async () => {
            const sync = startApp()
            mockUpdate.mockResolvedValueOnce({ error: 'nope' })
            sync('u1', 'pt-BR')
            await flush()
            sync('u1', 'pt-BR')
            await flush()
            expect(mockUpdate).toHaveBeenCalledTimes(2)
        })
    })

    describe('web', () => {
        it('sends browser at startup and dedupes the repeat', async () => {
            const sync = startApp()
            sync('u1', 'pt-BR')
            await flush()
            expect(mockUpdate).toHaveBeenCalledWith({ userId: 'u1', locale: 'pt-BR', localeSource: 'browser' })

            sync('u1', 'pt-BR')
            await flush()
            expect(mockUpdate).toHaveBeenCalledTimes(1)
        })

        it('sends pick for the same locale after an explicit choice', async () => {
            const sync = startApp()
            sync('u1', 'pt-BR')
            await flush()
            mockChosen.mockReturnValue(true)
            sync('u1', 'pt-BR')
            await flush()
            expect(mockUpdate).toHaveBeenCalledTimes(2)
            expect(mockUpdate).toHaveBeenLastCalledWith({ userId: 'u1', locale: 'pt-BR', localeSource: 'pick' })
        })

        it('re-syncs when the locale or user changes', async () => {
            const sync = startApp()
            sync('u1', 'pt-BR')
            await flush()
            sync('u1', 'es-AR')
            await flush()
            sync('u2', 'es-AR')
            await flush()
            expect(mockUpdate).toHaveBeenCalledTimes(3)
            expect(mockUpdate).toHaveBeenLastCalledWith({ userId: 'u2', locale: 'es-AR', localeSource: 'browser' })
        })

        it('retries after a failed write (no synced marker stored)', async () => {
            const sync = startApp()
            mockUpdate.mockResolvedValueOnce({ error: 'nope' })
            sync('u1', 'pt-BR')
            await flush()
            sync('u1', 'pt-BR')
            await flush()
            expect(mockUpdate).toHaveBeenCalledTimes(2)
        })
    })
})
