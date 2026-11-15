import { DEFAULT_KILL_SWITCHES, KILL_SWITCHES_STORAGE_KEY } from '../kill-switches.consts'
import { maintenanceRedirectTarget } from '../kill-switches.utils'

const mockApiFetch = jest.fn()
let mockNative = false
let mockAppState: ((state: { isActive: boolean }) => void) | undefined
jest.mock('@/utils/api-fetch', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => mockNative }))
jest.mock('@capacitor/app', () => ({
    App: {
        addListener: (_name: string, listener: NonNullable<typeof mockAppState>) => {
            mockAppState = listener
        },
    },
}))

type Store = typeof import('../kill-switches-store')

// a fresh module per test: the store reads the saved values once, at load
const loadStore = (): Store => {
    let store: Store | undefined
    jest.isolateModules(() => {
        store = require('../kill-switches-store')
    })
    return store!
}

const respond = (status: number, body: unknown) =>
    mockApiFetch.mockResolvedValueOnce({ ok: status >= 200 && status < 300, status, json: async () => body })

const saved = () => JSON.parse(localStorage.getItem(KILL_SWITCHES_STORAGE_KEY) ?? 'null')

beforeEach(() => {
    mockNative = false
    mockAppState = undefined
    localStorage.clear()
    mockApiFetch.mockReset()
})

describe('kill-switches store', () => {
    it('refreshes and persists two switches independently across reloads', async () => {
        localStorage.setItem(
            KILL_SWITCHES_STORAGE_KEY,
            JSON.stringify({ kycVerificationDown: true, pixBrazilOnrampMaintenance: false })
        )
        const store = loadStore()
        expect(store.getKillSwitches()).toEqual({ ...DEFAULT_KILL_SWITCHES, kycVerificationDown: true })

        const server = { kycVerificationDown: false, pixBrazilOnrampMaintenance: true }
        respond(200, server)
        await store.refreshKillSwitches()

        expect(store.getKillSwitches()).toEqual({ ...DEFAULT_KILL_SWITCHES, ...server })
        expect(saved()).toEqual(server)
        expect(loadStore().getKillSwitches()).toEqual({ ...DEFAULT_KILL_SWITCHES, ...server })
    })

    it('applies the server values and saves them after a good fetch', async () => {
        respond(200, { enableMaintenanceBanner: true, disabledMantecaCurrencies: ['ARS'] })
        const store = loadStore()
        await store.refreshKillSwitches()

        expect(store.getKillSwitches()).toEqual({
            ...DEFAULT_KILL_SWITCHES,
            enableMaintenanceBanner: true,
            disabledMantecaCurrencies: ['ARS'],
        })
        expect(saved()).toEqual({ enableMaintenanceBanner: true, disabledMantecaCurrencies: ['ARS'] })
    })

    it('uses the saved values before the first fetch and keeps them when the fetch fails', async () => {
        localStorage.setItem(KILL_SWITCHES_STORAGE_KEY, JSON.stringify({ disableXchainWithdraw: true }))
        mockApiFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))
        const store = loadStore()
        expect(store.getKillSwitches().disableXchainWithdraw).toBe(true)

        await store.refreshKillSwitches()

        expect(store.getKillSwitches()).toEqual({ ...DEFAULT_KILL_SWITCHES, disableXchainWithdraw: true })
        expect(saved()).toEqual({ disableXchainWithdraw: true })
    })

    it('keeps the defaults when nothing is saved and the fetch fails', async () => {
        mockApiFetch.mockRejectedValueOnce(new Error('timeout'))
        const store = loadStore()
        await store.refreshKillSwitches()

        expect(store.getKillSwitches()).toEqual(DEFAULT_KILL_SWITCHES)
        expect(saved()).toBeNull()
    })

    it('keeps the defaults on a 404 (endpoint not deployed yet)', async () => {
        respond(404, { message: 'Not Found' })
        const store = loadStore()
        await store.refreshKillSwitches()

        expect(store.getKillSwitches()).toEqual(DEFAULT_KILL_SWITCHES)
        expect(saved()).toBeNull()
    })

    it('ignores saved values of the wrong type', () => {
        localStorage.setItem(
            KILL_SWITCHES_STORAGE_KEY,
            JSON.stringify({ enableFullMaintenance: 'yes', maintenanceBannerPaths: ['/withdraw'] })
        )
        expect(loadStore().getKillSwitches()).toEqual({
            ...DEFAULT_KILL_SWITCHES,
            maintenanceBannerPaths: ['/withdraw'],
        })
    })

    it('treats a key missing from a good answer as unset, not as the old saved value', async () => {
        localStorage.setItem(KILL_SWITCHES_STORAGE_KEY, JSON.stringify({ enableFullMaintenance: true }))
        respond(200, {})
        const store = loadStore()
        expect(store.getKillSwitches().enableFullMaintenance).toBe(true)

        await store.refreshKillSwitches()

        expect(store.getKillSwitches().enableFullMaintenance).toBe(false)
        expect(saved()).toEqual({})
    })

    it('keeps a reload on /maintenance there until the fetch answers, then leaves once it says off', async () => {
        localStorage.setItem(KILL_SWITCHES_STORAGE_KEY, JSON.stringify({ enableFullMaintenance: true }))
        let answer: (value: unknown) => void = () => {}
        mockApiFetch.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)))
        const store = loadStore()
        const target = () =>
            maintenanceRedirectTarget(
                '/maintenance',
                store.getKillSwitches().enableFullMaintenance,
                false,
                store.hasKillSwitchesAnswered()
            )

        const pending = store.refreshKillSwitches()
        expect(target()).toBeNull()

        answer({ ok: true, status: 200, json: async () => ({}) })
        await pending
        expect(target()).toBe('/home')
    })

    it('tells subscribers on the first answer even when the values are unchanged', async () => {
        respond(200, {})
        const store = loadStore()
        const listener = jest.fn()
        store.subscribeKillSwitches(listener)

        await store.refreshKillSwitches()

        expect(store.hasKillSwitchesAnswered()).toBe(true)
        expect(listener).toHaveBeenCalledTimes(1)
    })

    it('does not count a failed fetch as an answer', async () => {
        respond(404, {})
        const store = loadStore()
        await store.refreshKillSwitches()
        expect(store.hasKillSwitchesAnswered()).toBe(false)
    })

    it('tells subscribers when the values change', async () => {
        respond(200, { enableFullMaintenance: true })
        const store = loadStore()
        const seen: boolean[] = []
        store.subscribeKillSwitches(() => seen.push(store.getKillSwitches().enableFullMaintenance))

        await store.refreshKillSwitches()

        expect(seen).toEqual([true])
    })

    it('requires a current native foreground response and coalesces resumes behind a pending request', async () => {
        mockNative = true
        localStorage.setItem(KILL_SWITCHES_STORAGE_KEY, JSON.stringify({ appUpdateCutoffs: { android: '1' } }))
        const store = loadStore()
        expect(store.getNativeStoreUpdatePolicy()).toEqual({ foreground: null })
        let finishOld!: (value: unknown) => void
        let finishCurrent!: (value: unknown) => void
        mockApiFetch
            .mockImplementationOnce(() => new Promise((resolve) => (finishOld = resolve)))
            .mockImplementationOnce(() => new Promise((resolve) => (finishCurrent = resolve)))
        store.startKillSwitches()
        const old = store.refreshKillSwitches()
        await Promise.resolve()
        await Promise.resolve()
        expect(mockAppState).toBeDefined()
        expect(store.getNativeStoreUpdatePolicy()).toEqual({ foreground: 1 })

        mockAppState?.({ isActive: false })
        mockAppState?.({ isActive: true })
        mockAppState?.({ isActive: false })
        mockAppState?.({ isActive: true })
        mockAppState?.({ isActive: true })
        expect(store.getNativeStoreUpdatePolicy()).toEqual({ foreground: 3 })
        expect(mockApiFetch).toHaveBeenCalledTimes(1)

        finishOld({ ok: true, json: async () => ({ appUpdateCutoffs: { android: '2' } }) })
        await old
        expect(mockApiFetch).toHaveBeenCalledTimes(2)
        expect(store.getNativeStoreUpdatePolicy()).toEqual({ foreground: 3 })
        const current = store.refreshKillSwitches()
        finishCurrent({ ok: true, json: async () => ({ appUpdateCutoffs: {} }) })
        await current
        expect(store.getNativeStoreUpdatePolicy()).toEqual({ foreground: 3, cutoffs: {} })
        expect(saved()).toEqual({})

        mockAppState?.({ isActive: false })
        expect(store.getNativeStoreUpdatePolicy()).toEqual({ foreground: null })
        respond(503, {})
        mockAppState?.({ isActive: true })
        await store.refreshKillSwitches()
        expect(store.getNativeStoreUpdatePolicy()).toEqual({ foreground: 4 })

        respond(200, { appUpdateCutoffs: { android: '3' } })
        await store.refreshKillSwitches()
        expect(store.getNativeStoreUpdatePolicy()).toEqual({ foreground: 4, cutoffs: { android: '3' } })
        respond(200, { appUpdateCutoffs: { android: 'invalid' } })
        await store.refreshKillSwitches()
        expect(store.getNativeStoreUpdatePolicy()).toEqual({ foreground: 4 })
    })
})
