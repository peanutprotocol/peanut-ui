import { render, screen } from '@testing-library/react'
import { Field } from '@/components/0_Bruddle/Field'
import BaseInput from '@/components/0_Bruddle/BaseInput'

describe('Field', () => {
    it('renders label wired to the control via htmlFor', () => {
        render(
            <Field label="IBAN" htmlFor="iban">
                <BaseInput id="iban" />
            </Field>
        )
        expect(screen.getByLabelText('IBAN')).toBeInTheDocument()
    })

    it('shows the helper line when there is no error', () => {
        render(
            <Field label="BIC" htmlFor="bic" helper="8 or 11 characters">
                <BaseInput id="bic" />
            </Field>
        )
        expect(screen.getByText('8 or 11 characters')).toBeInTheDocument()
    })

    it('replaces the helper with the error — never both (board rule)', () => {
        render(
            <Field label="BIC" htmlFor="bic" helper="8 or 11 characters" error="BIC is invalid">
                <BaseInput id="bic" />
            </Field>
        )
        expect(screen.getByRole('alert')).toHaveTextContent('BIC is invalid')
        expect(screen.queryByText('8 or 11 characters')).not.toBeInTheDocument()
    })

    it('renders the error as text only — no border class on the control (DS call, TASK-21454)', () => {
        render(
            <Field label="BIC" htmlFor="bic" error="BIC is invalid">
                <BaseInput id="bic" />
            </Field>
        )
        // Field never flips the control into its error state; red is the text.
        expect(screen.getByLabelText('BIC')).not.toHaveAttribute('aria-invalid')
    })

    it('renders no error and no helper when neither is set', () => {
        render(
            <Field label="City" htmlFor="city">
                <BaseInput id="city" />
            </Field>
        )
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
})
