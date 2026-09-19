import { bankReferenceDestinationFields, bankReferenceProblem, bankReferenceSpecForRail } from '../bank-reference'

const sepa = bankReferenceSpecForRail('sepa')!
const ach = bankReferenceSpecForRail('ach')!

describe('bankReferenceSpecForRail', () => {
    it('SEPA and ACH carry a reference, each in its own request field', () => {
        expect(sepa.field).toBe('sepaReference')
        expect(ach.field).toBe('achReference')
    })

    it('a rail the API cannot carry a reference on has no spec', () => {
        for (const rail of ['faster_payments', 'spei', 'co_bank_transfer', 'wire', '', undefined]) {
            expect(bankReferenceSpecForRail(rail)).toBeNull()
        }
    })
})

describe('bankReferenceProblem — the provider limits', () => {
    it('an empty reference is valid: the field is optional', () => {
        expect(bankReferenceProblem('', sepa)).toBeNull()
        expect(bankReferenceProblem('   ', ach)).toBeNull()
    })

    it('SEPA: 6 to 140 characters', () => {
        expect(bankReferenceProblem('12345', sepa)).toBe('tooShort')
        expect(bankReferenceProblem('123456', sepa)).toBeNull()
        expect(bankReferenceProblem('a'.repeat(140), sepa)).toBeNull()
        expect(bankReferenceProblem('a'.repeat(141), sepa)).toBe('tooLong')
    })

    it('SEPA: letters, numbers, spaces and & - . / only', () => {
        expect(bankReferenceProblem('Invoice 42 & rent - Sep. 2026/09', sepa)).toBeNull()
        for (const bad of ['Invoice #42', 'Año 2026', 'rent, september', 'rent: september', 'invoice_42']) {
            expect(bankReferenceProblem(bad, sepa)).toBe('invalidChars')
        }
    })

    it('ACH: at most 10 characters, letters, numbers and spaces only', () => {
        expect(bankReferenceProblem('R', ach)).toBeNull()
        expect(bankReferenceProblem('RENT SEP 1', ach)).toBeNull()
        expect(bankReferenceProblem('RENT SEP 12', ach)).toBe('tooLong')
        expect(bankReferenceProblem('RENT-SEP', ach)).toBe('invalidChars')
    })

    it('measures the trimmed text, which is what is sent', () => {
        expect(bankReferenceProblem('  RENT SEP 1  ', ach)).toBeNull()
    })
})

describe('bankReferenceDestinationFields — what reaches the request', () => {
    it('maps the trimmed reference to the field of the rail', () => {
        expect(bankReferenceDestinationFields('sepa', ' Invoice 42 ')).toEqual({ sepaReference: 'Invoice 42' })
        expect(bankReferenceDestinationFields('ach', 'RENT')).toEqual({ achReference: 'RENT' })
    })

    it('sends nothing for an empty reference, a rail with no spec, or a reference that breaks the limits', () => {
        expect(bankReferenceDestinationFields('sepa', '')).toEqual({})
        expect(bankReferenceDestinationFields('faster_payments', 'Invoice 42')).toEqual({})
        expect(bankReferenceDestinationFields('sepa', 'short')).toEqual({})
        expect(bankReferenceDestinationFields('ach', 'Invoice #42')).toEqual({})
    })
})
