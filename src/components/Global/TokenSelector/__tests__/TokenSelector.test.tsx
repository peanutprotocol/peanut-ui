import React, { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import underMaintenanceConfig from '@/config/underMaintenance.config'
import TokenSelector from '../TokenSelector'

// the shipped config has disableXchainSend ON; pinned OFF here, the lock tests flip it
jest.mock('@/config/underMaintenance.config', () => ({
    __esModule: true,
    default: { disableXchainWithdraw: false, disableXchainSend: false },
}))
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

function Harness({
    initialChainID = '42161',
    initialTokenAddress = USDC_ARB,
    viewType = 'withdraw',
    isLoadingChains = false,
    onAutoCorrect,
    onUserSelect,
}: {
    initialChainID?: string
    initialTokenAddress?: string
    viewType?: 'withdraw' | 'other' | 'claim' | 'add' | 'req_pay'
    isLoadingChains?: boolean
    onAutoCorrect?: () => void
    onUserSelect?: () => void
}) {
    const [selectedChainID, setSelectedChainID] = useState(initialChainID)
    const [selectedTokenAddress, setSelectedTokenAddress] = useState(initialTokenAddress)
    return (
        <IntlWrapper>
            <tokenSelectorContext.Provider
                value={
                    {
                        supportedChainsAndTokens: CHAINS,
                        isLoadingChains,
                        selectedChainID,
                        setSelectedChainID,
                        selectedTokenAddress,
                        setSelectedTokenAddress,
                    } as never
                }
            >
                <TokenSelector viewType={viewType} onAutoCorrect={onAutoCorrect} onUserSelect={onUserSelect} />
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
        ;(underMaintenanceConfig as { disableXchainSend: boolean }).disableXchainSend = false
        ;(underMaintenanceConfig as { disableXchainWithdraw: boolean }).disableXchainWithdraw = false
    })

    test('two triggers show the selected token and network', () => {
        render(<Harness />)
        expect(tokenTrigger()).toHaveAccessibleName('Token: USDC')
        expect(networkTrigger()).toHaveAccessibleName('Network: Arbitrum')
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

    test('the network drawer only lists networks that carry the token', () => {
        render(<Harness />)
        fireEvent.click(networkTrigger())
        expect(options()).toHaveLength(2)
        expect(within(optionNamed('Arbitrum')).getByText('No fee')).toBeInTheDocument()
        expect(within(optionNamed('Ethereum')).getByText('Network fee')).toBeInTheDocument()
    })

    test('USDT adds Tron to the network list', () => {
        render(<Harness initialChainID="1" initialTokenAddress={USDT_ETH} />)
        fireEvent.click(networkTrigger())
        expect(options().map((o) => within(o).getByText(/Arbitrum|Ethereum|Tron/).textContent)).toEqual([
            'Arbitrum',
            'Ethereum',
            'Tron',
        ])
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

    test('drawer picks are reported as user selections', () => {
        const onUserSelect = jest.fn()
        render(<Harness onUserSelect={onUserSelect} />)
        fireEvent.click(networkTrigger())
        fireEvent.click(optionNamed('Ethereum'))
        fireEvent.click(tokenTrigger())
        fireEvent.click(optionNamed('USDT'))
        expect(onUserSelect).toHaveBeenCalledTimes(2)
    })

    test('a pair is not corrected while the chain record loads', () => {
        render(<Harness initialChainID="137" initialTokenAddress="0xpolygonUsdt" isLoadingChains />)
        expect(chain()).toBe('137')
        expect(tokenAddress()).toBe('0xpolygonUsdt')
    })

    test('cross-chain send off: claim is locked to USDC on Arbitrum', () => {
        ;(underMaintenanceConfig as { disableXchainSend: boolean }).disableXchainSend = true
        render(<Harness viewType="claim" initialChainID="1" initialTokenAddress={USDT_ETH} />)
        expect(chain()).toBe('42161')
        expect(tokenAddress()).toBe(USDC_ARB)
        expect(tokenTrigger()).toBeDisabled()
        expect(networkTrigger()).toBeDisabled()
        expect(screen.getByText('Only USDC on Arbitrum for now')).toBeInTheDocument()
    })

    test('cross-chain withdraw off: withdraw is locked too', () => {
        ;(underMaintenanceConfig as { disableXchainWithdraw: boolean }).disableXchainWithdraw = true
        render(<Harness initialChainID="tron" initialTokenAddress={USDT_TRON} />)
        expect(chain()).toBe('42161')
        expect(tokenTrigger()).toBeDisabled()
    })
})
