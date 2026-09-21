import React, { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import underMaintenanceConfig from '@/config/underMaintenance.config'
import TokenSelector from '../TokenSelector'

// the shipped config has disableXchainSend ON, which would put every test on
// the maintenance path. Pinned OFF here; the maintenance test flips it back.
jest.mock('@/config/underMaintenance.config', () => ({
    __esModule: true,
    default: { disableXchainWithdraw: false, disableXchainSend: false },
}))
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

const USDC_ARB = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
const USDT_ETH = '0xdAC17F958D2ee523a2206206994597C13D831ec7'

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
        tokens: [token(USDC_ARB, 'USDC')],
    },
    '1': {
        chainId: '1',
        networkName: 'Ethereum',
        chainIconURI: '',
        tokens: [token(USDT_ETH, 'USDT')],
    },
}

function Harness({
    initialChainID = '',
    initialTokenAddress = '',
    viewType = 'other',
}: {
    initialChainID?: string
    initialTokenAddress?: string
    viewType?: 'withdraw' | 'other' | 'claim' | 'add' | 'req_pay'
}) {
    const [selectedChainID, setSelectedChainID] = useState(initialChainID)
    const [selectedTokenAddress, setSelectedTokenAddress] = useState(initialTokenAddress)
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
                <TokenSelector viewType={viewType} />
                <output data-testid="chain-probe">{selectedChainID || 'all'}</output>
                <output data-testid="token-probe">{selectedTokenAddress || 'none'}</output>
            </tokenSelectorContext.Provider>
        </IntlWrapper>
    )
}

// the trigger is a ListItem whose accessible name is the SELECTED token, so it
// is addressed by test id rather than by a name that changes with the state
const openDrawer = () => fireEvent.click(screen.getByTestId('token-selector-trigger'))

// radix tabs activate on mousedown, not click, so fire both
const clickTab = (el: HTMLElement) => {
    fireEvent.mouseDown(el)
    fireEvent.click(el)
}

const tokenList = () => screen.getByRole('listbox', { name: /select a token/i })

describe('TokenSelector network tabs (TASK-22452)', () => {
    test('renders an All tab plus one tab per popular chain', () => {
        render(<Harness />)
        openDrawer()
        expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /ARB/ })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /ETH/ })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('data-state', 'active')
    })

    test('the tabs are contentless — no tab panel is rendered', () => {
        render(<Harness />)
        openDrawer()
        expect(screen.queryAllByRole('tabpanel')).toHaveLength(0)
    })

    test('selecting a network tab filters the token list; All resets', () => {
        render(<Harness />)
        openDrawer()

        clickTab(screen.getByRole('tab', { name: /ETH/ }))
        expect(screen.getByTestId('chain-probe')).toHaveTextContent('1')
        expect(within(tokenList()).getByText('USDT')).toBeInTheDocument()
        expect(within(tokenList()).queryByText('USDC')).not.toBeInTheDocument()

        clickTab(screen.getByRole('tab', { name: 'All' }))
        expect(screen.getByTestId('chain-probe')).toHaveTextContent('all')
        expect(within(tokenList()).getByText('USDC')).toBeInTheDocument()
    })

    test('tab selection keeps the picked token (old tile behavior)', () => {
        render(<Harness />)
        openDrawer()
        fireEvent.click(within(tokenList()).getByText('USDC'))
        expect(screen.getByTestId('token-probe')).not.toHaveTextContent('none')

        // the drawer mock keeps content mounted, so switch tabs directly
        clickTab(screen.getByRole('tab', { name: /ETH/ }))
        expect(screen.getByTestId('token-probe')).not.toHaveTextContent('none')
    })

    test('search still spans all allowed chains regardless of the active tab', () => {
        render(<Harness />)
        openDrawer()
        clickTab(screen.getByRole('tab', { name: /ETH/ }))
        // usdc lives on arbitrum, not the active eth tab — search finds it anyway
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'USDC' } })
        expect(within(tokenList()).getByText('USDC')).toBeInTheDocument()
    })

    test('search is substring, not exact match', () => {
        render(<Harness />)
        openDrawer()
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'usd' } })
        expect(within(tokenList()).getByText('USDC')).toBeInTheDocument()
        expect(within(tokenList()).getByText('USDT')).toBeInTheDocument()
    })

    test('the search field lives outside the tabs, so a tab switch keeps its value', () => {
        render(<Harness />)
        openDrawer()
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'usd' } })
        clickTab(screen.getByRole('tab', { name: /ETH/ }))
        expect(screen.getByRole('textbox')).toHaveValue('usd')
    })

    test('rows are listbox options and only the selected one is aria-selected', () => {
        render(<Harness initialChainID="42161" initialTokenAddress={USDC_ARB} />)
        openDrawer()
        const options = within(tokenList()).getAllByRole('option')
        expect(options.length).toBeGreaterThan(0)
        expect(options.filter((option) => option.getAttribute('aria-selected') === 'true')).toHaveLength(1)
        expect(within(tokenList()).getByRole('option', { name: /USDC/ })).toHaveAttribute('aria-selected', 'true')
    })

    test('cross-chain disabled: the announcement replaces search and tabs, one token stays', () => {
        underMaintenanceConfig.disableXchainSend = true
        try {
            render(<Harness viewType="claim" />)
            openDrawer()
            expect(screen.getByRole('alert')).toHaveTextContent(/temporarily unavailable/i)
            expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
            expect(screen.queryAllByRole('tab')).toHaveLength(0)
            expect(within(tokenList()).getAllByRole('option')).toHaveLength(1)
        } finally {
            underMaintenanceConfig.disableXchainSend = false
        }
    })

    // jsdom has no layout, so every width is 0 and the responsive trim never
    // fires in the tests above — they still see the full row. These stubs give
    // the tab row a width per rendered tab, which is what makes the
    // shrink-and-measure-again loop converge.
    describe('responsive trim (TASK-22707)', () => {
        const stubWidths = (containerPx: number, perTabPx: number) => {
            Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
                configurable: true,
                get: () => containerPx,
            })
            Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
                configurable: true,
                get(this: HTMLElement) {
                    return this.querySelectorAll('[role="tab"]').length * perTabPx
                },
            })
        }

        afterEach(() => {
            // @ts-expect-error restoring jsdom's own always-0 properties
            delete HTMLElement.prototype.clientWidth
            // @ts-expect-error restoring jsdom's own always-0 properties
            delete HTMLElement.prototype.scrollWidth
        })

        test('a narrow row drops the tabs that do not fit and keeps All', () => {
            stubWidths(220, 100) // two tabs fit, three do not
            render(<Harness />)
            openDrawer()

            expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument()
            expect(screen.getAllByRole('tab')).toHaveLength(2)
            expect(screen.queryByRole('tab', { name: /ETH/ })).not.toBeInTheDocument()
            // the dropped chain is still reachable — nothing becomes unpickable
            expect(screen.getByRole('button', { name: /more networks/i })).toBeInTheDocument()
        })

        test('the selected chain survives the trim, a wider neighbour is dropped instead', () => {
            stubWidths(220, 100)
            render(<Harness initialChainID="1" />)
            openDrawer()

            expect(screen.getByRole('tab', { name: /ETH/ })).toHaveAttribute('data-state', 'active')
            expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument()
            expect(screen.queryByRole('tab', { name: /ARB/ })).not.toBeInTheDocument()
        })

        test('last resort: All and the selected chain stay even when they cannot fit', () => {
            stubWidths(50, 100) // nothing fits; the row falls back to scrolling
            render(<Harness initialChainID="1" />)
            openDrawer()

            expect(screen.getByRole('tab', { name: 'All' })).toBeInTheDocument()
            expect(screen.getByRole('tab', { name: /ETH/ })).toBeInTheDocument()
        })
    })

    test('More networks opens the list and a non-popular pick gets its own tab and clears the token', () => {
        render(<Harness initialChainID="" />)
        openDrawer()
        fireEvent.click(screen.getByRole('button', { name: /more networks/i }))
        expect(screen.getByTestId('network-list')).toBeInTheDocument()

        fireEvent.click(screen.getByText('pick polygon'))
        expect(screen.getByTestId('chain-probe')).toHaveTextContent('137')
        expect(screen.getByTestId('token-probe')).toHaveTextContent('none')
        // the non-popular selection keeps an active tab so the row stays visible
        const activeTab = screen.getAllByRole('tab').find((tab) => tab.getAttribute('data-state') === 'active')
        expect(activeTab).toBeDefined()
    })
})
