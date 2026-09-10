import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { ReceiptUnavailable } from '../ReceiptUnavailable'

jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => React.createElement('img', props as Record<string, string>),
}))

jest.mock('@/assets/logos/peanut-logo.svg', () => 'peanut-logo.svg')

const renderVariant = (variant?: 'gone' | 'loadFailed', onRetry?: () => void) =>
    render(
        <IntlWrapper>
            <ReceiptUnavailable variant={variant} onRetry={onRetry} />
        </IntlWrapper>
    )

describe('ReceiptUnavailable', () => {
    test('defaults to the gone copy with branding and a home CTA — and no retry', () => {
        renderVariant()
        expect(screen.getByText('This receipt link is no longer available')).toBeInTheDocument()
        expect(screen.getByAltText('Peanut Logo')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /go to home/i })).toHaveAttribute('href', '/home')
        expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
    })

    test('loadFailed shows the retryable copy and a Retry button', () => {
        renderVariant('loadFailed')
        expect(screen.getByText("We couldn't load this receipt")).toBeInTheDocument()
        expect(screen.queryByText('This receipt link is no longer available')).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    test('Retry fires the provided onRetry (native twin refetch)', () => {
        const onRetry = jest.fn()
        renderVariant('loadFailed', onRetry)
        fireEvent.click(screen.getByRole('button', { name: /retry/i }))
        expect(onRetry).toHaveBeenCalledTimes(1)
    })

    test('Retry without onRetry falls back to a full reload (server route)', () => {
        const reload = jest.fn()
        const originalLocation = window.location
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { ...originalLocation, reload },
        })
        try {
            renderVariant('loadFailed')
            fireEvent.click(screen.getByRole('button', { name: /retry/i }))
            expect(reload).toHaveBeenCalledTimes(1)
        } finally {
            Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
        }
    })
})
