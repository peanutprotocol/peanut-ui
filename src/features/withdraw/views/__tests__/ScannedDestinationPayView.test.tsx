import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import ScannedDestinationPayView from '../ScannedDestinationPayView'

jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: ({ title, onPrev }: { title: string; onPrev: () => void }) => <button onClick={onPrev}>{title}</button>,
}))

jest.mock('@/components/Global/AmountInput', () => ({
    __esModule: true,
    default: (props: { initialAmount?: string; setPrimaryAmount: (v: string) => void; walletBalance?: string }) => (
        <>
            <input
                data-testid="amount-field"
                value={props.initialAmount ?? ''}
                onChange={(e) => props.setPrimaryAmount(e.target.value)}
            />
            <span data-testid="balance">{props.walletBalance}</span>
        </>
    ),
}))

// the card's AddressLink resolves ENS and links out; the view only hands it the recipient
jest.mock('@/components/Global/AddressLink', () => ({
    __esModule: true,
    default: ({ address }: { address: string }) => <span>{address}</span>,
}))

// the selector reads the token context itself; the view only tells it the address family
const mockSelectorProps = jest.fn()
jest.mock('@/components/Global/TokenSelector/TokenSelector', () => ({
    __esModule: true,
    default: (props: unknown) => {
        mockSelectorProps(props)
        return <div data-testid="token-selector" />
    },
}))

// the CTA's own auth and add-funds branches are its own tests' business
jest.mock('@/features/payments/shared/components/SendWithPeanutCta', () => ({
    __esModule: true,
    default: ({ onClick, disabled }: { onClick: () => void; disabled: boolean }) => (
        <button onClick={onClick} disabled={disabled}>
            Send with Peanut
        </button>
    ),
}))

jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161, name: 'Arbitrum' },
    PEANUT_WALLET_TOKEN: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
}))

const USDC_ARB = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
const ADDRESS = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'

// the record is mainnet-only, so it never lists a sandbox wallet chain; here it
// leaves the wallet chain out on purpose, to cover the synthesized entry
const CHAINS = {
    '8453': { chainId: '8453', networkName: 'Base', chainIconURI: '', tokens: [] },
}

function renderView({
    chainId = '42161',
    tokenAddress = USDC_ARB,
    name,
    continueDisabled = false,
    amountError,
    error = { showError: false, errorMessage: '' },
    onContinue = jest.fn(),
    onBack = jest.fn(),
    addressFamily = 'evm' as const,
}: {
    chainId?: string
    tokenAddress?: string
    name?: string
    continueDisabled?: boolean
    amountError?: string
    error?: { showError: boolean; errorMessage: string }
    onContinue?: jest.Mock
    onBack?: jest.Mock
    addressFamily?: 'evm' | 'solana' | 'tron'
} = {}) {
    const token = { address: tokenAddress, symbol: 'USDC', decimals: 6, price: 1 }
    render(
        <IntlWrapper>
            <tokenSelectorContext.Provider
                value={
                    {
                        selectedTokenData: token,
                        selectedChainID: chainId,
                        selectedTokenAddress: tokenAddress,
                        supportedChainsAndTokens: CHAINS,
                    } as never
                }
            >
                <ScannedDestinationPayView
                    recipient={{ name, address: ADDRESS }}
                    addressFamily={addressFamily}
                    initialAmount="25"
                    walletBalance="100.00"
                    balanceFillAmount={100}
                    onBalanceFilled={jest.fn()}
                    onAmountChange={jest.fn()}
                    onBack={onBack}
                    onContinue={onContinue}
                    continueDisabled={continueDisabled}
                    amountError={amountError}
                    error={error}
                />
            </tokenSelectorContext.Provider>
        </IntlWrapper>
    )
    return { token, onContinue, onBack }
}

const cta = () => screen.getByRole('button', { name: 'Send with Peanut' })

describe('ScannedDestinationPayView (TASK-23974)', () => {
    beforeEach(() => jest.clearAllMocks())

    it('lays the scan out like the payment page: Pay, the address, the amount with the balance, the pickers', () => {
        renderView()
        expect(screen.getByRole('button', { name: 'Pay' })).toBeInTheDocument()
        expect(screen.getByText('Sending money to')).toBeInTheDocument()
        expect(screen.getByText(ADDRESS)).toBeInTheDocument()
        expect(screen.getByTestId('amount-field')).toHaveValue('25')
        expect(screen.getByTestId('balance')).toHaveTextContent('100.00')
        expect(screen.getByTestId('token-selector')).toBeInTheDocument()
    })

    it('shows an ENS name in place of the address it resolved to', () => {
        renderView({ name: 'alice.eth' })
        expect(screen.getByText('alice.eth')).toBeInTheDocument()
        expect(screen.queryByText(ADDRESS)).toBeNull()
    })

    // The pickers stay live, with every network the address is valid on
    it('hands the selector the scanned address family and no lock', () => {
        renderView({ addressFamily: 'evm' })
        expect(mockSelectorProps).toHaveBeenCalledWith(
            expect.objectContaining({ viewType: 'withdraw', addressFamily: 'evm' })
        )
        expect(mockSelectorProps).not.toHaveBeenCalledWith(expect.objectContaining({ disabled: true }))
    })

    it('continues with the selected token, its chain record and the address', () => {
        const { token, onContinue } = renderView({ chainId: '8453', tokenAddress: USDC_BASE })
        fireEvent.click(cta())
        expect(onContinue).toHaveBeenCalledWith({ token, chain: CHAINS['8453'], address: ADDRESS })
    })

    it('synthesizes the wallet chain when the record does not list it', () => {
        const { token, onContinue } = renderView({ chainId: '42161' })
        fireEvent.click(cta())
        expect(onContinue).toHaveBeenCalledWith({
            token,
            chain: { chainId: '42161', networkName: 'Arbitrum', chainIconURI: '', tokens: [] },
            address: ADDRESS,
        })
    })

    it('cannot continue to a network the record does not know', () => {
        const { onContinue } = renderView({ chainId: '421614' })
        expect(cta()).toBeDisabled()
        fireEvent.click(cta())
        expect(onContinue).not.toHaveBeenCalled()
    })

    it('is disabled while the amount cannot go, and says why under the field', () => {
        const { onContinue } = renderView({
            continueDisabled: true,
            amountError: 'Not enough balance. Add funds to continue.',
        })
        expect(cta()).toBeDisabled()
        expect(screen.getByText('Not enough balance. Add funds to continue.')).toBeInTheDocument()
        fireEvent.click(cta())
        expect(onContinue).not.toHaveBeenCalled()
    })

    it('shows a preparation error under the button', () => {
        renderView({ error: { showError: true, errorMessage: 'Could not prepare the withdrawal' } })
        expect(screen.getByText('Could not prepare the withdrawal')).toBeInTheDocument()
    })

    it('points the free-route hint at EVM addresses off the free pair only', () => {
        renderView({ chainId: '8453', tokenAddress: USDC_BASE })
        expect(screen.getByText('Use USDC on Arbitrum for free transactions!')).toBeInTheDocument()
    })

    it('shows no free-route hint on the free pair, nor for an address that cannot use it', () => {
        renderView()
        expect(screen.queryByText('Use USDC on Arbitrum for free transactions!')).toBeNull()
    })

    it('Back leaves through the header', () => {
        const { onBack } = renderView()
        fireEvent.click(screen.getByRole('button', { name: 'Pay' }))
        expect(onBack).toHaveBeenCalled()
    })
})
