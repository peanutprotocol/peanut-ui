import { taxIdOutcome } from './taxIdChecks'

const genericTaxField = {
    key: 'taxId',
    kind: 'taxId',
    step: 'tax',
    feature: 'bank',
    required: true,
    format: null,
    value: null,
} as Parameters<typeof taxIdOutcome>[0]

describe('tax digit requirement without an available checker', () => {
    const invalidValues = [
        'LETTERS',
        '---',
        '.../',
        '１２３４５',
        '١٢٣٤٥',
        '०१२३४',
        '000000000',
        '00-000-000',
        ...Array.from({ length: 24 }, (_, index) => `${'Ab'.repeat(index + 1)}./ -`),
    ]
    it.each(invalidValues)('blocks invalid generic tax input on blur: %j', (taxId) => {
        expect(taxIdOutcome(genericTaxField, { taxId }, 'valid', true)).toMatchObject({
            blocks: true,
            error: 'invalid_tax_id',
        })
    })
    it.each(['AB12345', 'PT123456789'])('retains valid alphanumeric tax input: %j', (taxId) => {
        expect(taxIdOutcome(genericTaxField, { taxId }, 'valid', true)).toMatchObject({ blocks: false, error: null })
    })
    it('keeps an untouched masked tax value accepted', () => {
        const field = { ...genericTaxField, value: '••••1234', masked: true }
        expect(taxIdOutcome(field, { taxId: '••••1234' }, 'valid', true)).toMatchObject({ blocks: false, error: null })
    })
})
