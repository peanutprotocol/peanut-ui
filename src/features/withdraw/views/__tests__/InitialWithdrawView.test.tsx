import React, { useEffect, useMemo, useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { WithdrawFlowProvider, useWithdrawFlow } from '@/features/withdraw/WithdrawFlowContext'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import InitialWithdrawView from '../../views/InitialWithdrawView'
import { validateAndResolveRecipient } from '@/lib/validation/recipient'

jest.mock('@/lib/validation/recipient', () => ({
    validateAndResolveRecipient: jest.fn(),
}))

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({
        children,
        disabled,
        onClick,
    }: {
        children: React.ReactNode
        disabled: boolean
        onClick: () => void
    }) => (
        <button disabled={disabled} onClick={onClick}>
            {children}
        </button>
    ),
}))

const USDT_TRON = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'

jest.mock('@/components/Global/GeneralRecipientInput', () => ({
    __esModule: true,
    default: ({ onUpdate }: { onUpdate: (update: unknown) => void }) => (
        <>
            <button
                onClick={() =>
                    onUpdate({
                        recipient: { name: 'alice.eth', address: '0x1111111111111111111111111111111111111111' },
                        isValid: true,
                        isChanging: false,
                        errorMessage: '',
                    })
                }
            >
                set ENS recipient
            </button>
            {/* what the input reports for a Tron address while an EVM network is selected:
                the typing update first, then the failed EVM validation */}
            <button
                onClick={() => {
                    onUpdate({
                        recipient: { name: undefined, address: 'TJRabPrwbZy45sbavfcjinPJC18kjpRTv8' },
                        isValid: false,
                        isChanging: true,
                        errorMessage: '',
                    })
                    onUpdate({
                        recipient: { name: undefined, address: 'TJRabPrwbZy45sbavfcjinPJC18kjpRTv8' },
                        isValid: false,
                        isChanging: false,
                        errorMessage: 'Enter a wallet address or an ENS name.',
                    })
                }}
            >
                paste Tron address
            </button>
        </>
    ),
}))

const mockKillSwitches = { disableXchainWithdraw: false }
jest.mock('@/features/kill-switches/useKillSwitches', () => ({ useKillSwitches: () => mockKillSwitches }))

jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: () => null,
}))

jest.mock('@/components/Global/PeanutActionDetailsCard', () => ({
    __esModule: true,
    default: () => null,
}))

// stand-in exposing the selector's two callbacks as buttons, plus a token pick,
// which (as in the real selector) writes the token and calls neither
jest.mock('@/components/Global/TokenSelector/TokenSelector', () => ({
    __esModule: true,
    default: ({
        onAutoCorrect,
        onNetworkSelect,
        networkHelper,
    }: {
        onAutoCorrect?: () => void
        onNetworkSelect?: () => void
        networkHelper?: string
    }) => {
        const { tokenSelectorContext } = jest.requireActual('@/context/tokenSelector.context')
        const { setSelectedTokenAddress } = jest.requireActual('react').useContext(tokenSelectorContext)
        return (
            <>
                {networkHelper && <p>{networkHelper}</p>}
                <button onClick={onAutoCorrect}>selector auto-correct</button>
                <button onClick={onNetworkSelect}>selector network pick</button>
                <button onClick={() => setSelectedTokenAddress('0x3333333333333333333333333333333333333333')}>
                    selector token pick
                </button>
            </>
        )
    },
}))

jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 1, name: 'Ethereum' },
    PEANUT_WALLET_TOKEN: '0x0000000000000000000000000000000000000000',
}))

const mockValidateAndResolveRecipient = validateAndResolveRecipient as jest.MockedFunction<
    typeof validateAndResolveRecipient
>

const deferred = <T,>() => {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((resolvePromise) => {
        resolve = resolvePromise
    })
    return { promise, resolve }
}

const NATIVE = '0x0000000000000000000000000000000000000000'
const BASE_WETH = '0x4200000000000000000000000000000000000006'
// the chain/token record holds metadata only: no token in it carries a price
const token = (chainId: string, symbol: string, address = NATIVE) => ({
    chainId,
    address,
    symbol,
    name: symbol,
    decimals: 18,
    logoURI: '',
})
const supportedChainsAndTokens = {
    '1': { chainId: '1', networkName: 'Ethereum', chainIconURI: '', tokens: [token('1', 'ETH')] },
    '8453': {
        chainId: '8453',
        networkName: 'Base',
        chainIconURI: '',
        tokens: [token('8453', 'ETH'), token('8453', 'WETH', BASE_WETH)],
    },
    '56': { chainId: '56', networkName: 'BNB Smart Chain', chainIconURI: '', tokens: [token('56', 'BNB')] },
    // Polygon's withdraw list has USDC and USDT only: native POL is not delivered
    '137': { chainId: '137', networkName: 'Polygon', chainIconURI: '', tokens: [token('137', 'POL')] },
}

function TestHarness({
    chainId = '1',
    tokenAddress = NATIVE,
    onContinue = jest.fn(),
}: {
    chainId?: string
    tokenAddress?: string
    onContinue?: jest.Mock
}) {
    const [selectedChainID, setSelectedChainID] = useState(chainId)
    const tokenContext = useMemo(
        () =>
            ({
                selectedTokenAddress: tokenAddress,
                selectedChainID,
                supportedChainsAndTokens,
                setSelectedChainID: jest.fn(),
                setSelectedTokenAddress: jest.fn(),
            }) as unknown as React.ContextType<typeof tokenSelectorContext>,
        [selectedChainID, tokenAddress]
    )

    return (
        <WithdrawFlowProvider>
            <tokenSelectorContext.Provider value={tokenContext}>
                <button onClick={() => setSelectedChainID('8453')}>switch network</button>
                <InitialWithdrawView onContinue={onContinue} />
            </tokenSelectorContext.Provider>
        </WithdrawFlowProvider>
    )
}

/**
 * Mount-effect harness: optionally seeds a valid prefilled recipient (an
 * address-book tap) into the real flow context BEFORE the view mounts, and
 * exposes the token-context setters so the default reset can be asserted.
 */
function MountSeeder({
    prefillAddress,
    networkUnconfirmed = false,
    setSelectedChainID,
    setSelectedTokenAddress,
}: {
    prefillAddress?: string
    networkUnconfirmed?: boolean
    setSelectedChainID: jest.Mock
    setSelectedTokenAddress: jest.Mock
}) {
    const { setRecipient, setIsValidRecipient, setNetworkUnconfirmed } = useWithdrawFlow()
    const [ready, setReady] = useState(!prefillAddress)
    useEffect(() => {
        if (!prefillAddress) return
        setRecipient({ name: undefined, address: prefillAddress })
        setIsValidRecipient(true)
        setNetworkUnconfirmed(networkUnconfirmed)
        setReady(true)
    }, [prefillAddress, networkUnconfirmed, setRecipient, setIsValidRecipient, setNetworkUnconfirmed])
    const tokenContext = useMemo(
        () =>
            ({
                selectedTokenAddress: NATIVE,
                selectedChainID: prefillAddress ? '8453' : '1',
                supportedChainsAndTokens,
                setSelectedChainID,
                setSelectedTokenAddress,
            }) as unknown as React.ContextType<typeof tokenSelectorContext>,
        [prefillAddress, setSelectedChainID, setSelectedTokenAddress]
    )
    if (!ready) return null
    return (
        <tokenSelectorContext.Provider value={tokenContext}>
            <InitialWithdrawView onContinue={jest.fn()} />
        </tokenSelectorContext.Provider>
    )
}

const renderMountHarness = (prefillAddress?: string, { networkUnconfirmed = false } = {}) => {
    const setSelectedChainID = jest.fn()
    const setSelectedTokenAddress = jest.fn()
    render(
        <IntlWrapper>
            <WithdrawFlowProvider>
                <MountSeeder
                    prefillAddress={prefillAddress}
                    networkUnconfirmed={networkUnconfirmed}
                    setSelectedChainID={setSelectedChainID}
                    setSelectedTokenAddress={setSelectedTokenAddress}
                />
            </WithdrawFlowProvider>
        </IntlWrapper>
    )
    return { setSelectedChainID, setSelectedTokenAddress }
}

/** real chain + token state, with the Tron record the selector reads */
function TronHarness() {
    const [selectedChainID, setSelectedChainID] = useState('1')
    const [selectedTokenAddress, setSelectedTokenAddress] = useState('0x0000000000000000000000000000000000000000')
    const tokenContext = useMemo(
        () =>
            ({
                selectedTokenAddress,
                selectedChainID,
                supportedChainsAndTokens: {
                    ...supportedChainsAndTokens,
                    tron: {
                        chainId: 'tron',
                        networkName: 'Tron',
                        chainIconURI: '',
                        tokens: [token('tron', 'USDT', USDT_TRON)],
                    },
                },
                setSelectedChainID,
                setSelectedTokenAddress,
            }) as unknown as React.ContextType<typeof tokenSelectorContext>,
        [selectedChainID, selectedTokenAddress]
    )
    return (
        <WithdrawFlowProvider>
            <tokenSelectorContext.Provider value={tokenContext}>
                <output data-testid="chain">{selectedChainID}</output>
                <output data-testid="token">{selectedTokenAddress}</output>
                <InitialWithdrawView onContinue={jest.fn()} />
            </tokenSelectorContext.Provider>
        </WithdrawFlowProvider>
    )
}

describe('InitialWithdrawView', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockKillSwitches.disableXchainWithdraw = false
    })

    it('a Tron address on an EVM network moves the selector to USDT on Tron and keeps the address (TASK-24035)', async () => {
        render(
            <IntlWrapper>
                <TronHarness />
            </IntlWrapper>
        )
        fireEvent.click(screen.getByRole('button', { name: 'paste Tron address' }))
        await waitFor(() => expect(screen.getByTestId('chain')).toHaveTextContent('tron'))
        expect(screen.getByTestId('token')).toHaveTextContent(USDT_TRON)
        expect(screen.getByText('Tron address: switched to USDT on Tron')).toBeInTheDocument()
        expect(screen.queryByText('Enter a wallet address or an ENS name.')).toBeNull()
        // the address survived the family change, so the user can continue
        expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
        // a network pick is the user's own choice: the note goes
        fireEvent.click(screen.getByRole('button', { name: 'selector network pick' }))
        expect(screen.queryByText('Tron address: switched to USDT on Tron')).toBeNull()
    })

    it('a Tron address stays an error while cross-chain withdraw is switched off', async () => {
        mockKillSwitches.disableXchainWithdraw = true
        render(
            <IntlWrapper>
                <TronHarness />
            </IntlWrapper>
        )
        fireEvent.click(screen.getByRole('button', { name: 'paste Tron address' }))
        expect(await screen.findByText('Enter a wallet address or an ENS name.')).toBeInTheDocument()
        expect(screen.getByTestId('chain')).toHaveTextContent('1')
        expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    })

    it('resets chain + token to the defaults on a fresh entry', async () => {
        const { setSelectedChainID, setSelectedTokenAddress } = renderMountHarness()
        await waitFor(() => expect(setSelectedChainID).toHaveBeenCalledWith('1'))
        expect(setSelectedTokenAddress).toHaveBeenCalledWith('0x0000000000000000000000000000000000000000')
    })

    it('keeps the address-book selection when the destination arrives prefilled', async () => {
        // an address-book tap selects the saved chain (+ its USDC) before
        // navigating here — the mount default must not move the withdraw back
        // onto the Peanut wallet chain (Chip: preserve the saved destination
        // network)
        const { setSelectedChainID, setSelectedTokenAddress } = renderMountHarness(
            '0x9999999999999999999999999999999999999999'
        )
        await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument())
        expect(setSelectedChainID).not.toHaveBeenCalled()
        expect(setSelectedTokenAddress).not.toHaveBeenCalled()
    })

    it('a prefilled destination moved off an unoffered network needs an explicit network pick (TASK-23392)', async () => {
        renderMountHarness('0x9999999999999999999999999999999999999999')
        const cont = await screen.findByRole('button', { name: 'Continue' })
        fireEvent.click(screen.getByRole('button', { name: 'selector auto-correct' }))
        expect(screen.getByText('Pick the network for this address')).toBeInTheDocument()
        expect(cont).toBeDisabled()
        fireEvent.click(screen.getByRole('button', { name: 'selector network pick' }))
        expect(screen.queryByText('Pick the network for this address')).toBeNull()
    })

    it('a correction with no destination typed asks nothing', async () => {
        renderMountHarness()
        await screen.findByRole('button', { name: 'Continue' })
        fireEvent.click(screen.getByRole('button', { name: 'selector auto-correct' }))
        expect(screen.queryByText('Pick the network for this address')).toBeNull()
    })

    it('keeps Review disabled while an ENS name resolves for a new chain', async () => {
        const resolution = deferred<{ identifier: string; recipientType: 'ENS'; resolvedAddress: string }>()
        mockValidateAndResolveRecipient.mockReturnValue(resolution.promise)

        render(
            <IntlWrapper>
                <TestHarness />
            </IntlWrapper>
        )

        fireEvent.click(screen.getByRole('button', { name: 'set ENS recipient' }))
        await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled())

        fireEvent.click(screen.getByRole('button', { name: 'switch network' }))

        await waitFor(() =>
            expect(mockValidateAndResolveRecipient).toHaveBeenCalledWith('alice.eth', true, 'evm', '8453')
        )
        expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()

        resolution.resolve({
            identifier: 'alice.eth',
            recipientType: 'ENS',
            resolvedAddress: '0x2222222222222222222222222222222222222222',
        })

        await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled())
    })

    // TASK-23850: a withdrawal needs no price. Continue is gated on the token
    // being in the destination chain's withdraw list, with the record's metadata.
    describe('Continue needs the withdraw list, not a price', () => {
        const enterRecipient = async () => {
            fireEvent.click(screen.getByRole('button', { name: 'set ENS recipient' }))
            return screen.findByRole('button', { name: 'Continue' })
        }

        it.each([
            ['ETH on Base', '8453', 'ETH'],
            ['BNB on BNB Chain', '56', 'BNB'],
        ])('is enabled with no price for %s and hands over the token record', async (_case, chainId, symbol) => {
            const onContinue = jest.fn()
            render(
                <IntlWrapper>
                    <TestHarness chainId={chainId} onContinue={onContinue} />
                </IntlWrapper>
            )
            const cont = await enterRecipient()
            await waitFor(() => expect(cont).toBeEnabled())

            fireEvent.click(cont)
            expect(onContinue).toHaveBeenCalledWith({
                token: token(chainId, symbol),
                chain: supportedChainsAndTokens[chainId as keyof typeof supportedChainsAndTokens],
                address: '0x1111111111111111111111111111111111111111',
            })
        })

        it.each([
            ['a token the chain does not deliver (WETH on Base)', '8453', BASE_WETH],
            ['a native token the chain does not deliver (POL on Polygon)', '137', NATIVE],
            ['a token the record does not list', '8453', '0x3333333333333333333333333333333333333333'],
        ])('is disabled for %s', async (_case, chainId, tokenAddress) => {
            const onContinue = jest.fn()
            render(
                <IntlWrapper>
                    <TestHarness chainId={chainId} tokenAddress={tokenAddress} onContinue={onContinue} />
                </IntlWrapper>
            )
            const cont = await enterRecipient()
            expect(cont).toBeDisabled()
            fireEvent.click(cont)
            expect(onContinue).not.toHaveBeenCalled()
        })
    })
})
