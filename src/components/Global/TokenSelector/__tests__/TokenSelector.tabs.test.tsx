import React, { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import TokenSelector from '../TokenSelector'

// vaul needs layout apis jsdom lacks; a pass-through keeps the drawer inline
jest.mock('@/components/Global/Drawer', () => ({
    Drawer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DrawerContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => React.createElement('img', props as Record<string, string>),
}))
// pin the searchable chain set: the wagmi-derived list is env-dependent
jest.mock('../TokenSelector.consts', () => ({
    ...jest.requireActual('../TokenSelector.consts'),
    TOKEN_SELECTOR_SUPPORTED_NETWORK_IDS: ['42161', '1'],
}))
jest.mock('../Components/NetworkListView', () => ({
    __esModule: true,
    default: ({ onSelectChain }: { onSelectChain: (chainId: string) => void }) => (
        <div data-testid="network-list">
            <button onClick={() => onSelectChain('137')}>pick polygon</button>
        </div>
    ),
}))

const token = (address: string, symbol: string) => ({
    address,
    name: symbol,
    symbol,
    decimals: 6,
    logoURI: '',
})

// arbitrum + mainnet are in TOKEN_SELECTOR_POPULAR_NETWORK_IDS, so both get tabs
const CHAINS = {
    '42161': {
        chainId: '42161',
        networkName: 'Arbitrum',
        chainIconURI: '',
        tokens: [token('0xaf88d065e77c8cC2239327C5EDb3A432268e5831', 'USDC')],
    },
    '1': {
        chainId: '1',
        networkName: 'Ethereum',
        chainIconURI: '',
        tokens: [token('0xdAC17F958D2ee523a2206206994597C13D831ec7', 'USDT')],
    },
}

function Harness({ initialChainID = '' }: { initialChainID?: string }) {
    const [selectedChainID, setSelectedChainID] = useState(initialChainID)
    const [selectedTokenAddress, setSelectedTokenAddress] = useState('')
    return (
        <IntlWrapper>
            <tokenSelectorContext.Provider
                value={
                    {
                        supportedChainsAndTokens: CHAINS,
                        selectedChainID,
                        setSelectedChainID,
                        selectedTokenAddress,
                        setSelectedTokenAddress,
                    } as never
                }
            >
                <TokenSelector viewType="other" />
                <output data-testid="chain-probe">{selectedChainID || 'all'}</output>
                <output data-testid="token-probe">{selectedTokenAddress || 'none'}</output>
            </tokenSelectorContext.Provider>
        </IntlWrapper>
    )
}

const openDrawer = () => fireEvent.click(screen.getByRole('button', { name: /select a token/i }))

// radix tabs activate on mousedown, not click, so fire both
const clickTab = (el: HTMLElement) => {
    fireEvent.mouseDown(el)
    fireEvent.click(el)
}

describe('TokenSelector network tabs (TASK-22452)', () => {
    test('renders an All tab plus one tab per popular chain', () => {
        render(<Harness />)
        openDrawer()
        expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /ARB/ })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /ETH/ })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('data-state', 'active')
    })

    test('selecting a network tab filters the token list; All resets', () => {
        render(<Harness />)
        openDrawer()

        clickTab(screen.getByRole('tab', { name: /ETH/ }))
        expect(screen.getByTestId('chain-probe')).toHaveTextContent('1')
        const activePanel = screen
            .getAllByRole('tabpanel')
            .find((panel) => panel.getAttribute('data-state') === 'active')!
        expect(within(activePanel).getByText('USDT')).toBeInTheDocument()

        clickTab(screen.getByRole('tab', { name: 'All' }))
        expect(screen.getByTestId('chain-probe')).toHaveTextContent('all')
    })

    test('tab selection keeps the picked token (old tile behavior)', () => {
        render(<Harness />)
        openDrawer()
        const panel = screen.getAllByRole('tabpanel').find((p) => p.getAttribute('data-state') === 'active')!
        fireEvent.click(within(panel).getByText('USDC'))
        expect(screen.getByTestId('token-probe')).not.toHaveTextContent('none')

        // the drawer mock keeps content mounted, so switch tabs directly
        clickTab(screen.getByRole('tab', { name: /ETH/ }))
        expect(screen.getByTestId('token-probe')).not.toHaveTextContent('none')
    })

    test('search still spans all allowed chains regardless of the active tab', () => {
        render(<Harness />)
        openDrawer()
        clickTab(screen.getByRole('tab', { name: /ETH/ }))
        const activePanel = screen
            .getAllByRole('tabpanel')
            .find((panel) => panel.getAttribute('data-state') === 'active')!
        // usdc lives on arbitrum, not the active eth tab — search finds it anyway
        fireEvent.change(within(activePanel).getByRole('textbox'), { target: { value: 'USDC' } })
        expect(within(activePanel).getByText('USDC')).toBeInTheDocument()
    })

    test('More networks opens the list and a non-popular pick gets its own tab and clears the token', () => {
        render(<Harness initialChainID="" />)
        openDrawer()
        fireEvent.click(screen.getByRole('button', { name: /more networks/i }))
        expect(screen.getByTestId('network-list')).toBeInTheDocument()

        fireEvent.click(screen.getByText('pick polygon'))
        expect(screen.getByTestId('chain-probe')).toHaveTextContent('137')
        expect(screen.getByTestId('token-probe')).toHaveTextContent('none')
        // the non-popular selection keeps an active tab so the panel renders
        const activeTab = screen.getAllByRole('tab').find((tab) => tab.getAttribute('data-state') === 'active')
        expect(activeTab).toBeDefined()
    })
})
