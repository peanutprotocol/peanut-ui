/** @jest-environment jsdom */
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import type { PixDepositPhase } from '../pixFlow.utils'
import type { PixDeposit } from '@/services/pix'

jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Provider/ProviderFinePrint', () => ({ ProviderFinePrint: () => null }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div>loading</div> }))
jest.mock('@/components/Global/QRCodeWrapper', () => ({
    __esModule: true,
    default: ({ url }: { url: string }) => <div data-testid="qr">{url}</div>,
}))
jest.mock('@/components/Global/CopyToClipboard', () => ({ __esModule: true, default: () => null }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null }) }))
const mockDeposit = jest.fn<{ deposit: PixDeposit | undefined; phase: PixDepositPhase; isError: boolean }, []>()
jest.mock('@/features/pix/usePixDeposit', () => ({ usePixDeposit: () => mockDeposit() }))

import { PixQrDeposit } from '../components/PixQrDeposit'

const inTenMinutes = () => new Date(Date.now() + 600_000).toISOString()
const read = (overrides: Partial<PixDeposit> = {}): PixDeposit => ({
    provider: 'manteca',
    intentId: 'd1',
    status: 'AWAITING_USER_ACTION',
    pixReceived: false,
    expiresAt: inTenMinutes(),
    amountBrl: '100.00',
    usdcAmount: '17.940500',
    codePayable: true,
    brCode: '00020101021226...',
    ...overrides,
})
const state = (phase: PixDepositPhase, deposit: PixDeposit | undefined = read()) =>
    mockDeposit.mockReturnValue({ deposit, phase, isError: false })
const onNewDeposit = jest.fn()
const renderScreen = () =>
    renderWithIntl(
        <PixQrDeposit
            intentId="d1"
            onBack={jest.fn()}
            onDone={jest.fn()}
            onNewDeposit={onNewDeposit}
            onComplete={jest.fn()}
        />
    )

describe('PixQrDeposit', () => {
    beforeEach(() => jest.clearAllMocks())

    // Aleks, 2026-11-12: the header is the amount and what the balance gets; the time left is a pending
    // badge under the code; the flat fee and the blocked-bank list are gone
    it('draws the code from the deposit read, with what the balance gets and the time the code has left', () => {
        state('pending', read({ fixedFeeBrl: '0.75' }))
        renderScreen()
        expect(screen.getByTestId('qr')).toHaveTextContent('00020101021226...')
        expect(screen.getByText('R$100')).toBeInTheDocument()
        expect(screen.getByText('You get ≈ $17.94')).toBeInTheDocument()
        expect(screen.getByText(/^Code valid for /)).toBeInTheDocument()
        expect(screen.queryByText(/^Fee /)).toBeNull()
        expect(screen.queryByText(/is returned/)).toBeNull()
    })

    // a provider that sends no expiry or payer CPF: the code alone, with no line it cannot fill
    it('draws a code with no expiry or payer as the code alone', () => {
        state('pending', read({ expiresAt: null }))
        renderScreen()
        expect(screen.getByTestId('qr')).toHaveTextContent('00020101021226...')
        expect(screen.queryByText(/^Code valid for /)).toBeNull()
        expect(screen.queryByText(/under your CPF/)).toBeNull()
    })

    it('waits for the first read (a reload, a deep link) instead of offering a new amount', () => {
        mockDeposit.mockReturnValue({ deposit: undefined, phase: 'pending', isError: false })
        renderScreen()
        expect(screen.getByText('loading')).toBeInTheDocument()
        expect(screen.queryByTestId('qr')).toBeNull()
    })

    it('says Pix is not available while the read fails, and keeps polling', () => {
        mockDeposit.mockReturnValue({ deposit: undefined, phase: 'pending', isError: true })
        renderScreen()
        expect(screen.getByText(en.pix.unavailable)).toBeInTheDocument()
    })

    it.each([
        ['the API says the code lapsed', 'expired' as const, read({ codePayable: false, brCode: undefined })],
        ['the clock ran out', 'pending' as const, read({ expiresAt: new Date(Date.now() - 1000).toISOString() })],
    ])('shows no dead code once %s, and offers a new deposit', (_case, phase, deposit) => {
        state(phase, deposit)
        renderScreen()
        expect(screen.queryByTestId('qr')).toBeNull()
        expect(screen.getByText(en.addMoney.pix.qrExpired)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: en.pix.deposit.startNew }))
        expect(onNewDeposit).toHaveBeenCalled()
    })

    it('says a returned Pix came back, and offers a new deposit', () => {
        state('returned', read({ status: 'FAILED', codePayable: false, brCode: undefined }))
        renderScreen()
        expect(screen.getByText(en.pix.deposit.returnedTitle)).toBeInTheDocument()
        expect(screen.queryByTestId('qr')).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: en.pix.deposit.startNew }))
        expect(onNewDeposit).toHaveBeenCalled()
    })

    it('shows a received deposit, and no new-deposit offer while the Pix is processing', () => {
        state('completed', read({ status: 'COMPLETED', codePayable: false }))
        const { unmount } = renderScreen()
        expect(screen.getByText(en.addMoney.pix.depositReceived)).toBeInTheDocument()
        unmount()
        state('processing', read({ status: 'PROCESSING', pixReceived: true, codePayable: false }))
        renderScreen()
        expect(screen.getByText(en.addMoney.processingDepositTitle)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: en.pix.deposit.startNew })).toBeNull()
    })
})
