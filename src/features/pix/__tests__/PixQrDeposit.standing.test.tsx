/** @jest-environment jsdom */
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import type { PixDeposit } from '@/services/pix'
import type { PixStandingRefusal } from '../pixFlow.utils'

jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Provider/ProviderFinePrint', () => ({ ProviderFinePrint: () => <div>fine print</div> }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div>loading</div> }))
jest.mock('@/components/Global/QRCodeWrapper', () => ({
    __esModule: true,
    default: ({ url }: { url: string }) => <div data-testid="qr">{url}</div>,
}))
jest.mock('@/components/Global/CopyToClipboard', () => ({ __esModule: true, default: () => <button>copy</button> }))
jest.mock('@/features/pix/usePixProviderId', () => ({ usePixProviderId: () => 'bridge' }))
jest.mock('@/features/pix/components/PixPausedScreen', () => ({ PixPausedScreen: () => <div>paused</div> }))
jest.mock('@/features/pix/components/PixUnavailableScreen', () => ({
    PixUnavailableScreen: ({ description }: { description: string }) => (
        <div data-testid="unavailable">{description}</div>
    ),
}))
const mockFetchUser = jest.fn(() => Promise.resolve(null))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null, fetchUser: mockFetchUser }) }))
type Read = {
    deposit: PixDeposit | undefined
    phase: 'pending'
    isError: boolean
    refusal?: PixStandingRefusal
    retry: () => void
    isRetrying: boolean
}
const mockRetry = jest.fn()
const mockDeposit = jest.fn<Read, [string | null]>()
jest.mock('@/features/pix/usePixDeposit', () => ({ usePixDeposit: (id: string | null) => mockDeposit(id) }))

import { PixQrDeposit } from '../components/PixQrDeposit'

const STANDING: PixDeposit = {
    provider: 'bridge',
    intentId: null,
    status: 'AWAITING_USER_ACTION',
    codePayable: true,
    pixReceived: false,
    brCode: '00020126...standing',
    expiresAt: null,
    amountBrl: null,
    usdcAmount: null,
}
const read = (overrides: Partial<Read> = {}) =>
    mockDeposit.mockReturnValue({
        deposit: STANDING,
        phase: 'pending',
        isError: false,
        retry: mockRetry,
        isRetrying: false,
        ...overrides,
    })
const refusedWith = (refusal: PixStandingRefusal) => read({ deposit: undefined, isError: true, refusal })
const renderScreen = (marketLines?: string[]) =>
    renderWithIntl(
        <PixQrDeposit
            intentId={null}
            minimumBrl="25"
            marketLines={marketLines}
            payerLine={en.depositAccounts.senderLimit.businessOnly.line}
            onBack={jest.fn()}
            onDone={jest.fn()}
            onNewDeposit={jest.fn()}
            onComplete={jest.fn()}
        />
    )

// ruling D7: one code, any amount, no timer and nothing to wait on
describe('PixQrDeposit on a standing code', () => {
    beforeEach(() => jest.clearAllMocks())

    it('reads the standing code, not a deposit', () => {
        read()
        renderScreen()
        expect(mockDeposit).toHaveBeenCalledWith(null)
    })

    it('draws the code with the minimum, who may pay, where each Pix shows, and the provider', () => {
        read()
        renderScreen()
        expect(screen.getByTestId('qr')).toHaveTextContent('00020126...standing')
        expect(screen.getByText(en.addMoney.pix.scanWithBankApp)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'copy' })).toBeInTheDocument()
        expect(screen.getByText('The minimum is R$25.')).toBeInTheDocument()
        expect(screen.getByText(en.depositAccounts.senderLimit.businessOnly.line)).toBeInTheDocument()
        expect(screen.getByText(en.pix.deposit.landsInActivity)).toBeInTheDocument()
        expect(screen.getByText('fine print')).toBeInTheDocument()
    })

    // API-CONTRACT 8.2: Bridge's market rate and its cut of each Pix, in the list under the minimum
    it('lists the market rate and the provider fee right under the minimum', () => {
        read()
        const marketLines = ['The exchange rate is 1 USD = BRL 5.7143.', 'The provider fee is 0.57% of each Pix.']
        renderScreen(marketLines)
        const items = screen.getAllByRole('listitem').map((item) => item.textContent)
        expect(items.slice(0, 3)).toEqual(['The minimum is R$25.', ...marketLines])
    })

    it('shows no amount, no estimate, no timer and no wait', () => {
        read()
        renderScreen()
        expect(screen.queryByText(/^R\$\d/)).toBeNull()
        expect(screen.queryByText(/^You get/)).toBeNull()
        expect(screen.queryByText(/^Code valid for /)).toBeNull()
        expect(screen.queryByText(en.addMoney.processingDepositTitle)).toBeNull()
        expect(screen.queryByRole('button', { name: en.pix.deposit.startNew })).toBeNull()
    })

    it('waits for the code with the page loader on the first call', () => {
        read({ deposit: undefined })
        renderScreen()
        expect(screen.getByText('loading')).toBeInTheDocument()
    })

    it('offers another try where one can work', () => {
        refusedWith({ screen: 'retry', recheck: false })
        renderScreen()
        expect(screen.getByText(en.pix.unavailable)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: en.common.tryAgain }))
        expect(mockRetry).toHaveBeenCalled()
        expect(mockFetchUser).not.toHaveBeenCalled()
    })

    it('reads the capabilities again when the route moved', () => {
        refusedWith({ screen: 'retry', recheck: true })
        renderScreen()
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
        expect(screen.getByRole('button', { name: en.common.tryAgain })).toBeInTheDocument()
    })

    it('shows the outage screen for a paused provider, and reads the route again', () => {
        refusedWith({ screen: 'paused' })
        renderScreen()
        expect(screen.getByText('paused')).toBeInTheDocument()
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
    })

    it.each([
        ['pix.rolloutClosed', en.pix.rolloutClosed],
        ['pix.residenceNotServed', en.pix.residenceNotServed],
        ['depositAccounts.errors.providerRefused', en.depositAccounts.errors.providerRefused],
    ] as const)('says why it is closed (%s), in the catalog line, never the API text', (line, text) => {
        refusedWith({ screen: 'closed', line })
        renderScreen()
        expect(screen.getByTestId('unavailable')).toHaveTextContent(text)
        expect(screen.queryByRole('button', { name: en.common.tryAgain })).toBeNull()
    })
})
