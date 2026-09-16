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
import { MercadoPagoStep } from '@/types/manteca.types'

const SERVED_ADDRESS = '0x49200bF84dC26349C86ce040019063FeCE88CB1c'
const CLAIM_LINK = 'https://peanut.me/claim#p=test'
const TX_HASH = '0x' + 'ab'.repeat(32)

function renderStep(claimLink = CLAIM_LINK) {
    const setCurrentStep = jest.fn()
    const view = render(
        <IntlWrapper>
            <MantecaReviewStep
                setCurrentStep={setCurrentStep}
                claimLink={claimLink}
                destinationAddress="somepixkey@bank.br"
                amount="10.00"
                currency="BRL"
            />
        </IntlWrapper>
    )
    const rerenderWithLink = (link: string) =>
        view.rerender(
            <IntlWrapper>
                <MantecaReviewStep
                    setCurrentStep={setCurrentStep}
                    claimLink={link}
                    destinationAddress="somepixkey@bank.br"
                    amount="10.00"
                    currency="BRL"
                />
            </IntlWrapper>
        )
    return { setCurrentStep, rerenderWithLink }
}

// The button is disabled while an attempt is in flight, so a retry can only
// be clicked once the previous attempt has settled.
async function waitForIdle() {
    await waitFor(() => expect(screen.getByRole('button', { name: /withdraw/i })).toBeEnabled())
}

function clickConfirm() {
    // The single enabled primary action ("Withdraw") on the review card —
    // by accessible name, never by position: a stale instance's disabled
    // button at index 0 turned the click into a silent no-op on CI.
    fireEvent.click(screen.getByRole('button', { name: /withdraw/i }))
}

beforeEach(() => {
    jest.clearAllMocks()
    mockClaimLinkSecure.mockResolvedValue(TX_HASH)
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

/**
 * Once the link is claimed its txHash is the only key to the funds: the API
 * holds a claim whose /withdraw did not complete until a retry carries the
 * SAME hash. A retry must never spend the link again (it cannot) nor hand
 * the API a different hash.
 */
describe('MantecaReviewStep — same-hash retry after a claimed link', () => {
    const entityInit = () =>
        mockInitiateWithdraw.mockResolvedValue({
            data: { priceLockCode: 'pl-1', legalEntity: 'CRYPTO_ARG', depositAddress: SERVED_ADDRESS },
        })

    const expectSameHashRetry = (setCurrentStep: jest.Mock) => {
        expect(mockInitiateWithdraw).toHaveBeenCalledTimes(1)
        expect(mockClaimLinkSecure).toHaveBeenCalledTimes(1)
        expect(mockWithdraw).toHaveBeenCalledTimes(2)
        expect(mockWithdraw.mock.calls[0][0]).toMatchObject({ txHash: TX_HASH })
        expect(mockWithdraw.mock.calls[1][0]).toMatchObject({ txHash: TX_HASH })
        expect(setCurrentStep).toHaveBeenCalledTimes(1)
        expect(setCurrentStep).toHaveBeenCalledWith(MercadoPagoStep.SUCCESS)
    }

    test('FUNDING_PENDING_CONFIRMATION, then a retry that succeeds: one init, one claim, identical txHash', async () => {
        entityInit()
        mockWithdraw
            .mockResolvedValueOnce({
                error: 'FUNDING_PENDING_CONFIRMATION',
                message: 'Your funds are on their way. Try again in a moment.',
            })
            .mockResolvedValueOnce({ data: { id: 'synthetic-1' } })

        const { setCurrentStep } = renderStep()
        clickConfirm()

        await waitFor(() => expect(mockWithdraw).toHaveBeenCalledTimes(1))
        expect(await screen.findByText('Your funds are on their way. Try again in a moment.')).toBeInTheDocument()
        expect(setCurrentStep).not.toHaveBeenCalled()

        await waitForIdle()
        clickConfirm()

        await waitFor(() => expect(setCurrentStep).toHaveBeenCalledTimes(1))
        expectSameHashRetry(setCurrentStep)
    })

    test('CLAIM_STORE_UNAVAILABLE, then a retry that succeeds with the same txHash', async () => {
        entityInit()
        mockWithdraw
            .mockResolvedValueOnce({ error: 'CLAIM_STORE_UNAVAILABLE', message: 'Claim store unavailable.' })
            .mockResolvedValueOnce({ data: { id: 'synthetic-1' } })

        const { setCurrentStep } = renderStep()
        clickConfirm()

        expect(await screen.findByText('Claim store unavailable.')).toBeInTheDocument()
        await waitForIdle()
        clickConfirm()

        await waitFor(() => expect(setCurrentStep).toHaveBeenCalledTimes(1))
        expectSameHashRetry(setCurrentStep)
    })

    test('a THROWN withdraw transport error, then a retry that succeeds with the same txHash', async () => {
        entityInit()
        mockWithdraw
            .mockRejectedValueOnce(new Error('Failed to fetch'))
            .mockResolvedValueOnce({ data: { id: 'synthetic-1' } })

        const { setCurrentStep } = renderStep()
        clickConfirm()

        expect(await screen.findByText('Failed to fetch')).toBeInTheDocument()
        await waitForIdle()
        clickConfirm()

        await waitFor(() => expect(setCurrentStep).toHaveBeenCalledTimes(1))
        expectSameHashRetry(setCurrentStep)
    })

    test('a failed init keeps no hash: the retry runs a normal init + claim', async () => {
        mockInitiateWithdraw.mockResolvedValueOnce({ error: 'Failed to lock withdraw price.' })
        mockInitiateWithdraw.mockResolvedValueOnce({
            data: { priceLockCode: 'pl-1', legalEntity: 'CRYPTO_ARG', depositAddress: SERVED_ADDRESS },
        })

        const { setCurrentStep } = renderStep()
        clickConfirm()

        await waitFor(() => expect(mockInitiateWithdraw).toHaveBeenCalledTimes(1))
        await waitForIdle()
        expect(mockClaimLinkSecure).not.toHaveBeenCalled()
        expect(mockWithdraw).not.toHaveBeenCalled()

        clickConfirm()

        await waitFor(() => expect(setCurrentStep).toHaveBeenCalledTimes(1))
        expect(mockInitiateWithdraw).toHaveBeenCalledTimes(2)
        expect(mockClaimLinkSecure).toHaveBeenCalledTimes(1)
        expect(mockWithdraw).toHaveBeenCalledTimes(1)
        expect(mockWithdraw.mock.calls[0][0]).toMatchObject({ txHash: TX_HASH })
    })

    test('a failed claim keeps no hash: the retry claims again and never calls withdraw with a bogus hash', async () => {
        entityInit()
        mockClaimLinkSecure.mockRejectedValueOnce(new Error('User rejected')).mockResolvedValueOnce(TX_HASH)

        const { setCurrentStep } = renderStep()
        clickConfirm()

        expect(await screen.findByText('User rejected')).toBeInTheDocument()
        await waitForIdle()
        expect(mockWithdraw).not.toHaveBeenCalled()

        clickConfirm()

        await waitFor(() => expect(setCurrentStep).toHaveBeenCalledTimes(1))
        expect(mockInitiateWithdraw).toHaveBeenCalledTimes(2)
        expect(mockClaimLinkSecure).toHaveBeenCalledTimes(2)
        expect(mockWithdraw).toHaveBeenCalledTimes(1)
        expect(mockWithdraw.mock.calls[0][0]).toMatchObject({ txHash: TX_HASH })
    })

    test('a rerender with a DIFFERENT claimLink cannot reuse the stored hash', async () => {
        const OTHER_HASH = '0x' + 'cd'.repeat(32)
        entityInit()
        mockWithdraw
            .mockResolvedValueOnce({ error: 'FUNDING_PENDING_CONFIRMATION', message: 'Pending.' })
            .mockResolvedValueOnce({ data: { id: 'synthetic-2' } })
        mockClaimLinkSecure.mockResolvedValueOnce(TX_HASH).mockResolvedValueOnce(OTHER_HASH)

        const { setCurrentStep, rerenderWithLink } = renderStep()
        clickConfirm()

        expect(await screen.findByText('Pending.')).toBeInTheDocument()
        await waitForIdle()

        rerenderWithLink('https://peanut.me/claim#p=other')
        clickConfirm()

        await waitFor(() => expect(setCurrentStep).toHaveBeenCalledTimes(1))
        expect(mockInitiateWithdraw).toHaveBeenCalledTimes(2)
        expect(mockClaimLinkSecure).toHaveBeenCalledTimes(2)
        expect(mockClaimLinkSecure.mock.calls[1][0]).toMatchObject({ link: 'https://peanut.me/claim#p=other' })
        expect(mockWithdraw).toHaveBeenCalledTimes(2)
        expect(mockWithdraw.mock.calls[1][0]).toMatchObject({ txHash: OTHER_HASH })
    })

    test('two clicks in the same tick start ONE attempt', async () => {
        entityInit()

        const { setCurrentStep } = renderStep()
        clickConfirm()
        clickConfirm()

        await waitFor(() => expect(setCurrentStep).toHaveBeenCalledTimes(1))
        expect(mockInitiateWithdraw).toHaveBeenCalledTimes(1)
        expect(mockClaimLinkSecure).toHaveBeenCalledTimes(1)
        expect(mockWithdraw).toHaveBeenCalledTimes(1)
    })
})
