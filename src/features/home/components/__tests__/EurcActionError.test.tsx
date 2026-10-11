import React from 'react'
import { render, screen } from '@testing-library/react'
import { EurcActionError } from '../EurcActionError'

jest.mock('@/i18n/app/useAppTranslations', () => ({ useAppTranslations: () => (key: string) => key }))
jest.mock('@/components/0_Bruddle/Callout', () => ({
    Callout: ({ children }: { children: React.ReactNode }) => <div role="alert">{children}</div>,
}))

it.each([
    ['operation_in_flight', 'inFlight'],
    ['amount_below_minimum', 'belowMinimum'],
    ['unsupported_precision', 'tooPrecise'],
    ['insufficient_balance', 'insufficientBalance'],
    ['operation_expired', 'expired'],
    ['something_new', 'actionError'],
])('shows %s as %s instead of a retry prompt where retrying cannot help', (code, key) => {
    render(<EurcActionError error={Object.assign(new Error(code), { code })} />)
    expect(screen.getByRole('alert')).toHaveTextContent(key)
})

it('renders nothing without an error', () => {
    const { container } = render(<EurcActionError error={null} />)
    expect(container).toBeEmptyDOMElement()
})
