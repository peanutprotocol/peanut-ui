import type { PaperworkVerificationField } from '@/app/actions/types/kyc-paperwork-verification.types'
import { stepComplete } from '@/features/paperwork-verification/paperworkVerification.utils'

const field = (key: string, extra: Partial<PaperworkVerificationField> = {}): PaperworkVerificationField => ({
    key,
    kind: 'text',
    required: true,
    value: null,
    ...extra,
})

describe('composed Bridge address minimum from the public street descriptor', () => {
    const street = field('street', { minAddressLineLength: 4 } as Partial<PaperworkVerificationField>)
    const number = field('buildingNumber', { required: false })
    const fields = [street, number]

    it.each([
        ['street only at three characters', { street: 'Rd' }, false],
        ['street only at four characters', { street: 'Road' }, true],
        ['number plus short street at three composed characters', { buildingNumber: '1', street: 'R' }, false],
        ['Street Rd plus number 1 at the four-character boundary', { buildingNumber: '1', street: 'Rd' }, true],
        ['Street Rd plus number 1', { buildingNumber: '1', street: ' Rd ' }, true],
        ['whitespace around both pieces', { buildingNumber: ' 12 ', street: ' Rd ' }, true],
    ])('%s', (_label, values, expected) => {
        expect(stepComplete(fields, values)).toBe(expected)
    })

    it('uses a locked server value for the composed line and does not trust a conflicting client value', () => {
        const lockedNumber = field('buildingNumber', { required: false, locked: true, value: '1' })
        expect(stepComplete([street, lockedNumber], { street: 'R', buildingNumber: '99' })).toBe(false)
        expect(stepComplete([street, lockedNumber], { street: 'Rd', buildingNumber: '99' })).toBe(true)
    })

    it('keeps legacy presence checks when the optional minimum hint is absent', () => {
        const legacy = [field('street'), number]
        expect(stepComplete(legacy, { street: 'Rd' })).toBe(true)
    })

    it('does not apply the Bridge minimum to an unrelated step', () => {
        expect(stepComplete([field('street')], { street: 'Rd' })).toBe(true)
    })
})
