/**
 * The PIX-key step of a saved Brazil account (TASK-19427 / Chip 5293855702):
 * the saved key arrives preset and valid, and Continue opens qr-pay with that
 * key and the USD amount the withdraw flow carries — never a local amount.
 */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'

const mockRouterPush = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockRouterPush, back: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))

import PixKeySendView from '../PixKeySendView'

const renderView = (props: { destinationParam?: string | null; amountUsdParam?: string | null }) =>
    render(
        <IntlWrapper>
            <PixKeySendView {...props} />
        </IntlWrapper>
    )

const continueButton = () => screen.getByRole('button', { name: /continue/i })

beforeEach(() => mockRouterPush.mockClear())

describe('PixKeySendView — a saved key and an upstream USD amount', () => {
    it('Continue opens qr-pay with the saved key and the USD amount as amountUsd', async () => {
        renderView({ destinationParam: 'ada@example.com', amountUsdParam: '0.2' })

        await waitFor(() => expect(continueButton()).toBeEnabled())
        fireEvent.click(continueButton())

        const pushed = new URL(mockRouterPush.mock.calls[0][0], 'https://peanut.test')
        expect(pushed.pathname).toBe('/qr-pay')
        expect(pushed.searchParams.get('type')).toBe('PIX')
        expect(pushed.searchParams.get('pixKey')).toBe('ada@example.com')
        expect(pushed.searchParams.get('amountUsd')).toBe('0.2')
    })

    it('a malformed amount is dropped; the key still continues', async () => {
        renderView({ destinationParam: 'ada@example.com', amountUsdParam: '1e3' })

        await waitFor(() => expect(continueButton()).toBeEnabled())
        fireEvent.click(continueButton())

        const pushed = new URL(mockRouterPush.mock.calls[0][0], 'https://peanut.test')
        expect(pushed.searchParams.get('pixKey')).toBe('ada@example.com')
        expect(pushed.searchParams.get('amountUsd')).toBeNull()
    })

    it('no amount upstream (a new destination): no amountUsd', async () => {
        renderView({ destinationParam: 'ada@example.com' })

        await waitFor(() => expect(continueButton()).toBeEnabled())
        fireEvent.click(continueButton())

        expect(mockRouterPush.mock.calls[0][0]).not.toContain('amountUsd')
    })
})
