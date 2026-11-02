import React, { useEffect, useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import { WithdrawFlowProvider, useWithdrawFlow, type ScannedRecipient } from '@/features/withdraw/WithdrawFlowContext'
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
    default: (props: {
        initialAmount?: string
        setPrimaryAmount: (v: string) => void
        walletBalance?: string
        onSubmit?: () => void
    }) => (
        <>
            {/* Enter in the field submits, like the real input */}
            <input
                data-testid="amount-field"
                value={props.initialAmount ?? ''}
                onChange={(e) => props.setPrimaryAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && props.onSubmit?.()}
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

// the selector reads the token context itself; the view only tells it the address family.
// One test runs the real selector, to let its own correction move the selection.
const mockSelectorProps = jest.fn()
let mockRealSelector = false
jest.mock('@/components/Global/TokenSelector/TokenSelector', () => ({
    __esModule: true,
    default: function MockTokenSelector(props: Record<string, unknown>) {
        mockSelectorProps(props)
        if (mockRealSelector) {
            const Real = jest.requireActual('@/components/Global/TokenSelector/TokenSelector').default
            return <Real {...props} />
        }
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
    // the real selector's wallet-chain entry
    PEANUT_WALLET_TOKEN_SYMBOL: 'USDC',
    PEANUT_WALLET_TOKEN_NAME: 'USD Coin',
    PEANUT_WALLET_TOKEN_DECIMALS: 6,
}))

const USDC_ARB = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
const USDT_BASE = '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2'
const WETH_BASE = '0x4200000000000000000000000000000000000006'
const ADDRESS = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'

const baseToken = (address: string, symbol: string, decimals = 6) => ({
    chainId: '8453',
    address,
    symbol,
    name: symbol,
    decimals,
    logoURI: '',
})
// the record is mainnet-only, so it never lists a sandbox wallet chain; here it
// leaves the wallet chain out on purpose, to cover the synthesized entry. It
// holds metadata only: nothing on this screen reads a price (TASK-23850).
const CHAINS = {
    '8453': {
        chainId: '8453',
        networkName: 'Base',
        chainIconURI: '',
        tokens: [baseToken(USDC_BASE, 'USDC'), baseToken(USDT_BASE, 'USDT'), baseToken(WETH_BASE, 'WETH', 18)],
    },
}
// the wallet chain's USDC, as the selector synthesizes it when the record lacks the chain
const WALLET_USDC = expect.objectContaining({ chainId: '42161', address: USDC_ARB, symbol: 'USDC', decimals: 6 })

/** Seeds the scanned recipient into the real flow context before the view mounts, the way the root flow does. */
function Seeded({ name, scanned, children }: { name?: string; scanned?: ScannedRecipient; children: React.ReactNode }) {
    const { setRecipient, setIsValidRecipient, setScannedRecipient } = useWithdrawFlow()
    const [ready, setReady] = useState(false)
    useEffect(() => {
        setRecipient({ name, address: ADDRESS })
        setIsValidRecipient(true)
        if (scanned) setScannedRecipient(scanned)
        setReady(true)
    }, [name, scanned, setRecipient, setIsValidRecipient, setScannedRecipient])
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
    scanned,
    chains = CHAINS,
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
    /** What the hand-off recorded about the scan: its family, and the chain and asset it named. */
    scanned?: ScannedRecipient
    chains?: Record<string, unknown>
} = {}) {
    const token =
        CHAINS['8453'].tokens.find((candidate) => candidate.address.toLowerCase() === tokenAddress.toLowerCase()) ??
        WALLET_USDC
    function Harness() {
        const [selectedChainID, setSelectedChainID] = useState(chainId)
        const [selectedTokenAddress, setSelectedTokenAddress] = useState(tokenAddress)
        return (
            <tokenSelectorContext.Provider
                value={
                    {
                        selectedChainID,
                        selectedTokenAddress,
                        supportedChainsAndTokens: chains,
                        isLoadingChains: false,
                        setSelectedChainID,
                        setSelectedTokenAddress,
                    } as never
                }
            >
                {/* a network pick selects that network's USDC, as the real selector does */}
                <button
                    onClick={() => {
                        setSelectedChainID('8453')
                        setSelectedTokenAddress(USDC_BASE)
                    }}
                >
                    switch network
                </button>
                <button
                    onClick={() => {
                        setSelectedChainID('42161')
                        setSelectedTokenAddress(USDC_ARB)
                    }}
                >
                    switch back
                </button>
                <button onClick={() => setSelectedTokenAddress(USDT_BASE)}>switch token</button>
                <button onClick={() => setSelectedTokenAddress(WETH_BASE)}>switch to a token not paid out</button>
                <Seeded name={name} scanned={scanned}>
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

    // A bare address names no network: the pickers stay live, with every network it is valid on
    it('a bare address: hands the selector the scanned address family and no lock', async () => {
        renderView({ addressFamily: 'evm', scanned: { addressFamily: 'evm' } })
        await ctaReady()
        expect(mockSelectorProps).toHaveBeenCalledWith(
            expect.objectContaining({ viewType: 'withdraw', addressFamily: 'evm' })
        )
        expect(mockSelectorProps).not.toHaveBeenCalledWith(expect.objectContaining({ disabled: true }))
    })

    it('a bare address can still be sent on another network the user picks', async () => {
        const { onContinue } = renderView({ scanned: { addressFamily: 'evm' } })
        fireEvent.click(await screen.findByText('switch network'))
        fireEvent.click(cta())
        expect(onContinue).toHaveBeenCalledWith(expect.objectContaining({ chain: CHAINS['8453'] }))
    })

    describe('a payment request (EIP-681) is paid on the pair it names, or not at all', () => {
        const BASE_USDC_REQUEST: ScannedRecipient = { addressFamily: 'evm', chainId: '8453', tokenAddress: USDC_BASE }
        const requested = () => renderView({ chainId: '8453', tokenAddress: USDC_BASE, scanned: BASE_USDC_REQUEST })

        it('locks the pickers on the requested token and network', async () => {
            requested()
            await ctaReady()
            expect(mockSelectorProps).toHaveBeenLastCalledWith(expect.objectContaining({ disabled: true }))
        })

        it('continues on the requested pair', async () => {
            const { token, onContinue } = requested()
            fireEvent.click(await ctaReady())
            expect(onContinue).toHaveBeenCalledWith({ token, chain: CHAINS['8453'], address: ADDRESS })
        })

        // Enter in the amount field submits through the same continue
        it('Enter in the amount field continues on the requested pair', async () => {
            const { token, onContinue } = requested()
            await ctaReady()
            fireEvent.keyDown(screen.getByTestId('amount-field'), { key: 'Enter' })
            expect(onContinue).toHaveBeenCalledWith({ token, chain: CHAINS['8453'], address: ADDRESS })
        })

        it('Enter in the amount field on another pair never continues', async () => {
            const { onContinue } = requested()
            await ctaReady()
            fireEvent.click(screen.getByText('switch back'))
            fireEvent.keyDown(screen.getByTestId('amount-field'), { key: 'Enter' })
            fireEvent.click(screen.getByText('switch network'))
            fireEvent.click(screen.getByText('switch token'))
            fireEvent.keyDown(screen.getByTestId('amount-field'), { key: 'Enter' })
            expect(onContinue).not.toHaveBeenCalled()
        })

        // The chain record is what is sent: its own chain id has to be the requested one
        it('a chain record for another chain under the requested id never continues', async () => {
            const { onContinue } = renderView({
                chainId: '8453',
                tokenAddress: USDC_BASE,
                scanned: BASE_USDC_REQUEST,
                chains: { '8453': { chainId: '42161', networkName: 'Arbitrum', chainIconURI: '', tokens: [] } },
            })
            expect(await ctaReady()).toBeDisabled()
            fireEvent.click(cta())
            fireEvent.keyDown(screen.getByTestId('amount-field'), { key: 'Enter' })
            expect(onContinue).not.toHaveBeenCalled()
        })

        it('another network never continues, and the requested one works again', async () => {
            const { onContinue } = requested()
            await ctaReady()
            fireEvent.click(screen.getByText('switch back'))
            expect(cta()).toBeDisabled()
            fireEvent.click(cta())
            expect(onContinue).not.toHaveBeenCalled()

            fireEvent.click(screen.getByText('switch network'))
            expect(cta()).toBeEnabled()
        })

        it('another token on the same network never continues', async () => {
            const { onContinue } = requested()
            await ctaReady()
            fireEvent.click(screen.getByText('switch token'))
            expect(cta()).toBeDisabled()
            fireEvent.click(cta())
            expect(onContinue).not.toHaveBeenCalled()
        })

        // The real selector corrects a pair it does not offer (here the record
        // has no Base tokens) to the wallet chain's USDC by itself.
        it('the selector correcting the pair by itself never continues on the corrected pair', async () => {
            mockRealSelector = true
            try {
                const { onContinue } = renderView({
                    chainId: '8453',
                    tokenAddress: USDC_BASE,
                    scanned: BASE_USDC_REQUEST,
                    chains: { '8453': { ...CHAINS['8453'], tokens: [] } },
                })
                await waitFor(() => expect(screen.queryByText('switch network')).toBeInTheDocument())
                await waitFor(() => expect(cta()).toBeDisabled())
                fireEvent.click(cta())
                expect(onContinue).not.toHaveBeenCalled()
            } finally {
                mockRealSelector = false
            }
        })
    })

    describe('a request that names only its network (no asset)', () => {
        const BASE_ONLY: ScannedRecipient = { addressFamily: 'evm', chainId: '8453' }

        it('keeps the token picker free and continues with another token on that network', async () => {
            const { onContinue } = renderView({ chainId: '8453', tokenAddress: USDC_BASE, scanned: BASE_ONLY })
            await ctaReady()
            expect(mockSelectorProps).not.toHaveBeenCalledWith(expect.objectContaining({ disabled: true }))
            fireEvent.click(screen.getByText('switch token'))
            fireEvent.click(cta())
            expect(onContinue).toHaveBeenCalledWith(
                expect.objectContaining({ token: expect.objectContaining({ address: USDT_BASE }) })
            )
        })

        it('never continues on another network', async () => {
            const { onContinue } = renderView({ chainId: '8453', tokenAddress: USDC_BASE, scanned: BASE_ONLY })
            await ctaReady()
            fireEvent.click(screen.getByText('switch back'))
            expect(cta()).toBeDisabled()
            fireEvent.click(cta())
            expect(onContinue).not.toHaveBeenCalled()
        })
    })

    it('continues with the selected token, its chain record and the address', async () => {
        const { token, onContinue } = renderView({ chainId: '8453', tokenAddress: USDC_BASE })
        fireEvent.click(await ctaReady())
        expect(onContinue).toHaveBeenCalledWith({ token, chain: CHAINS['8453'], address: ADDRESS })
    })

    // TASK-23850: the gate is the chain's withdraw list, not a price lookup
    it('never continues with a token the chain does not pay out', async () => {
        const { onContinue } = renderView({ chainId: '8453', tokenAddress: USDC_BASE })
        await ctaReady()
        fireEvent.click(screen.getByText('switch to a token not paid out'))
        expect(cta()).toBeDisabled()
        fireEvent.click(cta())
        fireEvent.keyDown(screen.getByTestId('amount-field'), { key: 'Enter' })
        expect(onContinue).not.toHaveBeenCalled()
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

        it('a hit after a miss clears the miss message (Chip, #3804)', async () => {
            const miss = deferred<never>()
            const hit = deferred<{ identifier: string; recipientType: 'ENS'; resolvedAddress: string }>()
            mockResolve.mockReturnValueOnce(miss.promise).mockReturnValueOnce(hit.promise)
            renderView({ name: 'alice.eth' })
            await ctaReady()

            fireEvent.click(screen.getByRole('button', { name: 'switch network' }))
            await waitFor(() => expect(mockResolve).toHaveBeenCalledTimes(1))
            miss.reject(new Error('no record'))
            await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

            fireEvent.click(screen.getByRole('button', { name: 'switch back' }))
            await waitFor(() => expect(mockResolve).toHaveBeenCalledTimes(2))
            hit.resolve({ identifier: 'alice.eth', recipientType: 'ENS', resolvedAddress: USDC_BASE })

            await waitFor(() => expect(cta()).toBeEnabled())
            expect(screen.queryByRole('alert')).toBeNull()
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
