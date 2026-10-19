/**
 * SuccessClaimLinkView — the withdraw offer after a Mercado Pago / Pix claim.
 *
 * A link the claimer wanted on Mercado Pago or Pix is claimed into their own
 * Peanut account (TASK-23648); the success screen must then send them on to
 * the normal withdraw for that method, and offer nothing extra to anyone else.
 */
import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
    useSearchParams: () => new URLSearchParams(),
}))
jest.mock('@sentry/nextjs', () => ({ captureMessage: jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/PeanutActionDetailsCard', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/SoundPlayer', () => ({ SoundPlayer: () => null }))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/CreateAccountButton', () => ({
    __esModule: true,
    default: () => <button>Create account</button>,
}))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/hooks/useAppReviewNudge', () => ({ useAppReviewNudge: jest.fn() }))
jest.mock('@/hooks/useRecipientDisplay', () => ({ useRecipientDisplay: () => ({ displayName: 'alice' }) }))
jest.mock('@/hooks/useFriendlyError', () => ({ useFriendlyError: () => (e: unknown) => String(e) }))
const mockLeaveToHome = jest.fn()
jest.mock('@/hooks/useSafeBack', () => ({
    useReturnTo: () => mockLeaveToHome,
    useSafeBack: () => jest.fn(),
}))
jest.mock('../useClaimSuccessPolling', () => ({ useClaimSuccessPolling: jest.fn() }))
jest.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ invalidateQueries: jest.fn(), refetchQueries: jest.fn() }),
}))
jest.mock('@/components/Invites/badge-campaign-context', () => ({ badgeCampaignForLegacyWire: () => null }))

let mockUser: { user: { userId: string } } | null = { user: { userId: 'claimer' } }
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: mockUser, fetchUser: jest.fn() }) }))

let mockRegionalMethodType: 'mercadopago' | 'pix' | null = null
let mockClaimType: 'claim' | 'claim-bank' = 'claim'
jest.mock('@/context/ClaimBankFlowContext', () => ({
    useClaimBankFlow: () => ({
        offrampDetails: null,
        claimType: mockClaimType,
        bankDetails: null,
        regionalMethodType: mockRegionalMethodType,
    }),
}))

import { SuccessClaimLinkView } from '../Success.view'

const props = {
    // a known hash renders the confirmed success state directly
    transactionHash: '0xclaimed',
    setTransactionHash: jest.fn(),
    claimLinkData: {
        amount: 200_000_000n,
        tokenDecimals: 6,
        tokenSymbol: 'USDC',
        tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        chainId: '42161',
        link: 'https://peanut.test/claim#p',
        senderAddress: '0x9999',
        sender: null,
    },
    tokenPrice: 1,
    onCustom: jest.fn(),
} as any

beforeEach(() => {
    jest.clearAllMocks()
    mockUser = { user: { userId: 'claimer' } }
    mockRegionalMethodType = null
    mockClaimType = 'claim'
})

describe('withdraw offer after a regional claim', () => {
    test('Mercado Pago: opens the Argentina withdraw with the claimed amount', () => {
        mockRegionalMethodType = 'mercadopago'
        renderWithIntl(<SuccessClaimLinkView {...props} />)

        fireEvent.click(screen.getByText('Withdraw to Mercado Pago'))

        expect(mockPush).toHaveBeenCalledWith('/withdraw/manteca?method=mercado-pago&country=argentina&amount=200')
        // going home stays available, as the secondary exit
        fireEvent.click(screen.getByText('Back to home'))
        expect(mockLeaveToHome).toHaveBeenCalled()
    })

    test('Pix: opens the Brazil Pix send, which asks for its own amount', () => {
        mockRegionalMethodType = 'pix'
        renderWithIntl(<SuccessClaimLinkView {...props} />)

        fireEvent.click(screen.getByText('Withdraw to Pix'))

        expect(mockPush).toHaveBeenCalledWith('/withdraw/manteca?method=pix&country=brazil')
    })

    test('the amount prefill rounds down to whole cents', () => {
        mockRegionalMethodType = 'mercadopago'
        renderWithIntl(
            <SuccessClaimLinkView {...props} claimLinkData={{ ...props.claimLinkData, amount: 12_345_678n }} />
        )

        fireEvent.click(screen.getByText('Withdraw to Mercado Pago'))

        expect(mockPush).toHaveBeenCalledWith('/withdraw/manteca?method=mercado-pago&country=argentina&amount=12.34')
    })

    test('a cross-chain claim opens the withdraw with no amount', () => {
        // The bridge takes a fee, so the link amount is more than arrives.
        mockRegionalMethodType = 'mercadopago'
        renderWithIntl(<SuccessClaimLinkView {...props} type="claimxchain" />)

        fireEvent.click(screen.getByText('Withdraw to Mercado Pago'))

        expect(mockPush).toHaveBeenCalledWith('/withdraw/manteca?method=mercado-pago&country=argentina')
    })

    test('an ordinary claim offers only the way home', () => {
        renderWithIntl(<SuccessClaimLinkView {...props} />)

        expect(screen.queryByText(/Withdraw to/)).not.toBeInTheDocument()
        expect(screen.getByText('Back to home')).toBeInTheDocument()
    })

    test('a bank claim never offers the regional withdraw', () => {
        mockRegionalMethodType = 'mercadopago'
        mockClaimType = 'claim-bank'
        renderWithIntl(<SuccessClaimLinkView {...props} />)

        expect(screen.queryByText(/Withdraw to/)).not.toBeInTheDocument()
    })
})
