/**
 * The pin row is the reveal toggle (visual-qa verdict on ui#3201): tapping
 * the row fetches and shows the pin, tapping again masks it. Also locks the
 * branch switch to the no-pin empty state when Rain reports no pin.
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { IntlWrapper } from '@/test-utils/intl'
import CardPinScreen from '@/components/Card/CardPinScreen'
import { rainApi } from '@/services/rain'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/services/rain', () => ({
    rainApi: { getCardPin: jest.fn() },
    RainCardRateLimitError: class RainCardRateLimitError extends Error {},
}))

const mockGetPin = rainApi.getCardPin as jest.Mock

const renderScreen = () =>
    render(
        <NuqsTestingAdapter>
            <IntlWrapper>
                <CardPinScreen cardId="card-1" />
            </IntlWrapper>
        </NuqsTestingAdapter>
    )

describe('CardPinScreen', () => {
    beforeEach(() => jest.clearAllMocks())

    it('reveals the pin on row tap and masks it on the second tap', async () => {
        mockGetPin.mockResolvedValue('4321')
        renderScreen()
        expect(screen.getByText('****')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Show pin' }))
        expect(await screen.findByText('4321')).toBeInTheDocument()
        expect(mockGetPin).toHaveBeenCalledWith('card-1')
        fireEvent.click(screen.getByRole('button', { name: 'Hide pin' }))
        expect(screen.getByText('****')).toBeInTheDocument()
    })

    it('switches to the no-pin empty state when rain reports no pin set', async () => {
        mockGetPin.mockResolvedValue(null)
        renderScreen()
        fireEvent.click(screen.getByRole('button', { name: 'Show pin' }))
        expect(await screen.findByText('No pin set yet')).toBeInTheDocument()
    })
})
