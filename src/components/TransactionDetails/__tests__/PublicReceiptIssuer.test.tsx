import React from 'react'
import { render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { PublicReceiptIssuer } from '../PublicReceiptIssuer'

jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => React.createElement('img', props as Record<string, string>),
}))

jest.mock('@/assets/logos/peanut-logo-dark.svg', () => 'peanut-logo-dark.svg')

describe('PublicReceiptIssuer', () => {
    test('shows the dark Peanut logo and peanut.me without Squirrel Labs details', () => {
        render(
            <IntlWrapper>
                <PublicReceiptIssuer />
            </IntlWrapper>
        )

        expect(screen.getByAltText('Peanut Logo')).toBeInTheDocument()
        expect(screen.getByText('Issued by:')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'peanut.me' })).toHaveAttribute('href', 'https://peanut.me')
        expect(screen.queryByText(/Squirrel Labs/i)).not.toBeInTheDocument()
    })
})
