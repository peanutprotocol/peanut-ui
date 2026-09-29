import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { OnrampConfirmationModal } from '../OnrampConfirmationModal'

/**
 * Shown before a bank top-up is created. A top-up is matched on the deposit
 * reference only, so the modal asks for the reference and never for an exact
 * amount.
 */
jest.mock('@/components/0_Bruddle/SlideToConfirm', () => ({ __esModule: true, default: () => null }))

describe('OnrampConfirmationModal', () => {
    it('asks for the reference, not for an exact amount', () => {
        renderWithIntl(<OnrampConfirmationModal visible onClose={jest.fn()} onConfirm={jest.fn()} />)

        expect(screen.getByText('Copy the one-time reference code exactly')).toBeInTheDocument()
        expect(screen.getByText('If the reference is missing or wrong:')).toBeInTheDocument()
        expect(screen.queryByText(/Send exactly/)).not.toBeInTheDocument()
        expect(screen.queryByText(/amount or reference/)).not.toBeInTheDocument()
    })
})
