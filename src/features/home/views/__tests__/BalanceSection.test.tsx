import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { withNuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import { BalanceSection } from '../BalanceSection'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/i18n/app/useAppTranslations', () => ({ useAppTranslations: () => (key: string) => key }))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => null }))

let depositAccountsEnabled = true
jest.mock('@/features/deposit-accounts/useDepositAccountsEnabled', () => ({
    useDepositAccountsEnabled: () => depositAccountsEnabled,
}))

const renderSection = (onUrlUpdate?: (e: UrlUpdateEvent) => void, addMoneyEntry: 'picker' | 'drawer' = 'picker') =>
    render(
        <BalanceSection
            addMoneyEntry={addMoneyEntry}
            balance={0n}
            isFetching={false}
            isHidden={false}
            onToggleVisibility={() => {}}
        />,
        {
            wrapper: withNuqsTestingAdapter({ searchParams: '', onUrlUpdate }),
        }
    )

describe('BalanceSection submenu', () => {
    it('request opens its drawer while it offers two ways to be paid', async () => {
        depositAccountsEnabled = true
        const urlUpdates: UrlUpdateEvent[] = []
        renderSection((e) => urlUpdates.push(e))

        const request = screen.getByTestId('home-submenu-request')
        expect(request.tagName).toBe('BUTTON')
        fireEvent.click(request)
        await waitFor(() => expect(urlUpdates.at(-1)?.searchParams.get('drawer')).toBe('request'))
    })

    it('request links straight to /request when its drawer would hold one row', () => {
        depositAccountsEnabled = false
        const urlUpdates: UrlUpdateEvent[] = []
        renderSection((e) => urlUpdates.push(e))

        const request = screen.getByTestId('home-submenu-request')
        expect(request).toHaveAttribute('href', '/request')
        fireEvent.click(request)
        // no drawer state is written, so Back from /request lands on a plain home
        expect(urlUpdates).toHaveLength(0)
    })

    it('opens the full picker directly when setup is needed', () => {
        renderSection()
        expect(screen.getByTestId('home-submenu-add')).toHaveAttribute('href', '/add-money')
        expect(screen.getByTestId('home-submenu-send').tagName).toBe('BUTTON')
    })

    it('opens the Add drawer for a returning user with a usable method', async () => {
        const urlUpdates: UrlUpdateEvent[] = []
        renderSection((event) => urlUpdates.push(event), 'drawer')
        const add = screen.getByTestId('home-submenu-add')
        expect(add.tagName).toBe('BUTTON')
        fireEvent.click(add)
        await waitFor(() => expect(urlUpdates.at(-1)?.searchParams.get('drawer')).toBe('add'))
    })
})
