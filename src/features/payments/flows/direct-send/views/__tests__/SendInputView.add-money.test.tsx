import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { IntlWrapper } from '@/test-utils/intl'

const mockCapture = jest.fn()
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => mockCapture(...args) },
}))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ isFetchingUser: false, user: { user: { userId: 'u1' } } }),
}))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/AmountInput', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/User/UserCard', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/SupportCTA', () => ({ __esModule: true, default: () => null }))
jest.mock('@/features/payments/shared/components/PaymentMethodActionList', () => ({
    PaymentMethodActionList: () => null,
}))
jest.mock('@/features/payments/shared/components/SendWithPeanutCta', () => ({
    __esModule: true,
    default: ({ disabled, onClick }: { disabled?: boolean; onClick?: () => void }) => (
        <button disabled={disabled} onClick={onClick}>
            send
        </button>
    ),
}))
jest.mock('@/features/add-money/useAddMoneyReadiness', () => ({
    useAddMoneyReadiness: () => ({ isLoading: true, residenceIso2s: [], ready: {}, topUpGates: {} }),
}))
// the drawer's own views have their own tests; this one checks what Send hands it and gets back
type DrawerProps = {
    open: boolean
    targetUsd: number
    gapUsd?: number
    returnTo: () => string
    onShow: (method: 'bank' | 'crypto' | null, view: string) => void
    onBankSent: (inDollars: boolean) => void
}
let drawerProps: DrawerProps | undefined
jest.mock('@/features/add-money/drawer/AddMoneyDrawer', () => ({
    AddMoneyDrawer: (props: DrawerProps) => {
        drawerProps = props
        return props.open ? <div data-testid="drawer" /> : null
    },
}))

let mockFlow: Record<string, unknown>
jest.mock('../../useDirectSendFlow', () => ({ useDirectSendFlow: () => mockFlow }))

import { SendInputView } from '../SendInputView'

const flow = (overrides: Record<string, unknown>) => ({
    amount: '50',
    recipient: { username: 'ana', isVerified: false, person: null },
    attachment: {},
    error: { showError: false, errorMessage: '' },
    formattedBalance: '10',
    balanceFillAmount: 10,
    liveSpendableUsd: 10,
    isSpendableBalanceSettled: true,
    canProceed: true,
    hasSufficientBalance: false,
    isInsufficientBalance: true,
    isLoggedIn: true,
    isLoading: false,
    setAmount: jest.fn(),
    setAttachment: jest.fn(),
    executePayment: jest.fn(),
    ...overrides,
})
const funded = { balanceFillAmount: 60, liveSpendableUsd: 60, hasSufficientBalance: true, isInsufficientBalance: false }

const renderView = () => {
    const view = render(<SendInputView />, { wrapper: IntlWrapper as (p: { children: ReactNode }) => JSX.Element })
    return { ...view, rerender: () => view.rerender(<SendInputView />) }
}

beforeEach(() => {
    jest.clearAllMocks()
    sessionStorage.clear()
    drawerProps = undefined
    window.history.replaceState({}, '', '/send/ana?amount=50')
})

it('a short balance offers "Add $X" for the gap, and the drawer opens on this step with a way back to it', () => {
    mockFlow = flow({})
    renderView()
    expect(screen.queryByRole('button', { name: 'send' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add $40' }))
    expect(screen.getByTestId('drawer')).toBeInTheDocument()
    expect(drawerProps).toMatchObject({ targetUsd: 50, gapUsd: 40 })
    expect(drawerProps!.returnTo()).toBe('/send/ana?amount=50')
})

it('rounds the gap up to the cent', () => {
    mockFlow = flow({ amount: '10', liveSpendableUsd: 3.205 })
    renderView()
    expect(screen.getByRole('button', { name: 'Add $6.80' })).toBeInTheDocument()
})

it('once funded, closes the drawer and turns Send on without sending', () => {
    mockFlow = flow({})
    const { rerender } = renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Add $40' }))
    act(() => drawerProps!.onShow('crypto', 'address'))

    mockFlow = flow(funded)
    rerender()
    expect(screen.queryByTestId('drawer')).not.toBeInTheDocument()
    const send = screen.getByRole('button', { name: 'send' })
    expect(send).toBeEnabled()
    expect(mockFlow.executePayment).not.toHaveBeenCalled()
    expect(mockCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SEND_ADD_MONEY_CAME_BACK_FUNDED, {
        in_drawer: true,
        method: 'crypto',
    })
})

it('counts a user who funds elsewhere and comes back, but not one who only lowers the amount', () => {
    mockFlow = flow({})
    const first = renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Add $40' }))
    first.unmount()

    // back on Send with a lower amount, the balance still short of the $50 tapped for
    mockFlow = flow({ amount: '5', ...funded, liveSpendableUsd: 10 })
    const second = renderView()
    expect(mockCapture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.SEND_ADD_MONEY_CAME_BACK_FUNDED, expect.anything())

    mockFlow = flow({ amount: '5', ...funded })
    second.rerender()
    expect(mockCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SEND_ADD_MONEY_CAME_BACK_FUNDED, {
        in_drawer: false,
        method: null,
    })
})

it('"I\'ve sent the transfer": the note and a waiting Send replace the error and "Add $X" until it lands', () => {
    mockFlow = flow({})
    const { rerender } = renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Add $40' }))
    act(() => drawerProps!.onBankSent(true))
    expect(screen.queryByTestId('drawer')).not.toBeInTheDocument()
    expect(screen.getByTestId('send-add-money-bank-sent')).toHaveTextContent('$40 transfer')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByTestId('send-add-money')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'send' })).toBeDisabled()

    // another way reopens the drawer on this step
    fireEvent.click(screen.getByRole('button', { name: 'Add money another way' }))
    expect(screen.getByTestId('drawer')).toBeInTheDocument()

    mockFlow = flow(funded)
    rerender()
    expect(screen.queryByTestId('send-add-money-bank-sent')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'send' })).toBeEnabled()
})

// Chip on ui#4316: the display cache can read high while the live total the gate uses is short
it('a cached balance that covers the amount never reads as funded while the live one is short', () => {
    mockFlow = flow({})
    const { rerender } = renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Add $40' }))

    mockFlow = flow({ balanceFillAmount: 100 })
    rerender()
    expect(screen.getByTestId('drawer')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add $40' })).toBeInTheDocument()
    // and while the live total is not read yet, nothing reads as funded either
    mockFlow = flow({ balanceFillAmount: 100, liveSpendableUsd: undefined })
    rerender()
    expect(screen.getByTestId('drawer')).toBeInTheDocument()
    expect(mockCapture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.SEND_ADD_MONEY_CAME_BACK_FUNDED, expect.anything())
})

it('keeps the "on its way" note while only the cached balance covers the amount', () => {
    mockFlow = flow({})
    const { rerender } = renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Add $40' }))
    act(() => drawerProps!.onBankSent(true))
    mockFlow = flow({ balanceFillAmount: 100 })
    rerender()
    expect(screen.getByTestId('send-add-money-bank-sent')).toBeInTheDocument()
})

it('stays disabled while the balance is still being read', () => {
    mockFlow = flow({ isInsufficientBalance: false })
    renderView()
    expect(screen.getByRole('button', { name: 'send' })).toBeDisabled()
})
