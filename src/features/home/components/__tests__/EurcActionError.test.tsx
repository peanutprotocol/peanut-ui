import React from 'react'
import { render, screen } from '@testing-library/react'
import { EurcActionError } from '../EurcActionError'

jest.mock('@/i18n/app/useAppTranslations', () => ({
    useAppTranslations: () => (key: string, values?: Record<string, string>) =>
        values ? `${key}:${JSON.stringify(values)}` : key,
}))
jest.mock('@/components/0_Bruddle/Callout', () => ({
    Callout: ({ children }: { children: React.ReactNode }) => <div role="alert">{children}</div>,
}))

it.each([
    ['operation_in_flight', 'inFlight'],
    ['unsupported_precision', 'tooPrecise'],
    ['insufficient_balance', 'insufficientBalance'],
    ['verification_required', 'verificationRequired'],
    ['banking_unavailable', 'bankingUnavailable'],
    ['operation_needs_review', 'needsReviewError'],
    ['operation_expired', 'expired'],
    ['something_new', 'actionError'],
])('shows %s as %s instead of a retry prompt where retrying cannot help', (code, key) => {
    render(<EurcActionError error={Object.assign(new Error(code), { code })} minimumCurrency="EURC" />)
    expect(screen.getByRole('alert')).toHaveTextContent(key)
})

it('names the minimum and its currency when the amount is below it', () => {
    render(
        <EurcActionError
            error={Object.assign(new Error('min'), { code: 'amount_below_minimum' })}
            minimumCurrency="USD"
        />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('belowMinimum:{"currency":"USD"}')
})

it('renders nothing without an error', () => {
    const { container } = render(<EurcActionError error={null} minimumCurrency="EURC" />)
    expect(container).toBeEmptyDOMElement()
})
