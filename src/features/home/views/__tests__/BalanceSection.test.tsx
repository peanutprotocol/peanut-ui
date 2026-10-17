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

const renderSection = (onUrlUpdate?: (e: UrlUpdateEvent) => void) =>
    render(<BalanceSection balance={0n} isFetching={false} isHidden={false} onToggleVisibility={() => {}} />, {
        wrapper: withNuqsTestingAdapter({ searchParams: '', onUrlUpdate }),
    })

describe('BalanceSection submenu', () => {
    it('formats euro units separately and hides dollar-only actions', () => {
        render(
            <BalanceSection
                balance={2_500_000n}
                currencySymbol="€"
                decimals={6}
                actions={null}
                isFetching={false}
                isHidden={false}
                onToggleVisibility={() => {}}
            />,
            {
                wrapper: withNuqsTestingAdapter({ searchParams: '' }),
            }
        )
        expect(screen.getByText('€')).toBeInTheDocument()
        expect(screen.getByText('2.5')).toBeInTheDocument()
        expect(screen.queryByTestId('home-submenu-add')).not.toBeInTheDocument()
        expect(screen.queryByTestId('home-submenu-send')).not.toBeInTheDocument()
    })

    it('keeps the shared privacy control on the EURC balance', () => {
        const toggle = jest.fn()
        render(
            <BalanceSection
                balance={2_500_000n}
                currencySymbol="€"
                decimals={6}
                actions={null}
                isFetching={false}
                isHidden={true}
                onToggleVisibility={toggle}
            />,
            {
                wrapper: withNuqsTestingAdapter({ searchParams: '' }),
            }
        )
        expect(screen.getByText('****')).toBeInTheDocument()
        expect(screen.queryByText('2.5')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'showBalance' }))
        expect(toggle).toHaveBeenCalledTimes(1)
    })
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

    it('add and send keep their drawers either way', () => {
        depositAccountsEnabled = false
        renderSection()

        expect(screen.getByTestId('home-submenu-add').tagName).toBe('BUTTON')
        expect(screen.getByTestId('home-submenu-send').tagName).toBe('BUTTON')
    })
})
