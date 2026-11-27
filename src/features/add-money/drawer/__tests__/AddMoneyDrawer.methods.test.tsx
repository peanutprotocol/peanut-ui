import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { AddMoneyDrawer } from '../AddMoneyDrawer'
import type { DrawerBankPlan } from '../addMoneyDrawerPlan'

const mockCapture = jest.fn()
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => mockCapture(...args) },
}))
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/components/Global/Drawer', () => ({
    Drawer: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
    DrawerContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DrawerTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}))
jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: ({ onPrev }: { onPrev: () => void }) => <button onClick={onPrev}>back</button>,
}))
jest.mock('@/components/AddMoney/components/NetworkList', () => ({
    __esModule: true,
    default: ({ onSelect }: { onSelect: (network: string) => void }) => (
        <button onClick={() => onSelect('SOL')}>network-sol</button>
    ),
}))
// the views below the choice have their own tests
jest.mock('../DrawerCryptoDepositView', () => ({
    DrawerCryptoDepositView: ({ network }: { network: string }) => <div>address-{network}</div>,
}))
jest.mock('../DrawerBankDetailsView', () => ({
    DrawerBankDetailsView: ({ corridor }: { corridor: string }) => <div>details-{corridor}</div>,
}))
jest.mock('@/features/deposit-accounts/useDepositAccounts', () => ({
    useDepositAccounts: () => ({ accounts: {} }),
}))
jest.mock('@/features/deposit-accounts/useDepositAccountCopy', () => ({
    useDepositAccountCopy: () => ({ accountRailName: () => 'ACH' }),
}))
let region = { refused: false, known: true }
jest.mock('@/features/card/useBankRegionRefusal', () => ({ useBankRegionRefusal: () => region }))

beforeEach(() => {
    jest.clearAllMocks()
    region = { refused: false, known: true }
})

function renderDrawer(plan: DrawerBankPlan) {
    const props = {
        open: true,
        targetUsd: 50,
        gapUsd: 40,
        residenceIso2s: ['US'],
        returnTo: '/send/ana?amount=50',
        place: 'send' as const,
        onShow: jest.fn(),
        onDismiss: jest.fn(),
        onBankSent: jest.fn(),
    }
    const view = render(<AddMoneyDrawer {...props} plan={plan} />)
    return { ...view, rerender: (next: DrawerBankPlan) => view.rerender(<AddMoneyDrawer {...props} plan={next} />) }
}

const opened = () => mockCapture.mock.calls.filter(([name]) => name === ANALYTICS_EVENTS.SEND_ADD_MONEY_DRAWER_OPENED)

it('lists each ready bank way and crypto, and back from crypto returns to the choice', () => {
    renderDrawer({
        kind: 'rows',
        rows: [
            { kind: 'account', corridor: 'ACH_US' },
            { kind: 'page', corridor: 'PIX_BR' },
        ],
    })
    expect(screen.getByTestId('card-add-money-rail-ach_us')).toBeInTheDocument()
    expect(screen.getByTestId('card-add-money-rail-pix_br')).toBeInTheDocument()
    expect(opened()).toEqual([[ANALYTICS_EVENTS.SEND_ADD_MONEY_DRAWER_OPENED, { method: null, view: 'methods' }]])

    fireEvent.click(screen.getByTestId('add-money-method-crypto'))
    fireEvent.click(screen.getByText('network-sol'))
    expect(screen.getByText('address-SOL')).toBeInTheDocument()
    fireEvent.click(screen.getByText('back'))
    fireEvent.click(screen.getByText('back'))
    expect(screen.getByTestId('add-money-method-crypto')).toBeInTheDocument()
})

it('opens a held account in the drawer and sends a page way to its page with the gap and a way back', () => {
    renderDrawer({
        kind: 'rows',
        rows: [
            { kind: 'account', corridor: 'ACH_US' },
            { kind: 'page', corridor: 'BANK_TRANSFER_AR' },
        ],
    })
    fireEvent.click(screen.getByTestId('card-add-money-rail-bank_transfer_ar'))
    const href = mockPush.mock.calls[0][0] as string
    expect(href).toContain('amount=40.00')
    expect(href).toContain(`returnTo=${encodeURIComponent('/send/ana?amount=50')}`)

    fireEvent.click(screen.getByTestId('card-add-money-rail-ach_us'))
    expect(screen.getByText('details-ACH_US')).toBeInTheDocument()
    fireEvent.click(screen.getByText('back'))
    expect(screen.getByTestId('add-money-method-crypto')).toBeInTheDocument()
})

it('a bank the user can act on is one row with its badge; its status has a back to the choice', () => {
    renderDrawer({ kind: 'not-verified' })
    const bank = screen.getByTestId('add-money-method-bank')
    expect(bank).toHaveTextContent('list.badgeVerifyId')
    fireEvent.click(bank)
    expect(screen.getByTestId('card-add-money-status-not-verified')).toBeInTheDocument()
    fireEvent.click(screen.getByText('back'))
    expect(screen.getByTestId('add-money-method-bank')).toBeInTheDocument()
})

it.each<[string, DrawerBankPlan, typeof region]>([
    ['under review', { kind: 'under-review' }, region],
    ['setting up', { kind: 'setting-up', corridor: 'ACH_US' }, region],
    ['refused for the residence', { kind: 'not-offered' }, { refused: true, known: true }],
])('with bank %s, crypto is the only way: the drawer opens on the networks (Q1)', (_, plan, nextRegion) => {
    region = nextRegion
    renderDrawer(plan)
    expect(screen.queryByTestId('add-money-method-bank')).not.toBeInTheDocument()
    expect(screen.getByText('network-sol')).toBeInTheDocument()
    // the root: no back control
    expect(screen.queryByText('back')).not.toBeInTheDocument()
    expect(opened()).toEqual([[ANALYTICS_EVENTS.SEND_ADD_MONEY_DRAWER_OPENED, { method: 'crypto', view: 'networks' }]])
})

it('waits on the plan instead of showing a choice it may take back', () => {
    const { rerender } = renderDrawer({ kind: 'loading' })
    expect(screen.queryByTestId('add-money-method-crypto')).not.toBeInTheDocument()
    expect(screen.queryByText('network-sol')).not.toBeInTheDocument()
    expect(opened()).toEqual([])
    rerender({ kind: 'finish-setup' })
    expect(screen.getByTestId('add-money-method-bank')).toHaveTextContent('list.badgeActionNeeded')
})
