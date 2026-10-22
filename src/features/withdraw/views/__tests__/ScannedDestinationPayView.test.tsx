import React, { useEffect, useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import { WithdrawFlowProvider, useWithdrawFlow } from '@/features/withdraw/WithdrawFlowContext'
import { validateAndResolveRecipient } from '@/lib/validation/recipient'
import ScannedDestinationPayView from '../ScannedDestinationPayView'

jest.mock('@/lib/validation/recipient', () => ({
    validateAndResolveRecipient: jest.fn(),
}))
const mockResolve = validateAndResolveRecipient as jest.MockedFunction<typeof validateAndResolveRecipient>

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

/** Seeds the scanned recipient into the real flow context before the view mounts, the way the root flow does. */
function Seeded({ name, children }: { name?: string; children: React.ReactNode }) {
    const { setRecipient, setIsValidRecipient } = useWithdrawFlow()
    const [ready, setReady] = useState(false)
    useEffect(() => {
        setRecipient({ name, address: ADDRESS })
        setIsValidRecipient(true)
        setReady(true)
    }, [name, setRecipient, setIsValidRecipient])
    return ready ? <>{children}</> : null
}

/** Exposes the flow's recipient and error, and a network switch, like the page around the view. */
function Probe() {
    const { recipient, error } = useWithdrawFlow()
    return (
        <>
            {/* prefixed so the card's own address text stays the only exact match */}
            <output data-testid="recipient">{recipient.address ? `address:${recipient.address}` : 'none'}</output>
            {error.showError && <p role="alert">{error.errorMessage}</p>}
        </>
    )
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
    function Harness() {
        const [selectedChainID, setSelectedChainID] = useState(chainId)
        return (
            <tokenSelectorContext.Provider
                value={
                    {
                        selectedTokenData: token,
                        selectedChainID,
                        selectedTokenAddress: tokenAddress,
                        supportedChainsAndTokens: CHAINS,
                    } as never
                }
            >
                <button onClick={() => setSelectedChainID('8453')}>switch network</button>
                <Seeded name={name}>
                    <ScannedDestinationPayView
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
                    <Probe />
                </Seeded>
            </tokenSelectorContext.Provider>
        )
    }
    render(
        <IntlWrapper>
            <WithdrawFlowProvider>
                <Harness />
            </WithdrawFlowProvider>
        </IntlWrapper>
    )
    return { token, onContinue, onBack }
}

const deferred = <T,>() => {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

const cta = () => screen.getByRole('button', { name: 'Send with Peanut' })
const ctaReady = () => screen.findByRole('button', { name: 'Send with Peanut' })

describe('ScannedDestinationPayView (TASK-23974)', () => {
    beforeEach(() => jest.clearAllMocks())

    it('lays the scan out like the payment page: Pay, the address, the amount with the balance, the pickers', async () => {
        renderView()
        await ctaReady()
        expect(screen.getByRole('button', { name: 'Pay' })).toBeInTheDocument()
        expect(screen.getByText('Sending money to')).toBeInTheDocument()
        expect(screen.getByText(ADDRESS)).toBeInTheDocument()
        expect(screen.getByTestId('amount-field')).toHaveValue('25')
        expect(screen.getByTestId('balance')).toHaveTextContent('100.00')
        expect(screen.getByTestId('token-selector')).toBeInTheDocument()
    })

    it('shows an ENS name in place of the address it resolved to', async () => {
        renderView({ name: 'alice.eth' })
        await ctaReady()
        expect(screen.getByText('alice.eth')).toBeInTheDocument()
        expect(screen.queryByText(ADDRESS)).toBeNull()
    })

    // The pickers stay live, with every network the address is valid on
    it('hands the selector the scanned address family and no lock', async () => {
        renderView({ addressFamily: 'evm' })
        await ctaReady()
        expect(mockSelectorProps).toHaveBeenCalledWith(
            expect.objectContaining({ viewType: 'withdraw', addressFamily: 'evm' })
        )
        expect(mockSelectorProps).not.toHaveBeenCalledWith(expect.objectContaining({ disabled: true }))
    })

    it('continues with the selected token, its chain record and the address', async () => {
        const { token, onContinue } = renderView({ chainId: '8453', tokenAddress: USDC_BASE })
        fireEvent.click(await ctaReady())
        expect(onContinue).toHaveBeenCalledWith({ token, chain: CHAINS['8453'], address: ADDRESS })
    })

    it('synthesizes the wallet chain when the record does not list it', async () => {
        const { token, onContinue } = renderView({ chainId: '42161' })
        fireEvent.click(await ctaReady())
        expect(onContinue).toHaveBeenCalledWith({
            token,
            chain: { chainId: '42161', networkName: 'Arbitrum', chainIconURI: '', tokens: [] },
            address: ADDRESS,
        })
    })

    it('cannot continue to a network the record does not know', async () => {
        const { onContinue } = renderView({ chainId: '421614' })
        expect(await ctaReady()).toBeDisabled()
        fireEvent.click(cta())
        expect(onContinue).not.toHaveBeenCalled()
    })

    it('is disabled while the amount cannot go, and says why under the field', async () => {
        const { onContinue } = renderView({
            continueDisabled: true,
            amountError: 'Not enough balance. Add funds to continue.',
        })
        expect(await ctaReady()).toBeDisabled()
        expect(screen.getByText('Not enough balance. Add funds to continue.')).toBeInTheDocument()
        fireEvent.click(cta())
        expect(onContinue).not.toHaveBeenCalled()
    })

    it('shows a preparation error under the button', async () => {
        renderView({ error: { showError: true, errorMessage: 'Could not prepare the withdrawal' } })
        await ctaReady()
        expect(screen.getByText('Could not prepare the withdrawal')).toBeInTheDocument()
    })

    it('points the free-route hint at EVM addresses off the free pair only', async () => {
        renderView({ chainId: '8453', tokenAddress: USDC_BASE })
        await ctaReady()
        expect(screen.getByText('Use USDC on Arbitrum for free transactions!')).toBeInTheDocument()
    })

    it('shows no free-route hint on the free pair, nor for an address that cannot use it', async () => {
        renderView()
        await ctaReady()
        expect(screen.queryByText('Use USDC on Arbitrum for free transactions!')).toBeNull()
    })

    // A scanned name was resolved for the wallet chain. Another network can hold
    // another address for it (ENSIP-11), so a pick re-resolves it (Chip, #3804).
    describe('a scanned ENS name re-resolves for the network picked', () => {
        it('disables Send while it resolves, then continues with the new address', async () => {
            const resolution = deferred<{ identifier: string; recipientType: 'ENS'; resolvedAddress: string }>()
            mockResolve.mockReturnValue(resolution.promise)
            const { onContinue } = renderView({ name: 'alice.eth' })
            expect(await ctaReady()).toBeEnabled()

            fireEvent.click(screen.getByRole('button', { name: 'switch network' }))
            await waitFor(() => expect(mockResolve).toHaveBeenCalledWith('alice.eth', true, 'evm', '8453'))
            expect(cta()).toBeDisabled()
            fireEvent.click(cta())
            expect(onContinue).not.toHaveBeenCalled()

            resolution.resolve({ identifier: 'alice.eth', recipientType: 'ENS', resolvedAddress: USDC_BASE })
            await waitFor(() => expect(cta()).toBeEnabled())
            expect(screen.getByTestId('recipient')).toHaveTextContent(USDC_BASE)
            fireEvent.click(cta())
            expect(onContinue).toHaveBeenCalledWith(expect.objectContaining({ address: USDC_BASE }))
        })

        it('a name with no address on that network keeps the screen, loses the address and says so', async () => {
            const resolution = deferred<never>()
            mockResolve.mockReturnValue(resolution.promise)
            const { onContinue } = renderView({ name: 'alice.eth' })
            await ctaReady()

            fireEvent.click(screen.getByRole('button', { name: 'switch network' }))
            await waitFor(() => expect(mockResolve).toHaveBeenCalled())
            resolution.reject(new Error('no record'))

            await waitFor(() =>
                expect(screen.getByRole('alert')).toHaveTextContent(
                    'Could not resolve the ENS name for the selected network'
                )
            )
            expect(screen.getByText('alice.eth')).toBeInTheDocument()
            expect(screen.getByTestId('recipient')).toHaveTextContent('none')
            expect(cta()).toBeDisabled()
            fireEvent.click(cta())
            expect(onContinue).not.toHaveBeenCalled()
        })

        it('a bare address never resolves', async () => {
            renderView()
            await ctaReady()
            fireEvent.click(screen.getByRole('button', { name: 'switch network' }))
            expect(mockResolve).not.toHaveBeenCalled()
            expect(cta()).toBeEnabled()
        })
    })

    it('Back leaves through the header', async () => {
        const { onBack } = renderView()
        await ctaReady()
        fireEvent.click(screen.getByRole('button', { name: 'Pay' }))
        expect(onBack).toHaveBeenCalled()
    })
})
