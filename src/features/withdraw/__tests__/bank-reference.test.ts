import {
    bankReferenceDestinationFields,
    bankReferenceProblem,
    bankReferenceSpecForRail,
    payoutNoteForRail,
} from '../bank-reference'

const sepa = bankReferenceSpecForRail('sepa')!
const ach = bankReferenceSpecForRail('ach')!
const fasterPayments = bankReferenceSpecForRail('faster_payments')!
const spei = bankReferenceSpecForRail('spei')!
const colombia = bankReferenceSpecForRail('co_bank_transfer')!

describe('bankReferenceSpecForRail', () => {
    it('every rail that carries a reference names its own request field', () => {
        expect(sepa.field).toBe('sepaReference')
        expect(ach.field).toBe('achReference')
        expect(fasterPayments.field).toBe('fasterPaymentsReference')
        expect(spei.field).toBe('speiReference')
        expect(colombia.field).toBe('coBankTransferReference')
    })

    it('each rail keeps its own limits', () => {
        expect([fasterPayments.minLength, fasterPayments.maxLength]).toEqual([1, 18])
        expect([spei.minLength, spei.maxLength]).toEqual([1, 40])
        expect([colombia.minLength, colombia.maxLength]).toEqual([1, 18])
    })

    it('a rail the API cannot carry a reference on has no spec', () => {
        for (const rail of ['swift', 'pix', '', undefined]) {
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

    it('maps the reference of each newly carried rail to its own field', () => {
        expect(bankReferenceDestinationFields('faster_payments', 'RENT SEPT')).toEqual({
            fasterPaymentsReference: 'RENT SEPT',
        })
        expect(bankReferenceDestinationFields('spei', 'RENTA 09 2026')).toEqual({ speiReference: 'RENTA 09 2026' })
        expect(bankReferenceDestinationFields('co_bank_transfer', 'ARRIENDO 09')).toEqual({
            coBankTransferReference: 'ARRIENDO 09',
        })
    })

    it('sends nothing for an empty reference, a rail with no spec, or a reference that breaks the limits', () => {
        expect(bankReferenceDestinationFields('sepa', '')).toEqual({})
        expect(bankReferenceDestinationFields('swift', 'Invoice 42')).toEqual({})
        expect(bankReferenceDestinationFields('sepa', 'short')).toEqual({})
        expect(bankReferenceDestinationFields('ach', 'Invoice #42')).toEqual({})
        // over each rail's own ceiling
        expect(bankReferenceDestinationFields('faster_payments', 'x'.repeat(19))).toEqual({})
        expect(bankReferenceDestinationFields('spei', 'x'.repeat(41))).toEqual({})
        expect(bankReferenceDestinationFields('co_bank_transfer', 'x'.repeat(19))).toEqual({})
        // SPEI takes no punctuation
        expect(bankReferenceDestinationFields('spei', 'RENTA-09')).toEqual({})
    })
})

describe('USD speeds carry a reference (TASK-23054)', () => {
    it('same-day ACH takes the ACH field and its 10-character limit', () => {
        expect(bankReferenceSpecForRail('ach_same_day')).toEqual(bankReferenceSpecForRail('ach'))
        expect(bankReferenceDestinationFields('ach_same_day', 'RENT SEP')).toEqual({ achReference: 'RENT SEP' })
    })

    it('a wire carries a memo of up to 140 characters', () => {
        const wire = bankReferenceSpecForRail('wire')!
        expect(wire.field).toBe('wireMessage')
        expect([wire.minLength, wire.maxLength]).toEqual([1, 140])
        expect(bankReferenceDestinationFields('wire', 'Invoice 42 / rent')).toEqual({
            wireMessage: 'Invoice 42 / rent',
        })
        expect(bankReferenceProblem('x'.repeat(141), wire)).toBe('tooLong')
        expect(bankReferenceProblem('Invoice #42', wire)).toBe('invalidChars')
    })

    it('says the payout comes from our partner on same-day ACH, and from Peanut on a wire', () => {
        expect(payoutNoteForRail('ach_same_day')).toBe('payoutSenderAch')
        expect(payoutNoteForRail('wire')).toBe('payoutSenderWire')
    })
})
