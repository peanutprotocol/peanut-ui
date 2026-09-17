import { bankCorridorFor } from '../bank-corridors'
import { BridgeAccountType } from '@/app/actions/types/users.types'
import { COUNTRY_SPECIFIC_METHODS } from '@/components/AddMoney/consts'
import { liveRailsForCountry } from '@/features/destinations/country-rails'

const fieldNames = (country: string) => bankCorridorFor(country)?.fields.map((field) => field.name)
const fieldFor = (country: string, name: string) =>
    bankCorridorFor(country)?.fields.find((field) => field.name === name)

describe('withdrawing to a Colombian bank account', () => {
    it('is offered as a live rail, not a coming-soon one', () => {
        const bank = COUNTRY_SPECIFIC_METHODS['CO'].withdraw.find((method) =>
            method.id.endsWith('-default-bank-withdraw')
        )
        expect(bank?.isSoon).toBe(false)
        expect(bank?.path).toBe('/withdraw/co/bank')
        expect(liveRailsForCountry('CO', 'withdraw')).toContainEqual(expect.objectContaining({ id: bank?.id }))
    })

    it('collects the document, the bank code, the account type and the phone', () => {
        expect(fieldNames('CO')).toEqual([
            'documentType',
            'documentNumber',
            'bankCode',
            'accountCategory',
            'phoneNumber',
        ])
        expect(bankCorridorFor('CO')?.accountType).toBe(BridgeAccountType.CO_BANK_TRANSFER)
    })

    it('asks for no beneficiary address', () => {
        expect(bankCorridorFor('CO')?.needsAddress).toBe(false)
    })

    it('offers the Colombian identity documents', () => {
        expect(fieldFor('CO', 'documentType')?.options?.map((option) => option.value)).toEqual([
            'cc',
            'ce',
            'nit',
            'pp',
        ])
        expect(fieldFor('CO', 'accountCategory')?.options?.map((option) => option.value)).toEqual([
            'savings',
            'checking',
        ])
    })

    it.each([
        ['accountNumber-ish', '12345678910', true],
        ['too short', '1234', false],
    ])('checks the account number (%s)', (_case, value, expected) => {
        expect(bankCorridorFor('CO')?.accountTest(value)).toBe(expected)
    })

    it.each([
        ['bankCode', '1007', true],
        ['bankCode', '100700', false],
        ['documentNumber', '1234567890', true],
        ['documentNumber', '12', false],
        ['phoneNumber', '+573001234567', true],
        ['phoneNumber', '+5215512345678', false],
    ])('checks %s "%s"', (name, value, expected) => {
        expect(fieldFor('CO', name)?.test?.(value)).toBe(expected)
    })

    it('strips punctuation from what reaches the provider', () => {
        expect(fieldFor('CO', 'bankCode')?.normalize?.('1-0 0 7')).toBe('1007')
    })
})

describe('the corridors the table absorbed', () => {
    it('keeps Mexico on an 18-digit CLABE with an address', () => {
        const mx = bankCorridorFor('MX')
        expect(mx?.accountType).toBe(BridgeAccountType.CLABE)
        expect(mx?.accountField).toBe('clabe')
        expect(mx?.needsAddress).toBe(true)
        expect(mx?.accountTest('002180015678912349')).toBe(true)
        expect(mx?.accountTest('123')).toBe(false)
    })

    it('keeps the UK on a sort code and no address', () => {
        const gb = bankCorridorFor('GBR')
        expect(gb?.accountType).toBe(BridgeAccountType.GB)
        expect(gb?.needsAddress).toBe(false)
        expect(gb?.fields.map((field) => field.name)).toEqual(['sortCode'])
        expect(gb?.fields[0].test?.('12-34-56')).toBe(true)
    })

    it('keeps the US on a routing number with an address', () => {
        const us = bankCorridorFor('USA')
        expect(us?.accountType).toBe(BridgeAccountType.US)
        expect(us?.needsAddress).toBe(true)
        expect(us?.fields.map((field) => field.name)).toEqual(['routingNumber'])
    })

    it('sends a SEPA country to the IBAN corridor and an unknown one nowhere', () => {
        expect(bankCorridorFor('DEU')?.accountType).toBe(BridgeAccountType.IBAN)
        expect(bankCorridorFor('ZZ')).toBeNull()
    })
})
