import React from 'react'
import { render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { ReceiptUnavailable } from '../ReceiptUnavailable'

jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => React.createElement('img', props as Record<string, string>),
}))

jest.mock('@/assets/logos/peanut-logo.svg', () => 'peanut-logo.svg')

const renderVariant = (variant?: 'gone' | 'loadFailed') =>
    render(
        <IntlWrapper>
            <ReceiptUnavailable variant={variant} />
        </IntlWrapper>
    )

describe('ReceiptUnavailable', () => {
    test('defaults to the gone copy with branding and a home CTA', () => {
        renderVariant()
        expect(screen.getByText('This receipt link is no longer available')).toBeInTheDocument()
        expect(screen.getByAltText('Peanut Logo')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /go to home/i })).toHaveAttribute('href', '/home')
    })

    test('loadFailed shows the retryable copy', () => {
        renderVariant('loadFailed')
        expect(screen.getByText("We couldn't load this receipt")).toBeInTheDocument()
        expect(screen.queryByText('This receipt link is no longer available')).not.toBeInTheDocument()
    })
})
