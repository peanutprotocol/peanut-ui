import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    hasFundedBefore?: boolean
    balance?: bigint
    isHidden?: boolean
    isStale?: boolean
}

const renderSection = (
    onUrlUpdate?: (e: UrlUpdateEvent) => void,
    addMoneyEntry: 'picker' | 'drawer' = 'picker',
    { balance = 0n, isHidden = false, ...pill }: PillProps = {}
) =>
    render(
        <BalanceSection
            addMoneyEntry={addMoneyEntry}
            {...pill}
            balance={balance}
            isFetching={false}
            isHidden={isHidden}
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

describe('BalanceSection Add money pill', () => {
    beforeEach(() => mockedCapture.mockClear())
    const verified = { isVerified: true }

    it('keeps the round Add and tracks taps without the pill', () => {
        renderSection()
        expect(screen.getByTestId('home-submenu-add')).toHaveTextContent('add')
        fireEvent.click(screen.getByTestId('home-submenu-send'))
        expect(mockedCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.HOME_SUBMENU_TAPPED, {
            action: 'send',
            add_cta_active: false,
        })
        expect(mockedCapture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.HOME_ADD_CTA_SHOWN, expect.anything())
    })

    it('renders the labelled pill to the same picker link and tracks it', () => {
        renderSection(undefined, 'picker', verified)
        const add = screen.getByTestId('home-submenu-add')
        expect(add).toHaveAttribute('href', '/add-money')
        expect(add).toHaveTextContent('addMoneyPill.addMoney')
        expect(mockedCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.HOME_ADD_CTA_SHOWN, {
            balance_bucket: '0',
            label: 'add_money',
        })
        fireEvent.click(add)
        expect(mockedCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.HOME_SUBMENU_TAPPED, {
            action: 'add',
            add_cta_active: true,
        })
    })

    it('reads "Top up" once money came in before', () => {
        renderSection(undefined, 'picker', { ...verified, hasFundedBefore: true, balance: 3_000_000n })
        expect(screen.getByTestId('home-submenu-add')).toHaveTextContent('addMoneyPill.topUp')
        expect(mockedCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.HOME_ADD_CTA_SHOWN, {
            balance_bucket: '1-10',
            label: 'top_up',
        })
    })

    it.each<[string, PillProps]>([
        ['the balance is $10 or more', { ...verified, balance: 10_000_000n }],
        ['the balance is hidden', { ...verified, isHidden: true }],
        ['the balance is stale', { ...verified, isStale: true }],
        ['the user is not verified', { isVerified: false }],
    ])('keeps the round Add while %s', (_, props) => {
        renderSection(undefined, 'picker', props)
        expect(screen.getByTestId('home-submenu-add')).toHaveTextContent(/^add$/)
        expect(mockedCapture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.HOME_ADD_CTA_SHOWN, expect.anything())
    })

    it('opens the Add drawer from the pill for a returning user', async () => {
        const urlUpdates: UrlUpdateEvent[] = []
        renderSection((event) => urlUpdates.push(event), 'drawer', verified)
        const add = screen.getByTestId('home-submenu-add')
        expect(add.tagName).toBe('BUTTON')
        fireEvent.click(add)
        await waitFor(() => expect(urlUpdates.at(-1)?.searchParams.get('drawer')).toBe('add'))
    })

    it('falls back to the short label when the long one does not fit', () => {
        const scrollWidth = jest.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(200)
        renderSection(undefined, 'picker', verified)
        expect(screen.getByTestId('home-submenu-add')).toHaveTextContent(/^add$/)
        scrollWidth.mockRestore()
    })

    it('returns to the long label when the row widens again', () => {
        const observers: Array<() => void> = []
        const original = global.ResizeObserver
        global.ResizeObserver = class {
            constructor(private callback: () => void) {}
            observe() {
                observers.push(this.callback)
            }
            unobserve() {}
            disconnect() {}
        } as unknown as typeof ResizeObserver
        let width = 100
        const scrollWidth = jest.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(200)
        const clientWidth = jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width)
        try {
            renderSection(undefined, 'picker', verified)
            expect(screen.getByTestId('home-submenu-add')).toHaveTextContent(/^add$/)
            width = 300
            act(() => observers.forEach((notify) => notify()))
            expect(screen.getByTestId('home-submenu-add')).toHaveTextContent('addMoneyPill.addMoney')
        } finally {
            scrollWidth.mockRestore()
            clientWidth.mockRestore()
            global.ResizeObserver = original
        }
    })
})
