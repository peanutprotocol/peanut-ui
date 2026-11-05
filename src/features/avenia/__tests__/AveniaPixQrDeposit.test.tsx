/** @jest-environment jsdom */
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import type { AveniaDepositPhase } from '../avenia.utils'

jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Provider/ProviderFinePrint', () => ({ ProviderFinePrint: () => null }))
jest.mock('@/components/Global/QRCodeWrapper', () => ({
    __esModule: true,
    default: ({ url }: { url: string }) => <div data-testid="qr">{url}</div>,
}))
jest.mock('@/components/Global/CopyToClipboard', () => ({ __esModule: true, default: () => null }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null }) }))
const mockStatus = jest.fn<{ phase: AveniaDepositPhase; expiresAt: string | null }, []>()
jest.mock('@/features/avenia/hooks/useAveniaDepositStatus', () => ({ useAveniaDepositStatus: () => mockStatus() }))

import { AveniaPixQrDeposit } from '../components/AveniaPixQrDeposit'

const inTenMinutes = () => new Date(Date.now() + 600_000).toISOString()
const deposit = () => ({
    intentId: 'd1',
    brCode: '00020101021226...',
    amountBrl: '100.00',
    usdcAmount: '17.940500',
    expiresAt: inTenMinutes(),
    payerCpfMasked: '095.***.***-89',
})
const renderScreen = (created: ReturnType<typeof deposit> | undefined, blockedBankNames: string[] = []) =>
    renderWithIntl(
        <AveniaPixQrDeposit
            intentId="d1"
            deposit={created}
            blockedBankNames={blockedBankNames}
            onBack={jest.fn()}
            onDone={jest.fn()}
            onComplete={jest.fn()}
        />
    )

describe('AveniaPixQrDeposit', () => {
    beforeEach(() => jest.clearAllMocks())

    it('shows the code while it can be paid', () => {
        mockStatus.mockReturnValue({ phase: 'pending', expiresAt: inTenMinutes() })
        renderScreen(deposit())
        expect(screen.getByTestId('qr')).toHaveTextContent('00020101021226...')
        expect(screen.getByText('R$100')).toBeInTheDocument()
    })

    it('shows what the balance gets, after the fees in the quote', () => {
        mockStatus.mockReturnValue({ phase: 'pending', expiresAt: inTenMinutes() })
        renderScreen(deposit())
        expect(screen.getByText('You get ≈ $17.94')).toBeInTheDocument()
    })

    it('names the banks whose Pix Avenia sends back, while the code can be paid', () => {
        mockStatus.mockReturnValue({ phase: 'pending', expiresAt: inTenMinutes() })
        renderScreen(deposit(), ['Caixa', 'Sicredi', 'Sicoob'])
        expect(screen.getByText('A Pix from Caixa, Sicredi, or Sicoob is returned.')).toBeInTheDocument()
    })

    it('says nothing about banks when none is blocked', () => {
        mockStatus.mockReturnValue({ phase: 'pending', expiresAt: inTenMinutes() })
        renderScreen(deposit())
        expect(screen.queryByText(/is returned/)).toBeNull()
    })

    it('after a reload, waits on the status instead of offering a new amount', () => {
        mockStatus.mockReturnValue({ phase: 'pending', expiresAt: inTenMinutes() })
        renderScreen(undefined)
        expect(screen.getByText(en.addMoney.processingDepositTitle)).toBeInTheDocument()
        expect(screen.queryByTestId('qr')).toBeNull()
    })

    it('after a reload, says the code has expired once its expiry passed', () => {
        mockStatus.mockReturnValue({ phase: 'pending', expiresAt: new Date(Date.now() - 1000).toISOString() })
        renderScreen(undefined)
        expect(screen.getByText(en.addMoney.pix.qrExpired)).toBeInTheDocument()
    })

    it('reads a code the API cancelled as expired, not as a returned Pix', () => {
        mockStatus.mockReturnValue({ phase: 'expired', expiresAt: null })
        renderScreen(deposit())
        expect(screen.getByText(en.addMoney.pix.qrExpired)).toBeInTheDocument()
        expect(screen.queryByText(en.avenia.deposit.returnedTitle)).toBeNull()
    })

    it('shows a returned Pix after a reload too', () => {
        mockStatus.mockReturnValue({ phase: 'returned', expiresAt: null })
        renderScreen(undefined)
        expect(screen.getByText(en.avenia.deposit.returnedTitle)).toBeInTheDocument()
    })

    it('shows the received deposit after a reload', () => {
        mockStatus.mockReturnValue({ phase: 'completed', expiresAt: null })
        renderScreen(undefined)
        expect(screen.getByText(en.addMoney.pix.depositReceived)).toBeInTheDocument()
    })
})
