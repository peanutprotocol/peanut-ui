import type { PaperworkVerificationField } from '@/app/actions/types/kyc-paperwork-verification.types'
import { stepComplete } from '../paperworkVerification.utils'
import { isZeroTaxId, loadTaxIdChecker, taxIdOutcome, taxIdVerdict, type TaxIdChecker } from '../taxIdChecks'

const field = (extra: Partial<PaperworkVerificationField> = {}): PaperworkVerificationField => ({
    key: 'taxId',
    kind: 'taxId',
    required: true,
    format: null,
    checks: ['de.idnr'],
    value: null,
    ...extra,
})

describe('loadTaxIdChecker', () => {
    it('accepts a number any of the checks accepts, whatever its separators', async () => {
        const germany = (await loadTaxIdChecker(['de.idnr']))!
        expect(germany('36 574 261 809')).toBe('valid')
        expect(germany('36574261809')).toBe('valid')
        const germanyOrSteuernummer = (await loadTaxIdChecker(['de.idnr', 'de.stnr']))!
        expect(germanyOrSteuernummer('181/815/08155')).toBe('valid')
        expect(germanyOrSteuernummer('12345678901')).toBe('invalid')
        const uk = (await loadTaxIdChecker(['gb.nino', 'gb.utr']))!
        expect(uk('hh 01 23 45 d')).toBe('valid')
        expect(uk('1955839661')).toBe('valid')
    })

    it('refuses a whole number with a wrong check digit or part', async () => {
        expect((await loadTaxIdChecker(['de.idnr']))!('36574261808')).toBe('invalid')
        expect((await loadTaxIdChecker(['ar.cuit']))!('20-12345678-8')).toBe('invalid')
        // Mod-11 valid, but 21 is no CUIT type: the API refuses it too.
        expect((await loadTaxIdChecker(['ar.cuit']))!('21-12345678-2')).toBe('invalid')
        expect((await loadTaxIdChecker(['br.cpf']))!('529.982.247-24')).toBe('invalid')
    })

    it('calls a number still short of its length incomplete, not wrong', async () => {
        expect((await loadTaxIdChecker(['de.idnr']))!('3657426')).toBe('incomplete')
        expect((await loadTaxIdChecker(['br.cpf']))!('529.982')).toBe('incomplete')
    })

    it('checks the fixed formats the API names as their masks write them', async () => {
        expect((await loadTaxIdChecker(['us.ssn']))!('123-45-6789')).toBe('valid')
        expect((await loadTaxIdChecker(['ar.cuit']))!('20-12345678-6')).toBe('valid')
        expect((await loadTaxIdChecker(['br.cpf']))!('529.982.247-25')).toBe('valid')
        expect((await loadTaxIdChecker(['cl.rut']))!('12.345.678-5')).toBe('valid')
        expect((await loadTaxIdChecker(['mx.curp']))!('AAAA000101HDFBBB01')).toBe('valid')
    })

    it('gives no checker for no checks, or for one this app does not know', async () => {
        expect(await loadTaxIdChecker([])).toBeNull()
        expect(await loadTaxIdChecker(['xx.idnr'])).toBeNull()
        expect(await loadTaxIdChecker(['de.idnr', 'de.nothing'])).toBeNull()
    })
})

describe('taxIdVerdict', () => {
    const refuses: TaxIdChecker = () => 'invalid'
    const ready = { checker: refuses, pending: false }

    it('leaves an empty, masked-and-untouched or ITIN value to the other checks', () => {
        expect(taxIdVerdict(field(), {}, ready)).toBe('valid')
        expect(taxIdVerdict(field(), { taxId: '  ' }, ready)).toBe('valid')
        const masked = field({ value: '•••• 1809', masked: true })
        expect(taxIdVerdict(masked, { taxId: '•••• 1809' }, ready)).toBe('valid')
        expect(taxIdVerdict(field({ format: 'ssn' }), { taxId: '912-70-1234' }, ready)).toBe('valid')
    })

    it('waits for the validators to load, and passes when none could', () => {
        expect(taxIdVerdict(field(), { taxId: '123' }, { checker: null, pending: true })).toBe('pending')
        expect(taxIdVerdict(field(), { taxId: '123' }, { checker: null, pending: false })).toBe('valid')
        expect(taxIdVerdict(field(), { taxId: ' 123 ' }, ready)).toBe('invalid')
    })
})

describe('taxIdOutcome', () => {
    const country = field()
    const ssn = field({ format: 'ssn', checks: undefined })

    it('only warns when a country check refuses the number, and keeps Continue open', () => {
        expect(taxIdOutcome(country, { taxId: '36574261808' }, 'invalid', false)).toEqual({
            blocks: false,
            error: null,
            warning: true,
        })
        expect(taxIdOutcome(country, { taxId: '3657426' }, 'incomplete', false).warning).toBe(false)
        expect(taxIdOutcome(country, { taxId: '3657426' }, 'incomplete', true)).toEqual({
            blocks: false,
            error: null,
            warning: true,
        })
        expect(taxIdOutcome(country, { taxId: '36574261809' }, 'pending', false).blocks).toBe(false)
    })

    it('holds Continue on a provider format the provider would refuse', () => {
        expect(taxIdOutcome(ssn, { taxId: '123-45-678' }, 'incomplete', false)).toEqual({
            blocks: true,
            error: null,
            warning: false,
        })
        expect(taxIdOutcome(ssn, { taxId: '000-12-3456' }, 'invalid', false)).toEqual({
            blocks: true,
            error: 'invalid_tax_id',
            warning: false,
        })
        expect(taxIdOutcome(ssn, { taxId: '123-45-6789' }, 'pending', false).blocks).toBe(true)
    })

    it('refuses zeros everywhere, flagged from four zeros or once left', () => {
        expect(taxIdOutcome(country, { taxId: '0000000000' }, 'valid', false)).toEqual({
            blocks: true,
            error: 'invalid_tax_id',
            warning: false,
        })
        expect(taxIdOutcome(country, { taxId: '000' }, 'incomplete', false)).toEqual({
            blocks: true,
            error: null,
            warning: false,
        })
        expect(taxIdOutcome(country, { taxId: '0' }, 'incomplete', true).error).toBe('invalid_tax_id')
        expect(taxIdOutcome(ssn, { taxId: '000-00-0000' }, 'invalid', false).error).toBe('invalid_tax_id')
    })

    it('treats separators as part of zeros but any other digit as a number', () => {
        expect(isZeroTaxId('000.000.000-00')).toBe(true)
        expect(isZeroTaxId('00 00')).toBe(true)
        expect(isZeroTaxId('0000000001')).toBe(false)
        expect(isZeroTaxId('O000')).toBe(false)
    })
})

describe('stepComplete', () => {
    it('holds Continue on a field the screen refuses', () => {
        expect(stepComplete([field()], { taxId: '36574261809' })).toBe(true)
        expect(stepComplete([field()], { taxId: '36574261808' }, new Set(['taxId']))).toBe(false)
    })
})
