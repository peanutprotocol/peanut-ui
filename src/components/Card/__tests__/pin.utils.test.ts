import { validatePin } from '@/components/Card/pin.utils'

describe('validatePin', () => {
    it('rejects non-4-digit input', () => {
        expect(validatePin('').valid).toBe(false)
        expect(validatePin('123').valid).toBe(false)
        expect(validatePin('12345').valid).toBe(false)
        expect(validatePin('12a4').valid).toBe(false)
    })

    it('rejects all-same digits', () => {
        expect(validatePin('1111').valid).toBe(false)
        expect(validatePin('0000').valid).toBe(false)
    })

    it('rejects ascending sequences', () => {
        expect(validatePin('1234').valid).toBe(false)
        expect(validatePin('6789').valid).toBe(false)
    })

    it('rejects descending sequences', () => {
        expect(validatePin('4321').valid).toBe(false)
        expect(validatePin('9876').valid).toBe(false)
    })

    it('accepts valid non-trivial PINs', () => {
        expect(validatePin('2468').valid).toBe(true)
        expect(validatePin('4282').valid).toBe(true)
        expect(validatePin('9153').valid).toBe(true)
    })
})
