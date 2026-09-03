/**
 * MantecaReviewStep — the claim-link offramp's pre-claim entity lookup.
 *
 * This is the safety boundary that keeps a ONE-SHOT claim link from funding
 * the wrong Manteca entity after the 2026-09-14 split:
 *   - the API-served depositAddress from /withdraw/init must be the address
 *     the link is claimed to,
 *   - an init failure must abort BEFORE the link is spent — no claim, no
 *     withdraw — because the link cannot be re-claimed.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'

const mockInitiateWithdraw = jest.fn()
const mockWithdraw = jest.fn()
jest.mock('@/services/manteca', () => ({
    mantecaApi: {
        initiateWithdraw: (...args: unknown[]) => mockInitiateWithdraw(...args),
        withdraw: (...args: unknown[]) => mockWithdraw(...args),
    },
}))

const mockAssociateClaim = jest.fn()
jest.mock('@/services/sendLinks', () => ({
    sendLinksApi: { associateClaim: (...args: unknown[]) => mockAssociateClaim(...args) },
}))

const mockClaimLinkSecure = jest.fn()
jest.mock('@/components/Claim/useClaimLink', () => ({
    __esModule: true,
    default: () => ({ claimLink: mockClaimLinkSecure }),
}))

jest.mock('@/hooks/useCurrency', () => ({
    useCurrency: () => ({ price: { sell: '1300' }, isLoading: false, refetch: jest.fn() }),
}))

jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))

jest.mock('@/components/0_Bruddle/Toast', () => ({
    ...jest.requireActual('@/components/0_Bruddle/Toast'),
    useToast: () => ({ toast: jest.fn(), success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}))

import MantecaReviewStep from '../MantecaReviewStep'

const SERVED_ADDRESS = '0x49200bF84dC26349C86ce040019063FeCE88CB1c'
const LEGACY_ADDRESS = '0x959e088a09f61aB01cb83b0eBCc74b2CF6d62053'

function renderStep() {
    const setCurrentStep = jest.fn()
    render(
        <IntlWrapper>
            <MantecaReviewStep
                setCurrentStep={setCurrentStep}
                claimLink="https://peanut.me/claim#p=test"
                destinationAddress="somepixkey@bank.br"
                amount="10.00"
                currency="BRL"
            />
        </IntlWrapper>
    )
    return { setCurrentStep }
}

function clickConfirm() {
    // The single primary action button on the review card.
    fireEvent.click(screen.getAllByRole('button')[0])
}

beforeEach(() => {
    jest.clearAllMocks()
    mockClaimLinkSecure.mockResolvedValue('0x' + 'ab'.repeat(32))
    mockAssociateClaim.mockResolvedValue(undefined)
    mockWithdraw.mockResolvedValue({ data: { id: 'synthetic-1' } })
})

describe('MantecaReviewStep — pre-claim entity lookup', () => {
    test('claims the link to the API-served entity deposit address', async () => {
        mockInitiateWithdraw.mockResolvedValue({ data: { priceLockCode: 'pl-1', depositAddress: SERVED_ADDRESS } })

        renderStep()
        clickConfirm()

        await waitFor(() => expect(mockClaimLinkSecure).toHaveBeenCalledTimes(1))
        expect(mockInitiateWithdraw).toHaveBeenCalledWith({ amount: '10.00', currency: 'BRL' })
        expect(mockClaimLinkSecure).toHaveBeenCalledWith(expect.objectContaining({ address: SERVED_ADDRESS }))
        await waitFor(() => expect(mockWithdraw).toHaveBeenCalledTimes(1))
    })

    test('falls back to the constant when an older API returns no depositAddress', async () => {
        mockInitiateWithdraw.mockResolvedValue({ data: { priceLockCode: 'pl-1' } })

        renderStep()
        clickConfirm()

        await waitFor(() => expect(mockClaimLinkSecure).toHaveBeenCalledTimes(1))
        expect(mockClaimLinkSecure).toHaveBeenCalledWith(expect.objectContaining({ address: LEGACY_ADDRESS }))
    })

    test('an init error aborts BEFORE the one-shot link is spent — no claim, no withdraw', async () => {
        mockInitiateWithdraw.mockResolvedValue({ error: 'Failed to lock withdraw price.' })

        renderStep()
        clickConfirm()

        await waitFor(() => expect(mockInitiateWithdraw).toHaveBeenCalledTimes(1))
        expect(mockClaimLinkSecure).not.toHaveBeenCalled()
        expect(mockWithdraw).not.toHaveBeenCalled()
        expect(mockAssociateClaim).not.toHaveBeenCalled()
    })
})
