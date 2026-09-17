import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { ReceiptUnavailable } from '../ReceiptUnavailable'

const renderVariant = (variant?: 'gone' | 'loadFailed', onRetry?: () => void) =>
    render(
        <IntlWrapper>
            <ReceiptUnavailable variant={variant} onRetry={onRetry} />
        </IntlWrapper>
    )

describe('ReceiptUnavailable', () => {
    test('defaults to the gone copy with a home CTA — and no retry', () => {
        renderVariant()
        expect(screen.getByText('This receipt link is no longer available')).toBeInTheDocument()
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

    // the bubble follows the state, same rule as an activity row (TASK-22452):
    // a dead link is terminal but nobody failed, a load that failed did.
    test('gone shows a gray dead-link bubble, loadFailed a red alert', () => {
        const { container, unmount } = renderVariant()
        expect(container.querySelector('svg.lucide-unlink')).not.toBeNull()
        expect(container.querySelector('.bg-background-icon-bubble-gray')).not.toBeNull()
        unmount()

        const failed = renderVariant('loadFailed')
        expect(failed.container.querySelector('svg.lucide-triangle-alert')).not.toBeNull()
        expect(failed.container.querySelector('.bg-background-icon-bubble-red')).not.toBeNull()
    })
})
