import { DEMO_BALANCE_UNITS } from '@/constants/demo-data'

const KEY = 'peanut_demo_balance_units'
const TS_KEY = 'peanut_demo_balance_ts'
const TTL_MS = 7 * 24 * 60 * 60 * 1000

// Demo balance lives in module-level state, so each test loads a fresh module
// instance to simulate a cold app start while localStorage (jsdom global)
// persists across loads — exactly the on-device relaunch semantics.
function coldStart() {
    let mod!: typeof import('@/utils/demo-balance')
    jest.isolateModules(() => {
        mod = require('@/utils/demo-balance')
    })
    return mod
}

describe('demo-balance — per-device persisted wallet', () => {
    afterEach(() => {
        window.localStorage.clear()
    })

    it('starts at the full balance on a fresh install and stamps a timestamp', () => {
        const { getDemoBalanceUnits } = coldStart()
        expect(getDemoBalanceUnits()).toBe(DEMO_BALANCE_UNITS)
        expect(window.localStorage.getItem(TS_KEY)).not.toBeNull()
    })

    it('debits and floors at zero', () => {
        const { getDemoBalanceUnits, debitDemoBalance } = coldStart()
        debitDemoBalance(DEMO_BALANCE_UNITS - 1n)
        expect(getDemoBalanceUnits()).toBe(1n)
        debitDemoBalance(1_000_000n) // overspend
        expect(getDemoBalanceUnits()).toBe(0n)
    })

    it('keeps a spent-down balance across a cold start within the TTL', () => {
        window.localStorage.setItem(KEY, '5')
        window.localStorage.setItem(TS_KEY, Date.now().toString())
        const { getDemoBalanceUnits } = coldStart()
        expect(getDemoBalanceUnits()).toBe(5n)
    })

    it('auto-refills a wallet older than the TTL on cold start', () => {
        window.localStorage.setItem(KEY, '0')
        window.localStorage.setItem(TS_KEY, (Date.now() - TTL_MS - 1_000).toString())
        const { getDemoBalanceUnits } = coldStart()
        expect(getDemoBalanceUnits()).toBe(DEMO_BALANCE_UNITS)
    })

    it('auto-refills a stored balance that has no timestamp (legacy install)', () => {
        window.localStorage.setItem(KEY, '0')
        const { getDemoBalanceUnits } = coldStart()
        expect(getDemoBalanceUnits()).toBe(DEMO_BALANCE_UNITS)
    })

    it('resetDemoBalance refills and restarts the TTL window', () => {
        window.localStorage.setItem(KEY, '0')
        window.localStorage.setItem(TS_KEY, Date.now().toString())
        const { getDemoBalanceUnits, resetDemoBalance } = coldStart()
        expect(getDemoBalanceUnits()).toBe(0n)
        resetDemoBalance()
        expect(getDemoBalanceUnits()).toBe(DEMO_BALANCE_UNITS)
        expect(Number(window.localStorage.getItem(TS_KEY))).toBeGreaterThan(0)
    })
})
