import { DEFAULT_KILL_SWITCHES, KILL_SWITCHES_STORAGE_KEY } from '../kill-switches.consts'

const mockApiFetch = jest.fn()
jest.mock('@/utils/api-fetch', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))

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
    localStorage.clear()
    mockApiFetch.mockReset()
})

describe('kill-switches store', () => {
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

    it('tells subscribers when the values change', async () => {
        respond(200, { enableFullMaintenance: true })
        const store = loadStore()
        const seen: boolean[] = []
        store.subscribeKillSwitches(() => seen.push(store.getKillSwitches().enableFullMaintenance))

        await store.refreshKillSwitches()

        expect(seen).toEqual([true])
    })
})
