jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: jest.fn() }) }))
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import { act } from '@testing-library/react'
import type { PaperworkVerificationStep } from '@/app/actions/types/kyc-paperwork-verification.types'
import { useAnswerForm } from '../useAnswerForm'

jest.mock('@/app/actions/kyc-paperwork-verification', () => ({ saveKycAnswers: jest.fn() }))
jest.mock('@/context/authContext', () => ({ useOptionalAuth: () => null }))

const steps: PaperworkVerificationStep[] = [
    {
        id: 'purpose',
        features: ['base'],
        fields: [{ key: 'bankPurpose', kind: 'choice', required: true, options: ['a', 'b'], value: null }],
        answered: false,
    },
]
type Returned = Parameters<typeof useAnswerForm>[3]
const rejection = (): Returned => ({
    errors: { bankPurpose: 'invalid_choice' },
    formError: 'retry',
    message: 'Try again',
})

describe('useAnswerForm returned rejection updates', () => {
    beforeEach(() => window.sessionStorage.clear())

    it('shows a late rejection without resetting an answer edited on the mounted question', () => {
        const { result, rerender } = renderHook(
            ({ returned }: { returned: Returned }) => useAnswerForm(steps, undefined, null, returned),
            { initialProps: { returned: undefined as Returned } }
        )
        act(() => result.current.change('bankPurpose', 'b'))
        expect(result.current.errors).toEqual({})

        rerender({ returned: rejection() })
        expect(result.current.errors).toEqual({ bankPurpose: 'invalid_choice' })
        expect(result.current.formError).toBe('retry')
        expect(result.current.formMessage).toBe('Try again')
        expect(result.current.values).toEqual({ bankPurpose: 'b' })
    })

    it('does not resurrect cleared errors for the same object, but applies a new rejection object', () => {
        const returned = rejection()
        const { result, rerender } = renderHook(
            ({ returned }: { returned: Returned }) => useAnswerForm(steps, undefined, null, returned),
            { initialProps: { returned } }
        )
        expect(result.current.errors).toEqual({ bankPurpose: 'invalid_choice' })
        act(() => {
            result.current.change('bankPurpose', 'b')
            result.current.setFormError(null)
        })
        expect(result.current.errors).toEqual({})
        expect(result.current.formError).toBeFalsy()
        expect(result.current.formMessage).toBeFalsy()

        rerender({ returned })
        expect(result.current.errors).toEqual({})
        expect(result.current.formError).toBeFalsy()
        expect(result.current.formMessage).toBeFalsy()
        expect(result.current.values).toEqual({ bankPurpose: 'b' })

        rerender({ returned: rejection() })
        expect(result.current.errors).toEqual({ bankPurpose: 'invalid_choice' })
        expect(result.current.formError).toBe('retry')
        expect(result.current.formMessage).toBe('Try again')
        expect(result.current.values).toEqual({ bankPurpose: 'b' })
    })
})
