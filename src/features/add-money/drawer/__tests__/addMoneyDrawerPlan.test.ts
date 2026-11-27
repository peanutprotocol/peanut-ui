import { CARD_FUNDING_RETURN_TO, CARD_MIN_BALANCE_USD } from '@/features/card/cardAddMoney'
import { addMoneyGapUsd, bankPageHref, cryptoAskUsd, drawerBankPlan } from '../addMoneyDrawerPlan'
import type { GateState } from '@/utils/capability-gate'
import type { AddMoneyPickerMethod } from '@/features/add-money/addMoneyMethods'
import type { DepositCorridor } from '@/features/deposit-accounts/types'
import { DEPOSIT_RAIL_ORDER } from '@/features/deposit-accounts/rails'

const gates = (kind: GateState['kind'], overrides: Partial<Record<DepositCorridor, GateState>> = {}) =>
    Object.fromEntries(
        DEPOSIT_RAIL_ORDER.map((corridor) => [corridor, overrides[corridor] ?? ({ kind } as GateState)])
    ) as Record<DepositCorridor, GateState>

const noneReady = { account: [], transfer: [], pix: [], ars: [] }

// the card's $10 target is the first place the drawer serves
const cardGapUsd = (spendableUsd: number | undefined) => addMoneyGapUsd(CARD_MIN_BALANCE_USD, spendableUsd)

describe('addMoneyGapUsd', () => {
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

describe('cryptoAskUsd', () => {
    it('asks for the gap when the network minimum is lower', () => {
        expect(cryptoAskUsd(6.8, 1)).toEqual({ askUsd: 6.8, raisedToMinimum: false })
    })

    it('asks for the network minimum when the gap is below it (Rhino never bridges a deposit under it)', () => {
        expect(cryptoAskUsd(6.8, 10)).toEqual({ askUsd: 10, raisedToMinimum: true })
    })

    it('rounds a fractional minimum up to the cent, so the ask shown is never below it', () => {
        expect(cryptoAskUsd(2, 4.004)).toEqual({ askUsd: 4.01, raisedToMinimum: true })
    })

    it('treats an equal gap and minimum as the gap', () => {
        expect(cryptoAskUsd(10, 10)).toEqual({ askUsd: 10, raisedToMinimum: false })
    })
})

describe('drawerBankPlan', () => {
    const base = {
        isLoading: false,
        residenceIso2s: ['US'],
        ready: noneReady,
        topUpGates: gates('needs-identity'),
        pickerMethods: ['bank', 'crypto'] as AddMoneyPickerMethod[],
    }

    it('waits while readiness loads', () => {
        expect(drawerBankPlan({ ...base, isLoading: true })).toEqual({ kind: 'loading' })
        expect(drawerBankPlan({ ...base, topUpGates: gates('loading') })).toEqual({ kind: 'loading' })
    })

    it('lists one held account as one row: the drawer shows its details', () => {
        expect(
            drawerBankPlan({ ...base, ready: { ...noneReady, account: ['USD'] }, topUpGates: gates('ready') })
        ).toEqual({ kind: 'rows', rows: [{ kind: 'account', corridor: 'ACH_US' }] })
    })

    it('follows the Add money picker: ARS, leading Pix, accounts, transfers, then other Pix', () => {
        const ready = { account: ['USD', 'EUR'], transfer: ['EUR', 'MXN'], pix: ['BRL'], ars: ['ARS'] }
        const input = { ...base, residenceIso2s: ['AR'], ready, topUpGates: gates('ready') }
        expect(drawerBankPlan({ ...input, pickerMethods: ['ars', 'pix', 'bank', 'crypto'] })).toEqual({
            kind: 'rows',
            rows: [
                { kind: 'page', corridor: 'BANK_TRANSFER_AR' },
                { kind: 'page', corridor: 'PIX_BR' },
                { kind: 'account', corridor: 'SEPA_EU' },
                { kind: 'account', corridor: 'ACH_US' },
                { kind: 'page', corridor: 'SPEI_MX' },
            ],
        })
        expect(drawerBankPlan({ ...input, pickerMethods: ['ars', 'bank', 'pix', 'crypto'] })).toEqual({
            kind: 'rows',
            rows: [
                { kind: 'page', corridor: 'BANK_TRANSFER_AR' },
                { kind: 'account', corridor: 'SEPA_EU' },
                { kind: 'account', corridor: 'ACH_US' },
                { kind: 'page', corridor: 'SPEI_MX' },
                { kind: 'page', corridor: 'PIX_BR' },
            ],
        })
    })

    // TASK-25444: the picker shows ARS to a resident of Argentina, and Pix where the route offers it, before
    // a top-up is ready (their page takes the user through the step left), so the drawer does too
    it('lists ARS and Pix wherever the picker shows them, ready or not', () => {
        expect(drawerBankPlan({ ...base, residenceIso2s: ['AR'], pickerMethods: ['ars', 'bank', 'crypto'] })).toEqual({
            kind: 'rows',
            rows: [{ kind: 'page', corridor: 'BANK_TRANSFER_AR' }],
        })
        expect(drawerBankPlan({ ...base, residenceIso2s: ['BR'], pickerMethods: ['pix', 'bank', 'crypto'] })).toEqual({
            kind: 'rows',
            rows: [{ kind: 'page', corridor: 'PIX_BR' }],
        })
    })

    // the picker's bank row is `bank` (one row since Release 170.2): Pix before it leads the drawer too
    it('leads with Pix when it leads the picker', () => {
        const ready = { ...noneReady, transfer: ['USD'], pix: ['BRL'] }
        expect(
            drawerBankPlan({ ...base, ready, topUpGates: gates('ready'), pickerMethods: ['pix', 'bank', 'crypto'] })
        ).toEqual({
            kind: 'rows',
            rows: [
                { kind: 'page', corridor: 'PIX_BR' },
                { kind: 'page', corridor: 'ACH_US' },
            ],
        })
    })

    it('lists a held account before a one-time transfer of an earlier rail', () => {
        expect(
            drawerBankPlan({
                ...base,
                ready: { ...noneReady, account: ['USD'], transfer: ['EUR'] },
                topUpGates: gates('ready'),
            })
        ).toEqual({
            kind: 'rows',
            rows: [
                { kind: 'account', corridor: 'ACH_US' },
                { kind: 'page', corridor: 'SEPA_EU' },
            ],
        })
    })

    it('says setting up when a rail is being opened and nothing is ready', () => {
        expect(
            drawerBankPlan({
                ...base,
                residenceIso2s: ['AR'],
                topUpGates: gates('needs-enrollment', { BANK_TRANSFER_AR: { kind: 'pending' } }),
            })
        ).toEqual({ kind: 'setting-up', corridor: 'BANK_TRANSFER_AR' })
    })

    it('says under review when a provider reviews the user', () => {
        expect(
            drawerBankPlan({
                ...base,
                topUpGates: gates('needs-identity', {
                    ACH_US: { kind: 'waiting-on-provider', userMessage: null },
                }),
            })
        ).toEqual({ kind: 'under-review' })
    })

    it('says under review, never "verify again", while the identity check is in review', () => {
        expect(drawerBankPlan({ ...base, identityStatus: 'processing' })).toEqual({ kind: 'under-review' })
    })

    it('offers verification to a user who is not verified', () => {
        expect(drawerBankPlan(base)).toEqual({ kind: 'not-verified' })
    })

    it('sends a verified user with a step left (terms, enrollment, a fix) to the bank page', () => {
        expect(
            drawerBankPlan({
                ...base,
                topUpGates: gates('blocked-rejection', { ACH_US: { kind: 'needs-enrollment' } }),
            })
        ).toEqual({
            kind: 'finish-setup',
        })
        expect(
            drawerBankPlan({
                ...base,
                topUpGates: gates('blocked-rejection', { SEPA_EU: { kind: 'accept-tos', userMessage: null } }),
            })
        ).toEqual({ kind: 'finish-setup' })
    })

    it('says not offered when every rail is refused', () => {
        expect(drawerBankPlan({ ...base, topUpGates: gates('blocked-rejection') })).toEqual({ kind: 'not-offered' })
    })

    it('ignores a rail the residence rules out', () => {
        // a US resident's Argentine rail being set up says nothing about their bank options
        expect(
            drawerBankPlan({
                ...base,
                topUpGates: gates('blocked-rejection', { BANK_TRANSFER_AR: { kind: 'pending' } }),
            })
        ).toEqual({ kind: 'not-offered' })
    })

    it('prefers setting up over verification, and review over verification', () => {
        expect(
            drawerBankPlan({ ...base, topUpGates: gates('needs-identity', { ACH_US: { kind: 'pending' } }) })
        ).toEqual({ kind: 'setting-up', corridor: 'ACH_US' })
    })
})

describe('bankPageHref', () => {
    const back = 'returnTo=%2Fcard%3Fcard_step%3Dfunding'

    it('prefills the ARS flow with the dollar gap', () => {
        expect(bankPageHref('BANK_TRANSFER_AR', 7.5, ['AR'], CARD_FUNDING_RETURN_TO)).toBe(
            `/add-money/argentina/manteca?step=inputAmount&amount=7.50&currency=USD&${back}`
        )
    })

    it('opens Pix, which reads no amount, with only the way back', () => {
        expect(bankPageHref('PIX_BR', 7.5, ['BR'], CARD_FUNDING_RETURN_TO)).toBe(`/add-money/pix?${back}`)
    })

    it('prefills a dollar top-up, never a top-up that takes another currency', () => {
        expect(bankPageHref('ACH_US', 7.5, ['US'], CARD_FUNDING_RETURN_TO)).toMatch(
            new RegExp(`^/add-money/[a-z-]+/bank\\?amount=7\\.50&${back}$`)
        )
        expect(bankPageHref('SEPA_EU', 7.5, ['DE'], CARD_FUNDING_RETURN_TO)).toBe(`/add-money/germany/bank?${back}`)
    })

    it('prefills nothing while the gap is unknown', () => {
        expect(bankPageHref('BANK_TRANSFER_AR', undefined, ['AR'], CARD_FUNDING_RETURN_TO)).toBe(
            `/add-money/argentina/manteca?${back}`
        )
    })
})
