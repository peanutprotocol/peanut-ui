/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'

const mockSearch = { current: new URLSearchParams() }
const mockParams = { current: {} as Record<string, string> }
jest.mock('next/navigation', () => ({
    useSearchParams: () => mockSearch.current,
    useParams: () => mockParams.current,
}))
jest.mock('@/components/Global/RouteAlias', () => ({
    __esModule: true,
    default: ({ to }: { to: string }) => <div data-testid="alias">{to}</div>,
}))
jest.mock('@/features/kill-switches/useKillSwitches', () => ({
    useKillSwitches: () => ({ disabledMantecaCurrencies: [] }),
}))
let mockPixPayBlock: 'paused' | 'residence' | null = null
jest.mock('@/features/pix/usePixPayBlock', () => ({ usePixPayBlock: () => mockPixPayBlock }))
// the user's Pix routes: none unless a test sets the withdraw route (TASK-24910, a Bridge send)
let mockRoutes: Array<{ operation: string; method: string; state: string }> = []
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ capabilities: { routes: mockRoutes } }) }))
jest.mock('@/features/withdraw/views/PixKeySendView', () => ({
    __esModule: true,
    default: () => <div>pix key send</div>,
}))
jest.mock('@/features/withdraw/views/MantecaBankWithdrawFlow', () => ({
    __esModule: true,
    default: () => <div>manteca</div>,
}))
jest.mock('@/features/paperwork-verification/KycFeatureActivationGate', () => ({
    KycFeatureActivationGate: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock('@/components/AddMoney/components/MantecaAddMoney', () => ({
    __esModule: true,
    default: () => <div>manteca add</div>,
}))
jest.mock('@/features/brazil-pause/components/BrazilPausedScreen', () => ({
    BrazilPausedScreen: ({ block }: { block: string }) => <div data-testid="pix-block">{block}</div>,
}))
jest.mock('@/components/Global/Banner/MantecaTransfersMaintenanceView', () => ({
    MantecaTransfersMaintenanceView: () => null,
}))

import AddMoneyRegionalMethodPage from '@/app/(mobile-ui)/add-money/[country]/[regional-method]/page'
import MantecaWithdrawPage from '@/app/(mobile-ui)/withdraw/manteca/page'

beforeEach(() => {
    mockPixPayBlock = null
    mockRoutes = []
})

describe('the old Brazil URLs', () => {
    it('send add money to the neutral Pix page', () => {
        mockParams.current = { country: 'brazil', 'regional-method': 'manteca' }
        mockSearch.current = new URLSearchParams()
        render(<AddMoneyRegionalMethodPage />)
        expect(screen.getByTestId('alias')).toHaveTextContent('/add-money/pix')
    })

    it('send a withdrawal to the neutral Pix page', () => {
        mockSearch.current = new URLSearchParams('country=brazil&destination=09579927189')
        render(<MantecaWithdrawPage />)
        expect(screen.getByTestId('alias')).toHaveTextContent('/withdraw/pix')
    })

    it('keep a Pix-key send to another person on the QR-pay key screen', () => {
        mockSearch.current = new URLSearchParams('country=brazil&method=pix')
        render(<MantecaWithdrawPage />)
        expect(screen.getByText('pix key send')).toBeInTheDocument()
        expect(screen.queryByTestId('alias')).toBeNull()
    })

    it('leave Argentina on Manteca', () => {
        mockParams.current = { country: 'argentina', 'regional-method': 'manteca' }
        render(<AddMoneyRegionalMethodPage />)
        expect(screen.getByText('manteca add')).toBeInTheDocument()
    })
})

// live test on staging, 2026-11-12: a resident of Brazil picked BRL to withdraw and reached the
// block screen. Their own-account Pix works; only a send to another person's key is closed.
describe('the Brazil Pix page (/withdraw/manteca?country=brazil&method=pix)', () => {
    const OWN = 'country=brazil&method=pix'
    const FROM_SEND = 'country=brazil&method=pix&sendMethod=bank'
    const open = (search: string, block: typeof mockPixPayBlock) => {
        mockPixPayBlock = block
        mockSearch.current = new URLSearchParams(search)
        render(<MantecaWithdrawPage />)
    }

    it('a resident outside Send lands on their own-account Pix withdrawal, with no block screen', () => {
        open(OWN, 'residence')
        expect(screen.getByTestId('alias')).toHaveTextContent('/withdraw/pix')
        expect(screen.queryByTestId('pix-block')).toBeNull()
    })

    it('a resident who came from Send keeps the block screen', () => {
        open(FROM_SEND, 'residence')
        expect(screen.getByTestId('pix-block')).toHaveTextContent('residence')
        expect(screen.queryByTestId('alias')).toBeNull()
    })

    it.each([
        ['outside Send', OWN],
        ['from Send', FROM_SEND],
    ])('a user with no block reaches the key screen, %s', (_origin, search) => {
        open(search, null)
        expect(screen.getByText('pix key send')).toBeInTheDocument()
        expect(screen.queryByTestId('alias')).toBeNull()
        expect(screen.queryByTestId('pix-block')).toBeNull()
    })

    it.each([
        ['outside Send', OWN],
        ['from Send', FROM_SEND],
    ])('the Brazil pause shows its screen, %s', (_origin, search) => {
        open(search, 'paused')
        expect(screen.getByTestId('pix-block')).toHaveTextContent('paused')
        expect(screen.queryByTestId('alias')).toBeNull()
    })

    // TASK-24910: Bridge pays another person's key on the withdraw route, so a resident sends on the Pix-key form
    it.each([
        ['outside Send', OWN],
        ['from Send', FROM_SEND],
    ])('a resident whose withdraw route is open goes to the Pix-key form, %s', (_origin, search) => {
        mockRoutes = [{ operation: 'withdraw', method: 'PIX_BR', state: 'ready' }]
        open(search, 'residence')
        expect(screen.getByTestId('alias')).toHaveTextContent('/withdraw/pix')
        expect(screen.queryByTestId('pix-block')).toBeNull()
        expect(screen.queryByText('pix key send')).toBeNull()
    })
})
