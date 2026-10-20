import { entryStep, fieldErrorKey } from '../verifyOnce.utils'
import type { VerifyOnceQuestions } from '@/app/actions/types/kyc-verify-once.types'

const questions: VerifyOnceQuestions = {
    available: true,
    attemptId: 'canonical-attempt',
    residence: 'US',
    steps: [{ id: 'purpose', features: ['card'], answered: false, fields: [] }],
    firstUnanswered: 'purpose',
    progress: { done: 0, total: 2 },
}

describe('canonical identity and actionable validation acceptance', () => {
    it('a fresh page with canonical PENDING enters review without a local submitted flag', () => {
        expect(entryStep({ questions, plan: { proofOfAddress: null } as never, status: 'PENDING' })).toBe('review')
    })
    it.each([
        ['too_short', 'tooShort'],
        ['street_number_missing', 'streetNumberMissing'],
        ['po_box_not_accepted', 'poBoxNotAccepted'],
    ])('keeps %s distinct from generic invalid input', (code, key) => {
        expect(fieldErrorKey(code)).toBe(key)
    })
})
