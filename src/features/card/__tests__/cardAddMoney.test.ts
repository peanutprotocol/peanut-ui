import { cardBankPlan, cardCryptoAskUsd, cardGapUsd, CARD_MIN_BALANCE_USD } from '../cardAddMoney'
import type { GateState } from '@/utils/capability-gate'
import type { DepositCorridor } from '@/features/deposit-accounts/types'
import { DEPOSIT_RAIL_ORDER } from '@/features/deposit-accounts/rails'

const gates = (kind: GateState['kind'], overrides: Partial<Record<DepositCorridor, GateState>> = {}) =>
    Object.fromEntries(
        DEPOSIT_RAIL_ORDER.map((corridor) => [corridor, overrides[corridor] ?? ({ kind } as GateState)])
    ) as Record<DepositCorridor, GateState>

const noneReady = { account: [], transfer: [], pix: [], ars: [] }

describe('cardGapUsd', () => {
    it('is the missing amount to the card minimum, rounded up to the cent', () => {
        expect(CARD_MIN_BALANCE_USD).toBe(10)
        expect(cardGapUsd(3.2)).toBe(6.8)
        expect(cardGapUsd(0)).toBe(10)
        // rounding down would leave the user a fraction of a cent short
        expect(cardGapUsd(3.204)).toBe(6.8)
        expect(cardGapUsd(3.206)).toBe(6.8)
        expect(cardGapUsd(9.999)).toBe(0.01)
    })

    it('is zero once the balance covers the minimum, and unknown while the balance loads', () => {
        expect(cardGapUsd(10)).toBe(0)
        expect(cardGapUsd(25)).toBe(0)
        expect(cardGapUsd(undefined)).toBeUndefined()
    })
})

describe('cardCryptoAskUsd', () => {
    it('asks for the gap when the network minimum is lower', () => {
        expect(cardCryptoAskUsd(6.8, 1)).toEqual({ askUsd: 6.8, raisedToMinimum: false })
    })

    it('asks for the network minimum when the gap is below it (Rhino never bridges a deposit under it)', () => {
        expect(cardCryptoAskUsd(6.8, 10)).toEqual({ askUsd: 10, raisedToMinimum: true })
    })

    it('treats an equal gap and minimum as the gap', () => {
        expect(cardCryptoAskUsd(10, 10)).toEqual({ askUsd: 10, raisedToMinimum: false })
    })
})

describe('cardBankPlan', () => {
    const base = { isLoading: false, residenceIso2s: ['US'], ready: noneReady, topUpGates: gates('needs-identity') }

    it('waits while readiness loads', () => {
        expect(cardBankPlan({ ...base, isLoading: true })).toEqual({ kind: 'loading' })
        expect(cardBankPlan({ ...base, topUpGates: gates('loading') })).toEqual({ kind: 'loading' })
    })

    it('lists one held account as one row: the drawer shows its details', () => {
        expect(
            cardBankPlan({ ...base, ready: { ...noneReady, account: ['USD'] }, topUpGates: gates('ready') })
        ).toEqual({ kind: 'rows', rows: [{ kind: 'account', corridor: 'ACH_US' }] })
    })

    it('puts ARS and Pix first, then accounts and one-time transfers in the rail order, without a duplicate', () => {
        const plan = cardBankPlan({
            ...base,
            residenceIso2s: ['AR'],
            ready: { account: ['USD', 'EUR'], transfer: ['EUR', 'MXN'], pix: ['BRL'], ars: ['ARS'] },
            topUpGates: gates('ready'),
        })
        expect(plan).toEqual({
            kind: 'rows',
            rows: [
                { kind: 'page', corridor: 'BANK_TRANSFER_AR' },
                { kind: 'page', corridor: 'PIX_BR' },
                { kind: 'account', corridor: 'SEPA_EU' },
                { kind: 'account', corridor: 'ACH_US' },
                { kind: 'page', corridor: 'SPEI_MX' },
            ],
        })
    })

    it('says setting up when a rail is being opened and nothing is ready', () => {
        expect(
            cardBankPlan({
                ...base,
                residenceIso2s: ['AR'],
                topUpGates: gates('needs-enrollment', { BANK_TRANSFER_AR: { kind: 'pending' } }),
            })
        ).toEqual({ kind: 'setting-up', corridor: 'BANK_TRANSFER_AR' })
    })

    it('says under review when a provider reviews the user', () => {
        expect(
            cardBankPlan({
                ...base,
                topUpGates: gates('needs-identity', {
                    ACH_US: { kind: 'waiting-on-provider', userMessage: null },
                }),
            })
        ).toEqual({ kind: 'under-review' })
    })

    it('offers verification to a user who is not verified', () => {
        expect(cardBankPlan(base)).toEqual({ kind: 'not-verified' })
    })

    it('sends a verified user with a step left (terms, enrollment, a fix) to the bank page', () => {
        expect(
            cardBankPlan({ ...base, topUpGates: gates('blocked-rejection', { ACH_US: { kind: 'needs-enrollment' } }) })
        ).toEqual({
            kind: 'finish-setup',
        })
        expect(
            cardBankPlan({
                ...base,
                topUpGates: gates('blocked-rejection', { SEPA_EU: { kind: 'accept-tos', userMessage: null } }),
            })
        ).toEqual({ kind: 'finish-setup' })
    })

    it('says not offered when every rail is refused', () => {
        expect(cardBankPlan({ ...base, topUpGates: gates('blocked-rejection') })).toEqual({ kind: 'not-offered' })
    })

    it('ignores a rail the residence rules out', () => {
        // a US resident's Argentine rail being set up says nothing about their bank options
        expect(
            cardBankPlan({
                ...base,
                topUpGates: gates('blocked-rejection', { BANK_TRANSFER_AR: { kind: 'pending' } }),
            })
        ).toEqual({ kind: 'not-offered' })
    })

    it('prefers setting up over verification, and review over verification', () => {
        expect(cardBankPlan({ ...base, topUpGates: gates('needs-identity', { ACH_US: { kind: 'pending' } }) })).toEqual(
            { kind: 'setting-up', corridor: 'ACH_US' }
        )
    })
})
