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
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
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

jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }))

jest.mock('@/components/0_Bruddle/Toast', () => ({
    ...jest.requireActual('@/components/0_Bruddle/Toast'),
    useToast: () => ({ toast: jest.fn(), success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}))

import MantecaReviewStep from '../MantecaReviewStep'

const SERVED_ADDRESS = '0x49200bF84dC26349C86ce040019063FeCE88CB1c'

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
    // The single enabled primary action ("Withdraw") on the review card —
    // by accessible name, never by position: a stale instance's disabled
    // button at index 0 turned the click into a silent no-op on CI.
    fireEvent.click(screen.getByRole('button', { name: /withdraw/i }))
}

beforeEach(() => {
    jest.clearAllMocks()
    mockClaimLinkSecure.mockResolvedValue('0x' + 'ab'.repeat(32))
    mockAssociateClaim.mockResolvedValue(undefined)
    mockWithdraw.mockResolvedValue({ data: { id: 'synthetic-1' } })
})

describe('MantecaReviewStep — pre-claim entity lookup', () => {
    test('claims the link to the API-served entity deposit address', async () => {
        mockInitiateWithdraw.mockResolvedValue({
            data: { priceLockCode: 'pl-1', legalEntity: 'CRYPTO_ARG', depositAddress: SERVED_ADDRESS },
        })

        renderStep()
        clickConfirm()

        await waitFor(() => expect(mockClaimLinkSecure).toHaveBeenCalledTimes(1))
        expect(mockInitiateWithdraw).toHaveBeenCalledWith({ amount: '10.00', currency: 'BRL' })
        expect(mockClaimLinkSecure).toHaveBeenCalledWith(expect.objectContaining({ address: SERVED_ADDRESS }))
        await waitFor(() => expect(mockWithdraw).toHaveBeenCalledTimes(1))
    })

    test('a PRE-ENTITY API response (no legalEntity) falls back to the legacy constant — deploy-window safe', async () => {
        // The older API omits both fields and still validates the legacy
        // constant, so the claim must proceed rather than abort: this is the
        // window where the new UI meets the not-yet-deployed API.
        mockInitiateWithdraw.mockResolvedValue({ data: { priceLockCode: 'pl-1' } })

        renderStep()
        clickConfirm()

        await waitFor(() => expect(mockClaimLinkSecure).toHaveBeenCalled())
        expect(mockClaimLinkSecure).toHaveBeenCalledWith(
            expect.objectContaining({ address: '0x959e088a09f61aB01cb83b0eBCc74b2CF6d62053' })
        )
    })

    test('FAILS CLOSED when the API returns no depositAddress — the one-shot link is never spent', async () => {
        mockInitiateWithdraw.mockResolvedValue({ data: { priceLockCode: 'pl-1', legalEntity: 'CRYPTO_ARG' } })

        renderStep()
        clickConfirm()

        await waitFor(() => expect(mockInitiateWithdraw).toHaveBeenCalledTimes(1))
        expect(mockClaimLinkSecure).not.toHaveBeenCalled()
        expect(mockWithdraw).not.toHaveBeenCalled()
    })

    test('FAILS CLOSED on a malformed or zero served address', async () => {
        for (const bad of ['', 'not-an-address', '0x0000000000000000000000000000000000000000']) {
            cleanup()
            jest.clearAllMocks()
            mockClaimLinkSecure.mockResolvedValue('0x' + 'ab'.repeat(32))
            mockInitiateWithdraw.mockResolvedValue({
                data: { priceLockCode: 'pl-1', legalEntity: 'CRYPTO_ARG', depositAddress: bad },
            })

            renderStep()
            clickConfirm()

            await waitFor(() => expect(mockInitiateWithdraw).toHaveBeenCalledTimes(1))
            expect(mockClaimLinkSecure).not.toHaveBeenCalled()
        }
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
