import {
    filterHistoryRows,
    isHistoryFilter,
    matchesHistoryFilter,
    matchesHistorySearch,
    normalizeSearchText,
} from '../historyFilters.utils'

const row = (overrides: Partial<Parameters<typeof matchesHistorySearch>[0]> = {}) => ({
    userName: 'bob',
    fullName: 'Bob Carter',
    showFullName: true,
    memo: 'Rent share',
    amount: 120,
    ...overrides,
})

describe('matchesHistoryFilter', () => {
    it('lets every row through on "all"', () => {
        expect(matchesHistoryFilter('bank_claim', 'all')).toBe(true)
    })

    it('groups the row types under the question a person asks', () => {
        expect(matchesHistoryFilter('refund', 'received')).toBe(true)
        expect(matchesHistoryFilter('card_pay', 'payments')).toBe(true)
        expect(matchesHistoryFilter('pay', 'payments')).toBe(true)
        expect(matchesHistoryFilter('bank_deposit', 'added')).toBe(true)
        expect(matchesHistoryFilter('bank_withdraw', 'withdrawn')).toBe(true)
        expect(matchesHistoryFilter('send', 'received')).toBe(false)
    })
})

describe('isHistoryFilter', () => {
    it('rejects a hand-edited ?type=', () => {
        expect(isHistoryFilter('payments')).toBe(true)
        expect(isHistoryFilter('bogus')).toBe(false)
        expect(isHistoryFilter(null)).toBe(false)
    })
})

describe('matchesHistorySearch', () => {
    it('matches everything on an empty or blank query', () => {
        expect(matchesHistorySearch(row(), '')).toBe(true)
        expect(matchesHistorySearch(row(), '   ')).toBe(true)
    })

    it('matches the username, full name and memo, ignoring case', () => {
        expect(matchesHistorySearch(row(), 'BOB')).toBe(true)
        expect(matchesHistorySearch(row(), 'carter')).toBe(true)
        expect(matchesHistorySearch(row(), 'rent')).toBe(true)
        expect(matchesHistorySearch(row(), 'alice')).toBe(false)
    })

    it('ignores accents on both sides', () => {
        expect(matchesHistorySearch(row({ memo: 'Envío a João' }), 'joao')).toBe(true)
        expect(normalizeSearchText('  Café ')).toBe('cafe')
    })

    it('needs every word to match, in any order', () => {
        expect(matchesHistorySearch(row({ memo: 'Envío a João' }), 'joao envio')).toBe(true)
        expect(matchesHistorySearch(row(), 'bob 120')).toBe(true)
        expect(matchesHistorySearch(row(), 'bob 999')).toBe(false)
    })

    it('matches the localized name the row shows', () => {
        expect(
            matchesHistorySearch(row({ userName: 'Bank Account' }), 'cuenta', { displayName: 'Cuenta bancaria' })
        ).toBe(true)
    })

    it('ignores a full name its owner hides', () => {
        expect(matchesHistorySearch(row({ showFullName: false }), 'carter')).toBe(false)
        expect(matchesHistorySearch(row({ showFullName: false }), 'bob')).toBe(true)
    })

    it('does not match amounts while balances are hidden', () => {
        expect(matchesHistorySearch(row(), '120', { matchAmounts: false })).toBe(false)
        expect(matchesHistorySearch(row(), 'rent', { matchAmounts: false })).toBe(true)
    })

    it('matches the local currency code and amount', () => {
        const ars = row({ amount: 41.32, currency: { amount: '50000', code: 'ARS' } })
        expect(matchesHistorySearch(ars, 'ars')).toBe(true)
        expect(matchesHistorySearch(ars, '50000')).toBe(true)
        expect(matchesHistorySearch(ars, '41.32')).toBe(true)
        expect(matchesHistorySearch(ars, '41,3')).toBe(true)
    })

    it('matches amounts as typed, with or without cents or a dollar sign', () => {
        expect(matchesHistorySearch(row(), '120')).toBe(true)
        expect(matchesHistorySearch(row(), '$120.00')).toBe(true)
        expect(matchesHistorySearch(row(), '121')).toBe(false)
    })
})

describe('filterHistoryRows', () => {
    type Row = { id: string; type?: 'send' | 'pay'; name?: string }
    const rows: Row[] = [
        { id: 'badge' },
        { id: 'a', type: 'send', name: 'bob' },
        { id: 'b', type: 'pay', name: 'cafe' },
    ]
    const toSearchable = (r: Row) =>
        r.type ? { type: r.type, details: { userName: r.name ?? '', fullName: '', amount: 10 } } : null

    it('drops timeline markers under any filter', () => {
        expect(filterHistoryRows(rows, toSearchable, 'all', 'a').visible.map((r) => r.id)).toEqual(['b'])
    })

    it('applies the pill and the search together', () => {
        expect(filterHistoryRows(rows, toSearchable, 'payments', 'cafe').visible.map((r) => r.id)).toEqual(['b'])
        expect(filterHistoryRows(rows, toSearchable, 'payments', 'bob').visible).toEqual([])
    })

    it('says whether the search alone would find rows when the pill comes up empty', () => {
        expect(filterHistoryRows(rows, toSearchable, 'payments', 'bob').hasMatchesInAll).toBe(true)
        expect(filterHistoryRows(rows, toSearchable, 'payments', 'zz').hasMatchesInAll).toBe(false)
    })
})
