/**
 * MantecaFlowManager — the claimed hash must survive the review step's
 * remounts.
 *
 * The manager renders MantecaReviewStep only on REVIEW. Back goes to DETAILS
 * and unmounts it, so anything the step kept for itself is gone when the
 * user comes back. The link is one-shot: after the first claim the only
 * key to the funds is the txHash, and the API holds the pending claim until
 * a /withdraw retry carries that SAME hash. A fresh claim there is a spent
 * link and a lost hash.
 */
import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

// The seam: the real details step needs a validated CBU/alias before it
// enables Review. Step changes are what this suite drives, so expose them.
jest.mock('../views/MantecaDetailsStep.view', () => ({
    __esModule: true,
    default: ({
        setCurrentStep,
        setDestinationAddress,
    }: {
        setCurrentStep: (s: string) => void
        setDestinationAddress: (v: string) => void
    }) => (
        <button
            data-testid="go-review"
            onClick={() => {
                setDestinationAddress('some.alias')
                setCurrentStep('review')
            }}
        >
            review
        </button>
    ),
}))

jest.mock('@/context/ClaimBankFlowContext', () => ({
    useClaimBankFlow: () => ({
        setClaimToMercadoPago: jest.fn(),
        selectedCountry: { id: 'AR', currency: 'ARS' },
        regionalMethodType: 'mercadopago',
    }),
}))
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ canDo: () => true, isKycApproved: true, rails: [], nextActions: [] }),
}))
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => ({
        handleInitiateKyc: jest.fn(),
        handleRestartIdentity: jest.fn(),
        handleFixableRejection: jest.fn(),
        isLoading: false,
        error: null,
        errorCooldown: null,
    }),
}))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))
jest.mock('@/components/Kyc/InitiateKycModal', () => ({ InitiateKycModal: () => null }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null }) }))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
    usePathname: () => '/claim',
    useSearchParams: () => new URLSearchParams(),
}))

import MantecaFlowManager from '../MantecaFlowManager'

const CLAIM_LINK = 'https://peanut.me/claim#p=test'
const TX_HASH = '0x' + 'ab'.repeat(32)
const SERVED_ADDRESS = '0x49200bF84dC26349C86ce040019063FeCE88CB1c'

const claimLinkData = (link: string) => ({ link, tokenSymbol: 'USDC' }) as never

function renderFlow(link = CLAIM_LINK) {
    return render(
        <IntlWrapper>
            <MantecaFlowManager
                claimLinkData={claimLinkData(link)}
                amount="10.00"
                attachment={{ message: undefined, attachmentUrl: undefined }}
            />
        </IntlWrapper>
    )
}

const goToReview = () => fireEvent.click(screen.getByTestId('go-review'))
const goBack = () => fireEvent.click(screen.getByTestId('nav-back'))
const clickWithdraw = () => fireEvent.click(screen.getByRole('button', { name: /withdraw/i }))
const expectOnDetails = () => expect(screen.getByTestId('go-review')).toBeInTheDocument()
const expectOnSuccess = async () =>
    await waitFor(() => expect(screen.getByRole('button', { name: /back to home/i })).toBeInTheDocument())

beforeEach(() => {
    jest.clearAllMocks()
    mockInitiateWithdraw.mockResolvedValue({
        data: { priceLockCode: 'pl-1', legalEntity: 'CRYPTO_ARG', depositAddress: SERVED_ADDRESS },
    })
    mockClaimLinkSecure.mockResolvedValue(TX_HASH)
    mockAssociateClaim.mockResolvedValue(undefined)
    mockWithdraw.mockResolvedValue({ data: { id: 'synthetic-1' } })
})

describe('MantecaFlowManager — claimed hash survives DETAILS ⇄ REVIEW', () => {
    test('pending withdraw, Back, Review again, Withdraw: same txHash, one init, one claim, two withdraws', async () => {
        mockWithdraw
            .mockResolvedValueOnce({ error: 'FUNDING_PENDING_CONFIRMATION', message: 'Pending.' })
            .mockResolvedValueOnce({ data: { id: 'synthetic-1' } })

        renderFlow()
        goToReview()
        clickWithdraw()
        expect(await screen.findByText('Pending.')).toBeInTheDocument()
        expect(mockClaimLinkSecure).toHaveBeenCalledTimes(1)

        goBack()
        expectOnDetails()
        goToReview()
        // A remounted step: no error carried over, and the link is not
        // claimed again.
        expect(screen.queryByText('Pending.')).not.toBeInTheDocument()
        clickWithdraw()

        await expectOnSuccess()
        expect(mockInitiateWithdraw).toHaveBeenCalledTimes(1)
        expect(mockClaimLinkSecure).toHaveBeenCalledTimes(1)
        expect(mockWithdraw).toHaveBeenCalledTimes(2)
        expect(mockWithdraw.mock.calls[0][0]).toMatchObject({ txHash: TX_HASH })
        expect(mockWithdraw.mock.calls[1][0]).toMatchObject({ txHash: TX_HASH })
    })

    test('a different link in a new flow never reuses the first flow’s hash', async () => {
        const OTHER_LINK = 'https://peanut.me/claim#p=other'
        const OTHER_HASH = '0x' + 'cd'.repeat(32)
        mockWithdraw
            .mockResolvedValueOnce({ error: 'FUNDING_PENDING_CONFIRMATION', message: 'Pending.' })
            .mockResolvedValueOnce({ data: { id: 'synthetic-2' } })
        mockClaimLinkSecure.mockResolvedValueOnce(TX_HASH).mockResolvedValueOnce(OTHER_HASH)

        const first = renderFlow()
        goToReview()
        clickWithdraw()
        expect(await screen.findByText('Pending.')).toBeInTheDocument()
        first.unmount()

        renderFlow(OTHER_LINK)
        goToReview()
        clickWithdraw()

        await expectOnSuccess()
        expect(mockClaimLinkSecure).toHaveBeenCalledTimes(2)
        expect(mockClaimLinkSecure.mock.calls[1][0]).toMatchObject({ link: OTHER_LINK })
        expect(mockWithdraw).toHaveBeenCalledTimes(2)
        expect(mockWithdraw.mock.calls[1][0]).toMatchObject({ txHash: OTHER_HASH })
    })

    test('Back and Review again while the first attempt is in flight cannot start a second claim or withdraw', async () => {
        let resolveClaim: (hash: string) => void = () => {}
        mockClaimLinkSecure.mockImplementationOnce(
            () =>
                new Promise<string>((resolve) => {
                    resolveClaim = resolve
                })
        )
        let resolveWithdraw: (r: unknown) => void = () => {}
        mockWithdraw.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveWithdraw = resolve
                })
        )

        renderFlow()
        goToReview()
        clickWithdraw()
        await waitFor(() => expect(mockClaimLinkSecure).toHaveBeenCalledTimes(1))

        // Claim still pending: the remounted step's button is enabled again
        // (fresh local state), so only the hoisted guard stands in the way.
        goBack()
        expectOnDetails()
        goToReview()
        clickWithdraw()
        clickWithdraw()
        expect(mockInitiateWithdraw).toHaveBeenCalledTimes(1)
        expect(mockClaimLinkSecure).toHaveBeenCalledTimes(1)

        await act(async () => resolveClaim(TX_HASH))
        await waitFor(() => expect(mockWithdraw).toHaveBeenCalledTimes(1))

        // Withdraw still pending: same guard, no second withdraw.
        goBack()
        goToReview()
        clickWithdraw()
        expect(mockWithdraw).toHaveBeenCalledTimes(1)
        expect(mockClaimLinkSecure).toHaveBeenCalledTimes(1)

        await act(async () => resolveWithdraw({ data: { id: 'synthetic-1' } }))
        await expectOnSuccess()
        expect(mockInitiateWithdraw).toHaveBeenCalledTimes(1)
        expect(mockClaimLinkSecure).toHaveBeenCalledTimes(1)
        expect(mockWithdraw).toHaveBeenCalledTimes(1)
        expect(mockWithdraw.mock.calls[0][0]).toMatchObject({ txHash: TX_HASH })
    })

    test('after the in-flight attempt settles as pending, the next Withdraw retries the same hash', async () => {
        let resolveWithdraw: (r: unknown) => void = () => {}
        mockWithdraw
            .mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        resolveWithdraw = resolve
                    })
            )
            .mockResolvedValueOnce({ data: { id: 'synthetic-1' } })

        renderFlow()
        goToReview()
        clickWithdraw()
        await waitFor(() => expect(mockWithdraw).toHaveBeenCalledTimes(1))

        goBack()
        goToReview()
        await act(async () => resolveWithdraw({ error: 'FUNDING_PENDING_CONFIRMATION', message: 'Pending.' }))
        clickWithdraw()

        await expectOnSuccess()
        expect(mockClaimLinkSecure).toHaveBeenCalledTimes(1)
        expect(mockWithdraw).toHaveBeenCalledTimes(2)
        expect(mockWithdraw.mock.calls[1][0]).toMatchObject({ txHash: TX_HASH })
    })
})
