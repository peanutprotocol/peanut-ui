import {
    addressCountryAlpha2,
    addressCountryAlpha3,
    addressStatesFor,
    asksAddressCountry,
    bankCorridorFor,
    corridorAcceptsAddressCountry,
    fixedAddressCountry,
    hasBridgeBankCorridor,
} from '../bank-corridors'
import { BridgeAccountType } from '@/app/actions/types/users.types'
import { COUNTRY_SPECIFIC_METHODS, countryData } from '@/components/AddMoney/consts'
import { liveRailsForCountry } from '@/features/destinations/country-rails'
import { isMantecaCountry } from '@/constants/manteca.consts'

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

    it('keeps the UK on a sort code and now carries a beneficiary address', () => {
        const gb = bankCorridorFor('GBR')
        expect(gb?.accountType).toBe(BridgeAccountType.GB)
        // Bridge requires the beneficiary address on the UK body; the UK has no state.
        expect(gb?.needsAddress).toBe(true)
        expect(addressStatesFor(fixedAddressCountry(gb!))).toEqual([])
        expect(asksAddressCountry(gb!)).toBe(false)
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

    it('carries a beneficiary address on the SEPA corridor, with no state', () => {
        const sepa = bankCorridorFor('DEU')
        // Bridge requires the beneficiary address on the SEPA body; SEPA has no state.
        expect(sepa?.needsAddress).toBe(true)
        expect(fixedAddressCountry(sepa!)).toBeNull()
        expect(asksAddressCountry(sepa!)).toBe(false)
    })
})

/**
 * The corridor table is the one source for "is a bank withdrawal wired here".
 * `hasBridgeBankCorridor` reads it, and so does the money-out picker's own list
 * (`enabledBankWithdrawCountries` → the "To Bank" rail). These are two encodings
 * of the same fact, so they must agree on every country or a Colombia-shaped
 * gap opens again — the picker offers a waitlist for a country whose form works,
 * or the reverse.
 */
describe('hasBridgeBankCorridor — the single bank-withdraw predicate', () => {
    it('is true for Colombia now that co_bank_transfer is wired', () => {
        expect(hasBridgeBankCorridor('CO')).toBe(true)
    })

    it('is true for a Bridge country by 2- or 3-letter id', () => {
        expect(hasBridgeBankCorridor('DEU')).toBe(true)
        expect(hasBridgeBankCorridor('SE')).toBe(true) // non-euro SEPA still reaches the IBAN corridor
        expect(hasBridgeBankCorridor('US')).toBe(true)
        expect(hasBridgeBankCorridor('MX')).toBe(true)
    })

    it('is false for Manteca-only countries — their own rails gate them', () => {
        expect(hasBridgeBankCorridor('AR')).toBe(false)
        expect(hasBridgeBankCorridor('BR')).toBe(false)
    })

    it('is false for a country with no rail', () => {
        expect(hasBridgeBankCorridor('IN')).toBe(false)
    })
})

describe('the withdraw picker and the withdraw form agree on every country', () => {
    it('picker "supported" set equals the form/offramp "allowed" set', () => {
        const disagreements: string[] = []
        for (const country of countryData) {
            if (country.type !== 'country') continue
            // picker: a country is shown when it has a live withdraw rail
            const pickerSupported = liveRailsForCountry(country.id, 'withdraw').length > 0
            // form/offramp: a Bridge corridor exists, or the Manteca flow serves it
            const formAllowed = hasBridgeBankCorridor(country.id) || isMantecaCountry(country.path)
            if (pickerSupported !== formAllowed) {
                disagreements.push(`${country.id} (${country.currency}): picker=${pickerSupported} form=${formAllowed}`)
            }
        }
        expect(disagreements).toEqual([])
    })
})

/**
 * A prefilled address has to belong to the corridor it lands in, where the
 * corridor fixes the country. A US account takes its owner's address in any
 * country (Bridge beneficiary address validation), so any address fits there.
 */
describe('which country an address may come from', () => {
    it.each([
        ['a Spanish address, euro corridor', 'SEPA', 'ES', true],
        ['an alpha-3 Spanish address, euro corridor', 'SEPA', 'ESP', true],
        ['a US address, euro corridor', 'SEPA', 'US', false],
        ['a UK address, euro corridor', 'SEPA', 'GB', false],
        ['a US address, US corridor', 'USA', 'US', true],
        ['a French address, US corridor', 'USA', 'FR', true],
        ['a UK address, UK corridor', 'GB', 'GBR', true],
        ['a Mexican address, Mexican corridor', 'MX', 'MEX', true],
        ['a Mexican address, US corridor', 'USA', 'MX', true],
    ])('%s', (_, country, addressCountry, expected) => {
        const corridor = bankCorridorFor(country)!
        expect(corridorAcceptsAddressCountry(corridor, addressCountry)).toBe(expected)
    })

    it.each([[null], [undefined], ['']])('an unnamed country is allowed through (%s)', (value) => {
        // the form asked for the address before any of this existed; refusing to
        // fill one in because we cannot name its country is the worse answer
        expect(corridorAcceptsAddressCountry(bankCorridorFor('SEPA')!, value)).toBe(true)
    })

    it('Colombia asks for no address, so the question never arises', () => {
        expect(bankCorridorFor('CO')!.needsAddress).toBe(false)
    })
})

describe("the owner's address on a US account", () => {
    it('asks which country the address is in, only on the US corridor', () => {
        expect(asksAddressCountry(bankCorridorFor('USA'))).toBe(true)
        expect(asksAddressCountry(bankCorridorFor('MX'))).toBe(false)
        expect(asksAddressCountry(bankCorridorFor('GB'))).toBe(false)
        expect(asksAddressCountry(bankCorridorFor('SEPA'))).toBe(false)
        // Colombia asks for no address at all
        expect(asksAddressCountry(bankCorridorFor('CO'))).toBe(false)
        expect(asksAddressCountry(null)).toBe(false)
    })

    it('fixes the country where the corridor has one', () => {
        expect(fixedAddressCountry(bankCorridorFor('MX')!)).toBe('MX')
        expect(fixedAddressCountry(bankCorridorFor('GB')!)).toBe('GB')
        expect(fixedAddressCountry(bankCorridorFor('USA')!)).toBeNull()
    })

    it('offers states for a US or Mexican address and none elsewhere', () => {
        expect(addressStatesFor('US').map((state) => state.code)).toContain('CA')
        expect(addressStatesFor('us').map((state) => state.code)).toContain('NY')
        expect(addressStatesFor('MX').map((state) => state.code)).toContain('CMX')
        for (const country of ['PT', 'AR', 'GB', 'DE', '', null, undefined]) {
            expect(addressStatesFor(country)).toEqual([])
        }
    })

    it('turns an alpha-2 country into the alpha-3 Bridge takes, for countries outside the corridors too', () => {
        expect(addressCountryAlpha3('US')).toBe('USA')
        expect(addressCountryAlpha3('pt')).toBe('PRT')
        expect(addressCountryAlpha3('AR')).toBe('ARG')
        expect(addressCountryAlpha3('NG')).toBe('NGA')
        expect(addressCountryAlpha3('ZZ')).toBeNull()
        expect(addressCountryAlpha3(null)).toBeNull()
    })

    it('reads an alpha-3 country from a saved account back as alpha-2, for any catalog country', () => {
        expect(addressCountryAlpha2('USA')).toBe('US')
        expect(addressCountryAlpha2('ARG')).toBe('AR')
        expect(addressCountryAlpha2('NGA')).toBe('NG')
        expect(addressCountryAlpha2('pt')).toBe('PT')
        expect(addressCountryAlpha2('ZZZ')).toBeNull()
    })
})
