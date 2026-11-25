import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { withNuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { BalanceSection } from '../BalanceSection'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
const mockedCapture = posthog.capture as jest.MockedFunction<typeof posthog.capture>

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/i18n/app/useAppTranslations', () => ({ useAppTranslations: () => (key: string) => key }))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => null }))

let depositAccountsEnabled = true
jest.mock('@/features/deposit-accounts/useDepositAccountsEnabled', () => ({
    useDepositAccountsEnabled: () => depositAccountsEnabled,
}))

type PillProps = {
    isVerified?: boolean
    balance?: bigint
    isHidden?: boolean
    isStale?: boolean
    isFetching?: boolean
}

const renderSection = (
    onUrlUpdate?: (e: UrlUpdateEvent) => void,
    addMoneyEntry: 'picker' | 'drawer' = 'picker',
    props: PillProps = {}
) => {
    const { balance, isHidden = false, isFetching = false, ...pill } = { balance: 0n, ...props }
    return render(
        <BalanceSection
            addMoneyEntry={addMoneyEntry}
            {...pill}
            balance={balance}
            isFetching={isFetching}
            isHidden={isHidden}
            onToggleVisibility={() => {}}
        />,
        {
            wrapper: withNuqsTestingAdapter({ searchParams: '', onUrlUpdate }),
        }
    )
}

const actionOrder = () =>
    screen.getAllByTestId(/^home-submenu-/).map((el) => el.dataset.testid?.replace('home-submenu-', ''))

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

describe('BalanceSection pink Add button', () => {
    beforeEach(() => mockedCapture.mockClear())

    // decision 24 Nov (Kush): no gate on verification, balance, visibility or loading
    it.each<[string, PillProps]>([
        ['a verified user under $10', { isVerified: true }],
        ['an unverified user', { isVerified: false }],
        ['a balance of $10 or more', { isVerified: true, balance: 16_000_000n }],
        ['a hidden balance', { isVerified: true, isHidden: true }],
        ['a stale balance', { isVerified: true, isStale: true }],
        ['a balance still loading', { isVerified: true, balance: undefined, isFetching: true }],
    ])('puts the pink Add money in the centre for %s', (_, props) => {
        renderSection(undefined, 'picker', props)
        const add = screen.getByTestId('home-submenu-add')
        expect(add).toHaveTextContent('addMoneyPill.addMoney')
        expect(add).toHaveAttribute('href', '/add-money')
        expect(actionOrder()).toEqual(['send', 'add', 'request'])
    })

    it('tracks taps without the old add_cta_active flag', () => {
        renderSection()
        fireEvent.click(screen.getByTestId('home-submenu-send'))
        expect(mockedCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.HOME_SUBMENU_TAPPED, { action: 'send' })
        fireEvent.click(screen.getByTestId('home-submenu-add'))
        expect(mockedCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.HOME_SUBMENU_TAPPED, { action: 'add' })
    })

    it.each<[string, PillProps, string]>([
        ['an empty balance', { isVerified: true, balance: 0n }, '0'],
        ['$3', { isVerified: true, balance: 3_000_000n }, '1-10'],
        ['$16, unverified', { isVerified: false, balance: 16_000_000n }, '10-100'],
        ['$250, hidden', { isVerified: true, balance: 250_000_000n, isHidden: true }, '100-1000'],
        ['$1500', { isVerified: true, balance: 1_500_000_000n }, '1000+'],
    ])('tracks the Add as shown once for %s', (_, props, bucket) => {
        renderSection(undefined, 'picker', props)
        expect(mockedCapture).toHaveBeenCalledTimes(1)
        expect(mockedCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.HOME_ADD_CTA_SHOWN, {
            balance_bucket: bucket,
            label: 'add_money',
            is_verified: !!props.isVerified,
        })
    })

    it('waits for a live balance before tracking the Add as shown, then tracks it once', () => {
        const { rerender } = renderSection(undefined, 'picker', { balance: undefined, isFetching: true })
        expect(mockedCapture).not.toHaveBeenCalled()
        rerender(
            <BalanceSection
                balance={5_000_000n}
                isFetching={false}
                isStale
                isHidden={false}
                onToggleVisibility={() => {}}
            />
        )
        expect(mockedCapture).not.toHaveBeenCalled()
        rerender(
            <BalanceSection balance={5_000_000n} isFetching={false} isHidden={false} onToggleVisibility={() => {}} />
        )
        rerender(
            <BalanceSection balance={20_000_000n} isFetching={false} isHidden={false} onToggleVisibility={() => {}} />
        )
        expect(mockedCapture).toHaveBeenCalledTimes(1)
        expect(mockedCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.HOME_ADD_CTA_SHOWN, {
            balance_bucket: '1-10',
            label: 'add_money',
            is_verified: false,
        })
    })

    it('opens the Add drawer from the pink button for a returning user', async () => {
        const urlUpdates: UrlUpdateEvent[] = []
        renderSection((event) => urlUpdates.push(event), 'drawer')
        const add = screen.getByTestId('home-submenu-add')
        expect(add.tagName).toBe('BUTTON')
        fireEvent.click(add)
        await waitFor(() => expect(urlUpdates.at(-1)?.searchParams.get('drawer')).toBe('add'))
    })
})
