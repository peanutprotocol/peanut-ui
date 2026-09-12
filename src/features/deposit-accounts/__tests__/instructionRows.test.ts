import { acceptedRails, instructionRowKeys, instructionRows, type RailLabels } from '../instructionRows'
import type { DepositInstructions, DepositRowKey, DepositRowLabels } from '../types'

const railLabels: RailLabels = {
    sepa: 'SEPA',
    sepa_instant: 'SEPA',
    ach_push: 'ACH',
    wire: 'Wire',
    fallback: 'Bank transfer',
}

// the label is not what this file decides; a key echo keeps the assertions
// about which rows render, in which order
const labels = new Proxy({} as DepositRowLabels, { get: (_t, key: string) => `label:${key}` })

const keysOf = (instructions: DepositInstructions) => instructionRowKeys(instructions, railLabels).map((row) => row.key)

/**
 * Which rows a details card shows is decided by the fields the provider sent,
 * never by the currency. Each corridor below is the shape the backend really
 * returns for it, so a corridor losing a row is a test failure rather than a
 * payer staring at a form field they cannot fill.
 */
describe('instructionRowKeys renders the rows a corridor actually has', () => {
    it('SEPA: IBAN and BIC, no account number', () => {
        expect(
            keysOf({
                accountHolderName: 'Ana Pérez',
                bankName: 'Bank of Nowhere',
                iban: 'DE89370400440532013000',
                bic: 'NOWWDEFF',
                paymentRails: ['sepa', 'sepa_instant'],
            })
        ).toEqual(['accountHolder', 'bank', 'iban', 'bic', 'accepts'])
    })

    it('ACH: account and routing numbers', () => {
        expect(
            keysOf({
                accountHolderName: 'Ana Pérez',
                bankName: 'Lead Bank',
                accountNumber: '123456789',
                routingNumber: '101019644',
                bankAddress: '1801 Main St',
                paymentRails: ['ach_push', 'wire'],
            })
        ).toEqual(['accountHolder', 'bank', 'accountNumber', 'routingNumber', 'bankAddress', 'accepts'])
    })

    it('Faster Payments: sort code and account number, no IBAN', () => {
        expect(
            keysOf({
                accountHolderName: 'Ana Pérez',
                bankName: 'Modulr',
                sortCode: '04-06-05',
                accountNumber: '12345678',
                paymentRails: ['faster_payments'],
            })
        ).toEqual(['accountHolder', 'bank', 'sortCode', 'accountNumber', 'accepts'])
    })

    it('SPEI: a CLABE and no bank name', () => {
        expect(
            keysOf({
                accountHolderName: 'Ana Pérez',
                clabe: '646180111812345678',
                paymentRails: ['spei'],
            })
        ).toEqual(['accountHolder', 'clabe', 'accepts'])
    })

    it('the row order follows the transfer form: who, where, which account, what it takes', () => {
        expect(
            keysOf({
                accountHolderName: 'Ana Pérez',
                taxId: '20-12345678-9',
                bankName: 'Banco',
                iban: 'DE89',
                bic: 'NOWWDEFF',
                bankAddress: 'Calle 1',
                beneficiaryAddress: 'Calle 2',
                paymentRails: ['sepa'],
            })
        ).toEqual(['accountHolder', 'taxId', 'bank', 'iban', 'bic', 'bankAddress', 'beneficiaryAddress', 'accepts'])
    })

    it('drops every row the provider left empty, and the accepts row with no rail', () => {
        expect(keysOf({ accountHolderName: 'Ana Pérez', bankName: '', iban: undefined, paymentRails: [] })).toEqual([
            'accountHolder',
        ])
    })
})

describe('acceptedRails', () => {
    it('names each rail once, even when two ids resolve to the same name', () => {
        expect(acceptedRails({ accountHolderName: 'A', paymentRails: ['sepa', 'sepa_instant'] }, railLabels)).toBe(
            'SEPA'
        )
    })

    it('falls back to generic wording for a rail nobody has named yet', () => {
        expect(acceptedRails({ accountHolderName: 'A', paymentRails: ['transfer_ar'] }, railLabels)).toBe(
            'Bank transfer'
        )
    })
})

describe('instructionRows labels the rows and says which can be copied', () => {
    const rows = instructionRows(
        { accountHolderName: 'Ana Pérez', iban: 'DE89', paymentRails: ['sepa'] },
        labels,
        railLabels
    )

    it('labels every row from the catalog', () => {
        expect(rows.map((row) => row.label)).toEqual(['label:accountHolder', 'label:iban', 'label:accepts'])
    })

    it('offers copy on the values a payer pastes, and not on what the account accepts', () => {
        const copyable = (key: DepositRowKey) => rows.find((row) => row.key === key)?.copyable
        expect(copyable('iban')).toBe(true)
        expect(copyable('accepts')).toBe(false)
    })
})
