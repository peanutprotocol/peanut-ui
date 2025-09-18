import { validateCbuCvuAlias } from '@/utils/withdraw.utils'

jest.mock('@/assets', () => ({}))

describe('Withdraw Utilities', () => {
    describe('validateCbuCvuAlias', () => {
        it.each([
            { value: '', valid: false, message: 'Invalid length' },
            { value: 'alias', valid: false, message: 'Invalid length' },
            { value: 'alias.testvc.eth', valid: true, message: undefined },
            { value: 'alias123!', valid: false, message: 'Alias must contain only letters, numbers, dots, and dashes' },
            {
                value: '0000003100066354450378',
                valid: false,
                message: 'Invalid CBU/CVU check that you entered it correctly',
            },
            {
                value: '0000003200066354450379',
                valid: false,
                message: 'Invalid CBU/CVU check that you entered it correctly',
            },
            { value: '0000003100066354450379', valid: true, message: undefined },
            { value: '000000310006635445037', valid: false, message: 'Invalid length' },
            { value: '000000310006635445037b', valid: false, message: 'CBU/CVU must contain only numbers' },
        ])('should be valid $valid for $value', ({ value, valid, message }) => {
            const result = validateCbuCvuAlias(value)
            expect(result.valid).toBe(valid)
            expect(result.message).toBe(message)
        })
    })
})
