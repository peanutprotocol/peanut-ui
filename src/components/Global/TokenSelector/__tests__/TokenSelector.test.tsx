import React, { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import { getKillSwitches } from '@/features/kill-switches/kill-switches-store'
import TokenSelector from '../TokenSelector'

// the built-in default has disableXchainSend ON; pinned OFF here, the lock tests flip it
jest.mock('@/features/kill-switches/kill-switches-store', () => {
    const killSwitches = { disableXchainWithdraw: false, disableXchainSend: false }
    return { getKillSwitches: () => killSwitches, subscribeKillSwitches: () => () => {} }
})
// vaul needs layout apis jsdom lacks; a pass-through renders the drawer only while open
jest.mock('@/components/Global/Drawer', () => ({
    Drawer: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
    DrawerContent: ({ children }: { children: React.ReactNode }) => <div role="dialog">{children}</div>,
    DrawerTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))
jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => React.createElement('img', props as Record<string, string>),
}))

const USDC_ARB = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
const USDT_ARB = '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9'
const USDC_ETH = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const USDT_ETH = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const USDT_TRON = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'

const token = (address: string, symbol: string) => ({ address, name: symbol, symbol, decimals: 6, logoURI: '' })

// all three are Rhino withdraw destinations in the chain registry
const CHAINS = {
    '42161': {
        chainId: '42161',
        networkName: 'Arbitrum',
        chainIconURI: '',
        tokens: [token(USDC_ARB, 'USDC'), token(USDT_ARB, 'USDT')],
    },
    '1': {
        chainId: '1',
        networkName: 'Ethereum',
        chainIconURI: '',
        tokens: [token(USDC_ETH, 'USDC'), token(USDT_ETH, 'USDT')],
    },
    tron: { chainId: 'tron', networkName: 'Tron', chainIconURI: '', tokens: [token(USDT_TRON, 'USDT')] },
}

const NATIVE = '0x0000000000000000000000000000000000000000'
// the same record with native ETH on Arbitrum and Ethereum
const CHAINS_WITH_ETH = {
    ...CHAINS,
    '42161': { ...CHAINS['42161'], tokens: [...CHAINS['42161'].tokens, token(NATIVE, 'ETH')] },
    '1': { ...CHAINS['1'], tokens: [...CHAINS['1'].tokens, token(NATIVE, 'ETH')] },
}

function Harness({
    initialChainID = '42161',
    initialTokenAddress = USDC_ARB,
    viewType = 'withdraw',
    isLoadingChains = false,
    onAutoCorrect,
    onNetworkSelect,
    networkHelper,
    addressFamily,
    chains = CHAINS,
}: {
    chains?: Record<string, unknown>
    initialChainID?: string
    initialTokenAddress?: string
    viewType?: 'withdraw' | 'other' | 'claim' | 'add' | 'req_pay'
    isLoadingChains?: boolean
    onAutoCorrect?: () => void
    onNetworkSelect?: () => void
    networkHelper?: string
    addressFamily?: 'evm' | 'solana' | 'tron'
}) {
    const [selectedChainID, setSelectedChainID] = useState(initialChainID)
    const [selectedTokenAddress, setSelectedTokenAddress] = useState(initialTokenAddress)
    return (
        <IntlWrapper>
            <tokenSelectorContext.Provider
                value={
                    {
                        supportedChainsAndTokens: chains,
                        isLoadingChains,
                        selectedChainID,
                        setSelectedChainID,
                        selectedTokenAddress,
                        setSelectedTokenAddress,
                    } as never
                }
            >
                <TokenSelector
                    viewType={viewType}
                    onAutoCorrect={onAutoCorrect}
                    onNetworkSelect={onNetworkSelect}
                    networkHelper={networkHelper}
                    addressFamily={addressFamily}
                />
                <output data-testid="chain-probe">{selectedChainID || 'none'}</output>
                <output data-testid="token-probe">{selectedTokenAddress || 'none'}</output>
            </tokenSelectorContext.Provider>
        </IntlWrapper>
    )
}

const tokenTrigger = () => screen.getByTestId('token-selector-trigger')
const networkTrigger = () => screen.getByTestId('network-selector-trigger')
const options = () => within(screen.getByRole('listbox')).getAllByRole('option')
const optionNamed = (name: string) => options().find((o) => within(o).queryByText(name, { exact: true }))!
const chain = () => screen.getByTestId('chain-probe').textContent
const tokenAddress = () => screen.getByTestId('token-probe').textContent

describe('TokenSelector (TASK-23392)', () => {
    afterEach(() => {
        ;(getKillSwitches() as { disableXchainSend: boolean }).disableXchainSend = false
        ;(getKillSwitches() as { disableXchainWithdraw: boolean }).disableXchainWithdraw = false
    })

    test('two triggers show the selected token and network', () => {
        render(<Harness />)
        expect(tokenTrigger()).toHaveAccessibleName('Token: USDC')
        expect(networkTrigger()).toHaveAccessibleName('Network: Arbitrum')
    })

    // A scanned address is valid on one family of networks only: the pickers
    // for it never offer another family (TASK-23974).
    describe('addressFamily keeps the pickers to the networks the address is valid on', () => {
        test('an EVM address is offered no Tron', () => {
            render(<Harness addressFamily="evm" />)
            fireEvent.click(tokenTrigger())
            const usdt = optionNamed('USDT')
            expect(within(usdt).getByText('Arbitrum')).toBeInTheDocument()
            expect(within(usdt).getByText('Ethereum')).toBeInTheDocument()
            expect(within(usdt).queryByText('+1')).toBeNull()
            fireEvent.click(usdt)
            fireEvent.click(networkTrigger())
            expect(options().map((o) => o.textContent)).not.toEqual(
                expect.arrayContaining([expect.stringContaining('Tron')])
            )
        })

        test('a Tron address is offered Tron and its USDT only', () => {
            render(<Harness initialChainID="tron" initialTokenAddress={USDT_TRON} addressFamily="tron" />)
            expect(tokenTrigger()).toHaveAccessibleName('Token: USDT')
            expect(networkTrigger()).toHaveAccessibleName('Network: Tron')
            fireEvent.click(tokenTrigger())
            expect(options()).toHaveLength(1)
            fireEvent.click(optionNamed('USDT'))
            fireEvent.click(networkTrigger())
            expect(options()).toHaveLength(1)
            expect(chain()).toBe('tron')
        })
    })

    test('token rows show two network badges and a count for the rest', () => {
        render(<Harness />)
        fireEvent.click(tokenTrigger())
        const usdt = optionNamed('USDT')
        expect(within(usdt).getByText('Arbitrum')).toBeInTheDocument()
        expect(within(usdt).getByText('Ethereum')).toBeInTheDocument()
        expect(within(usdt).getByText('+1')).toBeInTheDocument()
        // USDC has two networks, so no count
        expect(within(optionNamed('USDC')).queryByText(/^\+/)).toBeNull()
    })

    test('the network drawer lists every network, the ones without the token last and disabled', () => {
        render(<Harness />)
        fireEvent.click(networkTrigger())
        expect(options().map((o) => within(o).getByText(/Arbitrum|Ethereum|Tron/).textContent)).toEqual([
            'Arbitrum',
            'Ethereum',
            'Tron',
        ])
        expect(within(optionNamed('Arbitrum')).getByText('No fee')).toBeInTheDocument()
        expect(within(optionNamed('Ethereum')).getByText('Network fee')).toBeInTheDocument()
        // Sprint 165 smoke: with USDC selected, Tron was missing from the list
        const tron = optionNamed('Tron')
        expect(tron).toHaveAttribute('aria-disabled', 'true')
        expect(within(tron).getByText('No USDC on this network')).toBeInTheDocument()
    })

    test('tapping a network that does not carry the token changes nothing', () => {
        const onNetworkSelect = jest.fn()
        render(<Harness onNetworkSelect={onNetworkSelect} />)
        fireEvent.click(networkTrigger())
        fireEvent.click(optionNamed('Tron'))
        fireEvent.keyDown(optionNamed('Tron'), { key: 'Enter' })
        expect(chain()).toBe('42161')
        expect(tokenAddress()).toBe(USDC_ARB)
        expect(onNetworkSelect).not.toHaveBeenCalled()
        expect(screen.getByRole('listbox')).toBeInTheDocument()
    })

    test('USDT adds Tron to the network list', () => {
        render(<Harness initialChainID="1" initialTokenAddress={USDT_ETH} />)
        fireEvent.click(networkTrigger())
        expect(options().map((o) => within(o).getByText(/Arbitrum|Ethereum|Tron/).textContent)).toEqual([
            'Arbitrum',
            'Ethereum',
            'Tron',
        ])
        expect(optionNamed('Tron')).not.toHaveAttribute('aria-disabled')
        // USDT on Arbitrum is not the free route
        expect(within(optionNamed('Arbitrum')).getByText('Network fee')).toBeInTheDocument()
    })

    test('a token the current network does not carry moves to Arbitrum', () => {
        render(<Harness initialChainID="tron" initialTokenAddress={USDT_TRON} />)
        fireEvent.click(tokenTrigger())
        fireEvent.click(optionNamed('USDC'))
        expect(chain()).toBe('42161')
        expect(tokenAddress()).toBe(USDC_ARB)
        expect(screen.queryByRole('listbox')).toBeNull()
    })

    test('a token the current network carries keeps the network', () => {
        render(<Harness initialChainID="1" initialTokenAddress={USDC_ETH} />)
        fireEvent.click(tokenTrigger())
        fireEvent.click(optionNamed('USDT'))
        expect(chain()).toBe('1')
        expect(tokenAddress()).toBe(USDT_ETH)
    })

    test('picking a network selects that token on it', () => {
        render(<Harness />)
        fireEvent.click(networkTrigger())
        fireEvent.click(optionNamed('Ethereum'))
        expect(chain()).toBe('1')
        expect(tokenAddress()).toBe(USDC_ETH)
    })

    test('only the selected row is aria-selected', () => {
        render(<Harness />)
        fireEvent.click(tokenTrigger())
        expect(options().filter((o) => o.getAttribute('aria-selected') === 'true')).toHaveLength(1)
        expect(optionNamed('USDC')).toHaveAttribute('aria-selected', 'true')
    })

    test('token search filters by substring', () => {
        render(<Harness />)
        fireEvent.click(tokenTrigger())
        fireEvent.change(screen.getByPlaceholderText('Search token'), { target: { value: 'dt' } })
        expect(options()).toHaveLength(1)
        expect(optionNamed('USDT')).toBeDefined()
    })

    test('an unoffered pair is corrected to a valid one, never left blank', () => {
        render(<Harness initialChainID="tron" initialTokenAddress={USDC_ARB} />)
        expect(chain()).toBe('42161')
        expect(tokenAddress()).toBe(USDC_ARB)
    })

    test('a correction is reported once; a valid pair reports nothing', () => {
        const onAutoCorrect = jest.fn()
        const { unmount } = render(<Harness initialChainID="534352" onAutoCorrect={onAutoCorrect} />)
        expect(onAutoCorrect).toHaveBeenCalledTimes(1)
        unmount()
        const quiet = jest.fn()
        render(<Harness onAutoCorrect={quiet} />)
        expect(quiet).not.toHaveBeenCalled()
    })

    test('only a network pick is reported as an explicit network choice', () => {
        const onNetworkSelect = jest.fn()
        render(<Harness onNetworkSelect={onNetworkSelect} />)
        fireEvent.click(networkTrigger())
        fireEvent.click(optionNamed('Ethereum'))
        fireEvent.click(tokenTrigger())
        fireEvent.click(optionNamed('USDT'))
        expect(onNetworkSelect).toHaveBeenCalledTimes(1)
    })

    test('a pair is not corrected while the chain record loads', () => {
        render(<Harness initialChainID="137" initialTokenAddress="0xpolygonUsdt" isLoadingChains />)
        expect(chain()).toBe('137')
        expect(tokenAddress()).toBe('0xpolygonUsdt')
    })

    // A screen that needs an explicit network pick says so under the network
    // picker, as guidance. While a lock is on, the lock hint is what matters.
    test('guidance under the network picker shows when the screen asks for it; the lock hint wins', () => {
        const { rerender } = render(<Harness networkHelper="Pick the network for this address" />)
        expect(screen.getByText('Pick the network for this address')).toBeInTheDocument()
        ;(getKillSwitches() as { disableXchainWithdraw: boolean }).disableXchainWithdraw = true
        rerender(<Harness networkHelper="Pick the network for this address" />)
        expect(screen.queryByText('Pick the network for this address')).toBeNull()
        expect(screen.getByText('Only USDC on Arbitrum for now')).toBeInTheDocument()
    })

    test('cross-chain send off: claim is locked to USDC on Arbitrum', () => {
        ;(getKillSwitches() as { disableXchainSend: boolean }).disableXchainSend = true
        render(<Harness viewType="claim" initialChainID="1" initialTokenAddress={USDT_ETH} />)
        expect(chain()).toBe('42161')
        expect(tokenAddress()).toBe(USDC_ARB)
        expect(tokenTrigger()).toBeDisabled()
        expect(networkTrigger()).toBeDisabled()
        expect(screen.getByText('Only USDC on Arbitrum for now')).toBeInTheDocument()
    })

    test('cross-chain withdraw off: withdraw is locked too', () => {
        ;(getKillSwitches() as { disableXchainWithdraw: boolean }).disableXchainWithdraw = true
        render(<Harness initialChainID="tron" initialTokenAddress={USDT_TRON} />)
        expect(chain()).toBe('42161')
        expect(tokenTrigger()).toBeDisabled()
    })

    // TASK-23850: a request is paid in USDC or USDT only, so the request-payment
    // selector never offers the native token. Other flows keep it.
    describe('the native token', () => {
        const offers = (symbol: string) =>
            options().some((option) => !!within(option).queryByText(symbol, { exact: true }))

        test('a request payment offers USDC and USDT, never ETH', () => {
            render(<Harness viewType="req_pay" chains={CHAINS_WITH_ETH} />)
            fireEvent.click(tokenTrigger())
            expect(options()).toHaveLength(2)
            expect(offers('USDC')).toBe(true)
            expect(offers('USDT')).toBe(true)
            expect(offers('ETH')).toBe(false)
        })

        test.each(['withdraw', 'claim'] as const)('%s still offers ETH', (viewType) => {
            render(<Harness viewType={viewType} chains={CHAINS_WITH_ETH} />)
            fireEvent.click(tokenTrigger())
            expect(offers('ETH')).toBe(true)
        })
    })
})
