import { updateUserById } from '@/app/actions/users'

jest.mock('@/app/actions/users', () => ({
    updateUserById: jest.fn(),
}))

const mockIsCapacitor = jest.fn()
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => mockIsCapacitor(),
}))

let mockPendingPick: string | null = null
jest.mock('../locale-store', () => ({
    pendingLocalePick: () => mockPendingPick,
    clearPendingLocalePick: () => {
        mockPendingPick = null
    },
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
    const mockUpdate = updateUserById as jest.MockedFunction<typeof updateUserById>

    beforeEach(() => {
        localStorage.clear()
        mockPendingPick = null
        mockIsCapacitor.mockReturnValue(false)
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

        it('sends again on a new start, even with a web marker in storage', async () => {
            localStorage.setItem('app-locale-synced', 'u1:pt-BR')
            startApp()('u1', 'pt-BR')
            await flush()
            startApp()('u1', 'pt-BR')
            await flush()
            expect(mockUpdate).toHaveBeenCalledTimes(2)
        })

        // LocaleSync runs twice on a cold start, before the first request returns
        it('sends once for two calls in one start and again after a switch', async () => {
            const sync = startApp()
            sync('u1', 'pt-BR')
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
        it('sends browser and dedupes the repeat across starts', async () => {
            startApp()('u1', 'pt-BR')
            await flush()
            expect(mockUpdate).toHaveBeenCalledWith({ userId: 'u1', locale: 'pt-BR', localeSource: 'browser' })

            startApp()('u1', 'pt-BR')
            await flush()
            expect(mockUpdate).toHaveBeenCalledTimes(1)
        })

        // a pick made signed out, or before a reload, is only sent after sign-in
        it('sends a pending pick even when the locale already synced, then clears it', async () => {
            localStorage.setItem('app-locale-synced', 'u1:pt-BR')
            mockPendingPick = 'pt-BR'
            startApp()('u1', 'pt-BR')
            await flush()
            expect(mockUpdate).toHaveBeenCalledWith({ userId: 'u1', locale: 'pt-BR', localeSource: 'pick' })
            expect(mockPendingPick).toBeNull()
        })

        it('sends browser when the pending pick is for another locale', async () => {
            mockPendingPick = 'es-AR'
            startApp()('u1', 'pt-BR')
            await flush()
            expect(mockUpdate).toHaveBeenCalledWith({ userId: 'u1', locale: 'pt-BR', localeSource: 'browser' })
            expect(mockPendingPick).toBe('es-AR')
        })

        it('keeps a newer pick made while the request ran', async () => {
            mockPendingPick = 'pt-BR'
            startApp()('u1', 'pt-BR')
            mockPendingPick = 'es-AR'
            await flush()
            expect(mockPendingPick).toBe('es-AR')
        })

        it('keeps the pick pending after a failed write and sends it again', async () => {
            mockUpdate.mockResolvedValueOnce({ error: 'nope' })
            mockPendingPick = 'pt-BR'
            const sync = startApp()
            sync('u1', 'pt-BR')
            await flush()
            expect(mockPendingPick).toBe('pt-BR')

            sync('u1', 'pt-BR')
            await flush()
            expect(mockUpdate).toHaveBeenCalledTimes(2)
            expect(mockUpdate).toHaveBeenLastCalledWith({ userId: 'u1', locale: 'pt-BR', localeSource: 'pick' })
            expect(mockPendingPick).toBeNull()
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
