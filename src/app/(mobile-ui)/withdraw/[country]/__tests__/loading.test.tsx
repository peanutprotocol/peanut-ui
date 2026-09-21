/**
 * The withdraw destination routes are dynamic, so nothing paints until their
 * payload and chunks arrive. This fallback is what the user sees meanwhile, and
 * the two things that make it worth having are that it appears at all and that
 * it does not move the header when the real page replaces it.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import WithdrawDestinationLoading from '../loading'

describe('withdraw destination loading fallback', () => {
    it('shows the loader while the route is on its way', () => {
        render(
            <IntlWrapper>
                <WithdrawDestinationLoading />
            </IntlWrapper>
        )

        expect(screen.getByRole('status')).toBeInTheDocument()
    })

    it('carries a back way out, as a link — the router it would call has not loaded yet', () => {
        render(
            <IntlWrapper>
                <WithdrawDestinationLoading />
            </IntlWrapper>
        )

        expect(screen.getByRole('link')).toHaveAttribute('href', '/withdraw')
    })

    it('renders the same header the real page does, so nothing jumps on arrival', () => {
        const { container } = render(
            <IntlWrapper>
                <WithdrawDestinationLoading />
            </IntlWrapper>
        )

        // the bank form and the review step both open with this shell
        expect(container.firstElementChild).toHaveClass(
            'flex',
            'min-h-inherit',
            'w-full',
            'flex-col',
            'justify-start',
            'gap-8',
            'self-start'
        )
    })
})
