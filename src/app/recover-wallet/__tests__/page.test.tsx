import { fireEvent, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { ModalsProvider, useModalsContext } from '@/context/ModalsContext'
import { encodeRecoveryKey } from '@/utils/walletRescue.utils'
import RecoverWalletPage from '../page'

let mockKey: string | null
const mockCreateKernelClient = jest.fn()
jest.mock('next/navigation', () => ({ useSearchParams: () => ({ get: () => mockKey }) }))
jest.mock('@/context/kernelClient.context', () => ({
    createKernelClientForChain: (...args: unknown[]) => mockCreateKernelClient(...args),
}))
jest.mock('@/app/actions/clients', () => ({
    PUBLIC_CLIENTS_BY_CHAIN: new Proxy({}, { get: () => ({ client: {}, chain: {} }) }),
}))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
// jsdom has no canvas. Keep the real mascot container and exercise support
// even when its animation cannot load.
jest.mock('lottie-web/build/player/lottie_light', () => ({
    __esModule: true,
    default: {
        loadAnimation: () => {
            throw new Error('animation unavailable')
        },
    },
}))
jest.mock('@/components/Global/GeneralRecipientInput', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/SupportDrawer', () => ({
    __esModule: true,
    default: function MockSupportDrawer() {
        const { isSupportModalOpen, supportPrefilledMessage } = useModalsContext()
        return isSupportModalOpen ? (
            <div role="dialog" aria-label="Support">
                <textarea aria-label="Message" defaultValue={supportPrefilledMessage} />
            </div>
        ) : null
    },
}))

function openRecoveryPage(key: string | null) {
    mockKey = key
    return render(
        <IntlWrapper>
            <ModalsProvider>
                <RecoverWalletPage />
            </ModalsProvider>
        </IntlWrapper>
    )
}

beforeEach(() => mockCreateKernelClient.mockReset())

it.each([null, 'invalid-secret-fixture'])('offers support without initializing a wallet for key %s', async (key) => {
    const { container } = openRecoveryPage(key)
    const error = await screen.findByText(/this recovery link is invalid or has expired/i)
    const heading = screen.getByRole('heading', { name: 'Recovery link unavailable' })
    const card = heading.closest('.border')
    expect(card).toContainElement(error)
    const mascot = container.querySelector<HTMLElement>('[data-mascot-pose="sad"]')
    expect(mascot).toHaveAttribute('aria-hidden', 'true')
    expect(card).not.toContainElement(mascot)
    expect(mascot?.compareDocumentPosition(error)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(mockCreateKernelClient).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Contact support' }))
    expect(await screen.findByRole('dialog', { name: 'Support' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('')
})

it('offers the same support action when wallet initialization fails', async () => {
    const key = encodeRecoveryKey({
        pubX: '0x1',
        pubY: '0x2',
        credId: 'dGVzdA',
        address: '0x1111111111111111111111111111111111111111',
    })
    mockCreateKernelClient.mockRejectedValueOnce(new Error('synthetic initialization failure'))
    const log = jest.spyOn(console, 'error').mockImplementation(() => {})
    try {
        openRecoveryPage(key)
        expect(await screen.findByText(/we could not load this wallet for recovery/i)).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Wallet recovery unavailable' })).toBeInTheDocument()
        expect(mockCreateKernelClient).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('button', { name: 'Recover funds' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Contact support' }))
        expect(await screen.findByRole('dialog', { name: 'Support' })).toBeInTheDocument()
        expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('')
    } finally {
        log.mockRestore()
    }
})
