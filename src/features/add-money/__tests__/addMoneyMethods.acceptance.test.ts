import { resolveAddMoneyMethods } from '../addMoneyMethods'

type Input = Parameters<typeof resolveAddMoneyMethods>[0]

const baseline: Input = {
    cryptoReady: true,
    standingEnabled: true,
    brazilPaused: false,
    residenceIso2s: [],
    activeAccounts: [],
    readyTopUps: [],
}

const resolve = (overrides: Partial<Input> = {}) => resolveAddMoneyMethods({ ...baseline, ...overrides })

describe('resolveAddMoneyMethods', () => {
    it('keeps the picker for a first-time user with Crypto as the only usable method', () => {
        expect(resolve({ firstPaymentAt: null })).toMatchObject({
            entry: 'picker',
            ready: { account: [], transfer: [], pix: [] },
        })
    })

    it('shows Crypto and More ways after a successful outgoing payment', () => {
        expect(resolve({ firstPaymentAt: '2026-01-01T00:00:00Z' })).toEqual({
            entry: 'drawer',
            ready: { account: [], transfer: [], pix: [] },
            drawerMethods: ['crypto', 'more'],
            pickerMethods: ['account', 'transfer', 'pix', 'crypto'],
        })
    })

    it('keeps the picker after a successful outgoing payment when nothing is usable', () => {
        expect(
            resolve({
                firstPaymentAt: '2026-01-01T00:00:00Z',
                cryptoReady: false,
            })
        ).toMatchObject({
            entry: 'picker',
            ready: { account: [], transfer: [], pix: [] },
        })
    })

    it('keeps a ready existing standing account usable when new accounts are disabled', () => {
        const result = resolve({
            standingEnabled: false,
            cryptoReady: false,
            activeAccounts: ['USD', 'USD', 'COP', 'ARS', 'unknown', ''],
        })
        expect(result).toMatchObject({
            entry: 'drawer',
            ready: { account: ['USD', 'COP'], transfer: [], pix: [] },
            pickerMethods: ['account', 'transfer', 'pix', 'crypto'],
        })
        expect(new Set(result.drawerMethods)).toEqual(new Set(['account', 'more']))
        expect(result.drawerMethods).toHaveLength(2)
    })

    it('omits Account from the picker when opening is disabled and no usable account exists', () => {
        expect(resolve({ standingEnabled: false, activeAccounts: ['ARS', 'unknown'] })).toMatchObject({
            entry: 'picker',
            pickerMethods: ['transfer', 'pix', 'crypto'],
        })
    })

    it('deduplicates ready bank transfers and drops unsupported and malformed corridors', () => {
        const result = resolve({
            cryptoReady: false,
            readyTopUps: ['USD', 'USD', 'COP', 'ARS', 'BRL', '', 'not-a-corridor'],
        })
        expect(result).toMatchObject({
            entry: 'drawer',
            ready: { account: [], transfer: ['USD'], pix: [] },
        })
        expect(new Set(result.drawerMethods)).toEqual(new Set(['transfer', 'more']))
        expect(result.drawerMethods).toHaveLength(2)
    })

    it('makes ARS transfers available to an Argentine resident', () => {
        expect(resolve({ residenceIso2s: ['AR'], readyTopUps: ['ARS'] })).toMatchObject({
            entry: 'drawer',
            ready: { account: [], transfer: ['ARS'], pix: [] },
        })
    })

    it('lists Pix separately from bank transfers for a Brazilian resident', () => {
        const result = resolve({
            residenceIso2s: ['BR'],
            readyTopUps: ['BRL', 'BRL'],
        })
        expect(result).toMatchObject({
            entry: 'drawer',
            ready: { account: [], transfer: [], pix: ['BRL'] },
        })
        expect(new Set(result.drawerMethods)).toEqual(new Set(['pix', 'crypto', 'more']))
        expect(result.drawerMethods).toHaveLength(3)
    })

    it('puts Pix first when the API offers a Pix deposit route, whichever provider serves it', () => {
        const result = resolve({ residenceIso2s: ['BR'], readyTopUps: ['USD'], pixRouteOpen: true })
        expect(result.ready.pix).toEqual(['BRL'])
        expect(result.drawerMethods[0]).toBe('pix')
        expect(resolve({ residenceIso2s: ['BR'], pixRouteOpen: true, brazilPaused: true }).ready.pix).toEqual([])
    })

    it('drops ready Pix when Brazil is paused without hiding an unrelated ready transfer', () => {
        const result = resolve({
            brazilPaused: true,
            residenceIso2s: ['BR'],
            readyTopUps: ['BRL', 'USD'],
        })
        expect(result).toMatchObject({
            entry: 'drawer',
            ready: { account: [], transfer: ['USD'], pix: [] },
        })
        expect(new Set(result.drawerMethods)).toEqual(new Set(['transfer', 'crypto', 'more']))
        expect(result.drawerMethods).toHaveLength(3)
    })

    it('does not activate Pix for a Brazilian resident without an exact ready Pix rail', () => {
        expect(resolve({ residenceIso2s: ['BR'] })).toMatchObject({
            entry: 'picker',
            ready: { account: [], transfer: [], pix: [] },
        })
    })
})
