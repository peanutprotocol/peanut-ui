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
            pickerMethods: ['account', 'transfer', 'crypto'],
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
            pickerMethods: ['account', 'transfer', 'crypto'],
        })
        expect(new Set(result.drawerMethods)).toEqual(new Set(['account', 'more']))
        expect(result.drawerMethods).toHaveLength(2)
    })

    it('omits Account from the picker when opening is disabled and no usable account exists', () => {
        expect(resolve({ standingEnabled: false, activeAccounts: ['ARS', 'unknown'] })).toMatchObject({
            entry: 'picker',
            pickerMethods: ['transfer', 'crypto'],
        })
    })

    // The owner, 15 Nov: one rule for the Pix row on both lists, read from the Pix deposit route
    describe('the Pix row, on the picker and the drawer alike', () => {
        const returning = { firstPaymentAt: '2026-01-01T00:00:00Z' }

        it('a verified user outside Brazil, whose Manteca route waits for its first use, gets no Pix row', () => {
            const result = resolve({ ...returning, residenceIso2s: ['DE'], pixDepositRouteOpen: true })
            expect(result.pickerMethods).toEqual(['account', 'transfer', 'crypto'])
            expect(result.drawerMethods).not.toContain('pix')
        })

        it('a resident on Avenia’s route gets Pix first on both lists', () => {
            const result = resolve({
                ...returning,
                residenceIso2s: ['BR'],
                readyTopUps: ['USD'],
                pixDepositOffered: true,
                pixDepositRouteOpen: true,
            })
            expect(result.pickerMethods).toEqual(['pix', 'account', 'transfer', 'crypto'])
            expect(result.drawerMethods).toEqual(['pix', 'transfer', 'crypto', 'more'])
        })

        it('a ready Manteca Pix top-up shows after the bank methods on both lists', () => {
            const result = resolve({ ...returning, residenceIso2s: ['BR', 'US'], readyTopUps: ['BRL', 'USD'] })
            expect(result.pickerMethods).toEqual(['account', 'transfer', 'pix', 'crypto'])
            expect(result.drawerMethods).toEqual(['transfer', 'pix', 'crypto', 'more'])
        })

        it('a declared resident of Brazil with an open route gets the row, after the bank methods', () => {
            const result = resolve({ ...returning, residenceIso2s: ['BR'], pixDepositRouteOpen: true })
            expect(result.pickerMethods).toEqual(['account', 'transfer', 'pix', 'crypto'])
            expect(result.drawerMethods).toEqual(['pix', 'crypto', 'more'])
            // the row starts Pix; it does not make Pix ready
            expect(result.ready.pix).toEqual([])
        })

        it('a user with no residence on file gets no Pix row', () => {
            const result = resolve({ ...returning, residenceIso2s: [], pixDepositRouteOpen: true })
            expect(result.pickerMethods).not.toContain('pix')
            expect(result.drawerMethods).not.toContain('pix')
        })

        it('the Brazil pause gets no Pix row, even for a resident with a ready top-up', () => {
            const result = resolve({
                ...returning,
                residenceIso2s: ['BR'],
                readyTopUps: ['BRL'],
                brazilPaused: true,
                pixDepositRouteOpen: false,
            })
            expect(result.pickerMethods).not.toContain('pix')
            expect(result.drawerMethods).not.toContain('pix')
        })

        it('a refused route gets no Pix row for a resident of Brazil', () => {
            const result = resolve({ ...returning, residenceIso2s: ['BR'], pixDepositRouteOpen: false })
            expect(result.pickerMethods).not.toContain('pix')
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
            pixDepositOffered: true,
        })
        expect(result).toMatchObject({
            entry: 'drawer',
            ready: { account: [], transfer: [], pix: ['BRL'] },
        })
        expect(new Set(result.drawerMethods)).toEqual(new Set(['pix', 'crypto', 'more']))
        expect(result.drawerMethods).toHaveLength(3)
    })

    it('puts Pix first on a Pix deposit route on Avenia (Aleks, 2026-11-12 and 2026-11-14)', () => {
        const result = resolve({ residenceIso2s: ['BR'], readyTopUps: ['USD'], pixDepositOffered: true })
        expect(result.ready.pix).toEqual(['BRL'])
        expect(result.drawerMethods[0]).toBe('pix')
        expect(resolve({ residenceIso2s: ['BR'], pixDepositOffered: true, brazilPaused: true }).ready.pix).toEqual([])
    })

    // review finding 6: Pix leads only on Avenia, and a ready Pix top-up on another route (Manteca)
    // stays on the drawer as before Avenia: it can be the user's only ready fiat method
    it('keeps a ready Pix top-up off a route on Avenia on the drawer, after the bank methods', () => {
        const result = resolve({ residenceIso2s: ['BR'], readyTopUps: ['BRL'] })
        expect(result.ready.pix).toEqual(['BRL'])
        expect(result.drawerMethods).toEqual(['pix', 'crypto', 'more'])
        const withBank = resolve({ residenceIso2s: ['BR', 'US'], readyTopUps: ['BRL', 'USD'] })
        expect(withBank.drawerMethods).toEqual(['transfer', 'pix', 'crypto', 'more'])
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
