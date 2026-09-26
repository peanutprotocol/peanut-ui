import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import NetworkListView from '../Components/NetworkListView'

jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => React.createElement('img', props as Record<string, string>),
}))

const CHAINS = {
    '42161': { chainId: '42161', networkName: 'Arbitrum', chainIconURI: '', tokens: [] },
    '1': { chainId: '1', networkName: 'Ethereum', chainIconURI: '', tokens: [] },
}

const COMING_SOON = [{ chainId: 'solana', name: 'Solana', iconUrl: '' }]

const renderView = (props: Partial<React.ComponentProps<typeof NetworkListView>> = {}) => {
    const onSelectChain = jest.fn()
    const onBack = jest.fn()
    const setSearchValue = jest.fn()
    render(
        <IntlWrapper>
            <NetworkListView
                chains={CHAINS as never}
                onSelectChain={onSelectChain}
                onBack={onBack}
                searchValue=""
                setSearchValue={setSearchValue}
                selectedChainID="42161"
                allowedChainIds={new Set(['42161', '1'])}
                comingSoonNetworks={COMING_SOON}
                {...props}
            />
        </IntlWrapper>
    )
    return { onSelectChain, onBack, setSearchValue }
}

const list = () => screen.getByRole('listbox', { name: /select a network/i })

describe('NetworkListView', () => {
    test('renders every allowed chain plus the coming-soon ones as options', () => {
        renderView()
        const options = within(list()).getAllByRole('option')
        expect(options).toHaveLength(3)
        expect(within(list()).getByRole('option', { name: /Arbitrum/ })).toBeInTheDocument()
        expect(within(list()).getByRole('option', { name: /Solana/ })).toBeInTheDocument()
    })

    test('the selected chain is the only aria-selected option', () => {
        renderView()
        const selected = within(list())
            .getAllByRole('option')
            .filter((option) => option.getAttribute('aria-selected') === 'true')
        expect(selected).toHaveLength(1)
        expect(selected[0]).toHaveTextContent('Arbitrum')
    })

    test('a coming-soon row is disabled, badged and not selectable', () => {
        const { onSelectChain } = renderView()
        const solana = within(list()).getByRole('option', { name: /Solana/ })
        expect(solana).toHaveAttribute('aria-disabled', 'true')
        expect(solana).toHaveTextContent(/soon/i)
        fireEvent.click(solana)
        expect(onSelectChain).not.toHaveBeenCalled()
    })

    test('picking an available chain reports it; back reports separately', () => {
        const { onSelectChain, onBack } = renderView()
        fireEvent.click(within(list()).getByRole('option', { name: /Ethereum/ }))
        expect(onSelectChain).toHaveBeenCalledWith('1')

        fireEvent.click(screen.getByRole('button', { name: /back/i }))
        expect(onBack).toHaveBeenCalled()
    })

    test('a chain outside allowedChainIds is not listed', () => {
        renderView({ allowedChainIds: new Set(['1']) })
        expect(within(list()).queryByRole('option', { name: /Arbitrum/ })).not.toBeInTheDocument()
        expect(within(list()).getByRole('option', { name: /Ethereum/ })).toBeInTheDocument()
    })

    test('no match shows the empty state instead of the listbox', () => {
        renderView({ searchValue: 'zzz' })
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
        expect(screen.getByText(/no networks found/i)).toBeInTheDocument()
    })
})
